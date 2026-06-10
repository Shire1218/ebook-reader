import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, List, Settings, Bookmark, BookmarkCheck, X } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import EpubReader from '@/components/Reader/EpubReader';
import TxtReader from '@/components/Reader/TxtReader';
import PdfReader from '@/components/Reader/PdfReader';
import type { EpubReaderRef } from '@/components/Reader/EpubReader';
import type { TxtReaderRef } from '@/components/Reader/TxtReader';
import type { PdfReaderRef } from '@/components/Reader/PdfReader';
import { addBookmark, getBookmarks, deleteBookmark } from '@/utils/db';
import type { Bookmark as BookmarkType, TocItem } from '@/types';

export default function Reader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const books = useBookStore((s) => s.books);
  const updateBook = useBookStore((s) => s.updateBook);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentLocation, setCurrentLocation] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 阅读器 ref
  const epubReaderRef = useRef<EpubReaderRef>(null);
  const txtReaderRef = useRef<TxtReaderRef>(null);
  const pdfReaderRef = useRef<PdfReaderRef>(null);

  const { fontSize, lineHeight, fontFamily, theme } = usePreferenceStore();
  const setFontSize = usePreferenceStore((s) => s.setFontSize);
  const setLineHeight = usePreferenceStore((s) => s.setLineHeight);
  const setFontFamily = usePreferenceStore((s) => s.setFontFamily);
  const setTheme = usePreferenceStore((s) => s.setTheme);

  const book = books.find((b) => b.id === bookId);

  // 主题背景映射
  const themeBg: Record<string, string> = {
    light: 'bg-warm-50 text-warm-800',
    dark: 'bg-night-bg text-night-text',
    sepia: 'bg-warm-100 text-warm-800',
    green: 'bg-eye-bg text-eye-text',
  };

  // 加载书签
  useEffect(() => {
    if (bookId) {
      getBookmarks(bookId).then(setBookmarks);
    }
  }, [bookId]);

  // 检查当前是否已收藏
  useEffect(() => {
    if (currentLocation && bookmarks.length > 0) {
      const bookmarked = bookmarks.some((b) => b.location === currentLocation);
      setIsBookmarked(bookmarked);
    } else {
      setIsBookmarked(false);
    }
  }, [currentLocation, bookmarks]);

  // 位置变化回调 - 防抖保存进度
  const handleLocationChange = useCallback(
    (location: string, newProgress: number) => {
      setCurrentLocation(location);
      setProgress(newProgress);

      // 防抖保存（2秒内只保存一次）
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (book) {
          updateBook({
            ...book,
            currentLocation: location,
            progress: newProgress,
            lastReadTime: Date.now(),
          });
        }
      }, 2000);
    },
    [book, updateBook]
  );

  // 目录加载回调
  const handleTocLoaded = useCallback((tocItems: { label: string; href: string }[]) => {
    // 为每个目录项添加 id
    const items: TocItem[] = tocItems.map((item, idx) => ({
      id: `toc-${idx}`,
      label: item.label,
      href: item.href,
    }));
    setToc(items);
  }, []);

  // 目录点击跳转
  const handleTocClick = useCallback(
    (item: TocItem) => {
      if (book?.format === 'epub') {
        epubReaderRef.current?.goToChapter(item.href);
      } else if (book?.format === 'txt') {
        // TXT 的 href 格式是 chapter-{index}
        const match = item.href.match(/chapter-(\d+)/);
        if (match) {
          const index = parseInt(match[1]!, 10);
          txtReaderRef.current?.goToChapter(index);
        }
      } else if (book?.format === 'pdf') {
        // PDF 的 href 格式是 page-{index}
        const match = item.href.match(/page-(\d+)/);
        if (match) {
          const page = parseInt(match[1]!, 10);
          pdfReaderRef.current?.goToPage(page);
        }
      }
      setShowToc(false);
    },
    [book?.format]
  );

  // 进度条拖动
  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newProgress = Number(e.target.value);
      setProgress(newProgress);

      // 根据进度计算位置并跳转
      if (book?.format === 'epub' && epubReaderRef.current) {
        // EPUB 需要通过 CFI 跳转，这里简化处理
        // 实际应该根据 locations 计算对应的 CFI
      } else if (book?.format === 'txt' && txtReaderRef.current) {
        // TXT 根据进度计算章节和滚动位置
        // 这里简化为跳转到对应章节
      }
    },
    [book?.format]
  );

  // 添加/删除书签
  const handleToggleBookmark = useCallback(async () => {
    if (!book || !currentLocation) return;

    if (isBookmarked) {
      // 删除书签
      const bookmark = bookmarks.find((b) => b.location === currentLocation);
      if (bookmark) {
        await deleteBookmark(bookmark.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
      }
    } else {
      // 添加书签
      const newBookmark: BookmarkType = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        bookId: book.id,
        location: currentLocation,
        chapter: book.currentChapter || `进度 ${Math.round(progress)}%`,
        progress,
        createdAt: Date.now(),
      };
      await addBookmark(newBookmark);
      setBookmarks((prev) => [newBookmark, ...prev]);
    }
  }, [book, currentLocation, isBookmarked, bookmarks, progress]);

  // 点击书签跳转
  const handleBookmarkClick = useCallback(
    (bookmark: BookmarkType) => {
      if (book?.format === 'epub') {
        epubReaderRef.current?.goToLocation(bookmark.location);
      } else if (book?.format === 'txt') {
        txtReaderRef.current?.goToLocation(bookmark.location);
      } else if (book?.format === 'pdf') {
        try {
          const loc = JSON.parse(bookmark.location);
          if (typeof loc.page === 'number') {
            pdfReaderRef.current?.goToPage(loc.page);
          }
        } catch {
          // 解析失败忽略
        }
      }
      setShowBookmarks(false);
    },
    [book?.format]
  );

  // 删除书签
  const handleDeleteBookmark = useCallback(async (id: string) => {
    await deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center bg-warm-50">
        <div className="text-center">
          <p className="text-warm-400 mb-4">未找到该书籍</p>
          <button
            onClick={() => navigate('/')}
            className="text-warm-400 hover:text-warm-600 underline text-sm"
          >
            返回书架
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col h-full theme-transition ${themeBg[theme] || themeBg.light}`}>
      {/* 顶部工具栏 */}
      <header className="h-14 flex items-center justify-between px-4 bg-black/5 backdrop-blur-sm border-b border-black/5 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>书架</span>
        </button>

        <h1 className="font-serif text-sm font-medium truncate max-w-xs">{book.title}</h1>

        <div className="flex items-center gap-1">
          {/* 书签按钮 */}
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-lg transition-colors ${
              isBookmarked ? 'text-warm-400 bg-warm-400/10' : 'hover:bg-black/5'
            }`}
            title={isBookmarked ? '取消书签' : '添加书签'}
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>

          {/* 书签列表按钮 */}
          {bookmarks.length > 0 && (
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              className={`p-2 rounded-lg transition-colors ${showBookmarks ? 'bg-black/10' : 'hover:bg-black/5'}`}
              title="书签列表"
            >
              <span className="text-xs">{bookmarks.length}</span>
            </button>
          )}

          {/* 目录按钮 */}
          {toc.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              className={`p-2 rounded-lg transition-colors ${showToc ? 'bg-black/10' : 'hover:bg-black/5'}`}
            >
              <List className="w-4 h-4" />
            </button>
          )}

          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-black/10' : 'hover:bg-black/5'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 书签列表面板 */}
        {showBookmarks && (
          <aside className="w-64 border-r border-black/5 bg-black/5 p-4 overflow-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium opacity-70">书签</h3>
              <button onClick={() => setShowBookmarks(false)} className="p-1 hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 cursor-pointer group"
                  onClick={() => handleBookmarkClick(bookmark)}
                >
                  <Bookmark className="w-3.5 h-3.5 text-warm-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{bookmark.chapter}</p>
                    <p className="text-xs opacity-50">{Math.round(bookmark.progress)}%</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBookmark(bookmark.id);
                    }}
                    className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* 目录面板 */}
        {showToc && (
          <aside className="w-64 border-r border-black/5 bg-black/5 p-4 overflow-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium opacity-70">目录</h3>
              <button onClick={() => setShowToc(false)} className="p-1 hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <nav className="space-y-0.5">
              {toc.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTocClick(item)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/5 transition-colors truncate"
                  title={item.label}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* 阅读内容区 */}
        <div className="flex-1 min-h-0 flex flex-col">
          {book.format === 'epub' ? (
            <EpubReader
              ref={epubReaderRef}
              book={book}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
            />
          ) : book.format === 'pdf' ? (
            <PdfReader
              ref={pdfReaderRef}
              book={book}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
            />
          ) : (
            <TxtReader
              ref={txtReaderRef}
              book={book}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
            />
          )}
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <aside className="w-72 border-l border-black/5 bg-black/5 p-5 overflow-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium opacity-70">阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 字体选择 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 block">字体</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '系统默认', value: 'system-ui' },
                  { label: '思源宋体', value: '"Noto Serif SC", serif' },
                ].map((font) => (
                  <button
                    key={font.value}
                    onClick={() => setFontFamily(font.value)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                      fontFamily === font.value
                        ? 'border-warm-400 bg-warm-400/10'
                        : 'border-black/10 hover:border-black/20'
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 字号 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 flex items-center justify-between">
                <span>字号</span>
                <span className="tabular-nums">{fontSize}px</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs">A</span>
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 accent-warm-400"
                />
                <span className="text-lg">A</span>
              </div>
            </div>

            {/* 行距 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 flex items-center justify-between">
                <span>行距</span>
                <span className="tabular-nums">{lineHeight.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="w-full accent-warm-400"
              />
            </div>

            {/* 主题 */}
            <div>
              <label className="text-xs opacity-50 mb-2 block">主题</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '白色', value: 'light' as const, bg: '#FAF8F5', border: '#E8DFD4' },
                  { label: '夜间', value: 'dark' as const, bg: '#1A1A1A', border: '#3A3A3A' },
                  { label: '护眼', value: 'green' as const, bg: '#E8F0E4', border: '#C8D8C4' },
                  { label: '牛皮', value: 'sepia' as const, bg: '#F5F0EA', border: '#D4C5B3' },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                      theme === t.value ? 'ring-2 ring-warm-400' : ''
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border"
                      style={{ backgroundColor: t.bg, borderColor: t.border }}
                    />
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* 底部进度栏 */}
      <footer className="h-12 flex items-center px-6 bg-black/5 border-t border-black/5 flex-shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <span className="text-xs opacity-50 tabular-nums w-12">{Math.round(progress)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={handleProgressChange}
            className="flex-1 accent-warm-400"
          />
        </div>
      </footer>
    </div>
  );
}
