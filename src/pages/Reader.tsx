import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, List, Settings, Bookmark, BookmarkCheck, X, Highlighter, Trash2, Pencil, Check } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import EpubReader from '@/components/Reader/EpubReader';
import TxtReader from '@/components/Reader/TxtReader';
import PdfReader from '@/components/Reader/PdfReader';
import SelectionToolbar from '@/components/Reader/SelectionToolbar';
import type { EpubReaderRef } from '@/components/Reader/EpubReader';
import type { TxtReaderRef } from '@/components/Reader/TxtReader';
import type { PdfReaderRef } from '@/components/Reader/PdfReader';
import {
  addBookmark,
  getBookmarks,
  deleteBookmark,
  getHighlights,
  addHighlight,
  deleteHighlight,
  updateHighlight,
} from '@/utils/db';
import type { Bookmark as BookmarkType, TocItem, Highlight, HighlightColor } from '@/types';

// Toast 消息类型
type ToastType = 'success' | 'error';

export default function Reader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const books = useBookStore((s) => s.books);
  const updateBook = useBookStore((s) => s.updateBook);
  const loadBooks = useBookStore((s) => s.loadBooks);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 保存最新的位置和进度，防止组件卸载时丢失
  const pendingLocationRef = useRef<string>('');
  const pendingProgressRef = useRef<number>(0);

  // Toast 提示状态
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 高亮详情弹窗状态
  const [highlightPopover, setHighlightPopover] = useState<{
    highlight: Highlight;
    position: { x: number; y: number };
  } | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

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
  const bookRef = useRef(book);
  bookRef.current = book;

  const [progress, setProgress] = useState(book?.progress ?? 0);
  const [currentLocation, setCurrentLocation] = useState(book?.currentLocation ?? '');
  const [currentChapterName, setCurrentChapterName] = useState(book?.currentChapter || '');

  // 主题背景映射
  const themeBg: Record<string, string> = {
    light: 'bg-warm-50 text-warm-800',
    dark: 'bg-night-bg text-night-text',
    sepia: 'bg-warm-100 text-warm-800',
    green: 'bg-eye-bg text-eye-text',
  };

  // 高亮颜色映射
  const highlightColorMap: Record<HighlightColor, { bg: string; border: string }> = {
    yellow: { bg: '#FEF3C7', border: '#F59E0B' },
    green: { bg: '#D1FAE5', border: '#10B981' },
    blue: { bg: '#DBEAFE', border: '#3B82F6' },
    pink: { bg: '#FCE7F3', border: '#EC4899' },
    purple: { bg: '#EDE9FE', border: '#8B5CF6' },
  };

  // 显示 Toast 提示
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // 如果书籍数据未加载（如直接通过 URL 访问），自动加载
  useEffect(() => {
    if (books.length === 0) {
      loadBooks();
    }
  }, [books.length, loadBooks]);

  // 加载书签
  useEffect(() => {
    if (bookId) {
      getBookmarks(bookId).then(setBookmarks);
    }
  }, [bookId]);

  // 加载高亮
  useEffect(() => {
    if (bookId) {
      getHighlights(bookId)
        .then(setHighlights)
        .catch((err) => {
          console.error('加载标注失败:', err);
          showToast('加载标注失败', 'error');
        });
    }
  }, [bookId, showToast]);

  // 选中文本工具栏状态
  const [selectionToolbar, setSelectionToolbar] = useState<{
    text: string;
    position: { x: number; y: number };
    cfiRange?: string;
  } | null>(null);

  // 处理文本选择（弹出工具栏）
  const handleTextSelected = useCallback(
    (selection: { text: string; cfiRange?: string; position: { x: number; y: number } }) => {
      setSelectionToolbar({
        text: selection.text,
        position: selection.position,
        cfiRange: selection.cfiRange,
      });
    },
    []
  );

  // 处理高亮（直接选颜色高亮）
  const handleHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!book || !selectionToolbar) return;
      const highlight: Highlight = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        bookId: book.id,
        location: selectionToolbar.cfiRange || currentLocation,
        text: selectionToolbar.text,
        color,
        chapter: currentChapterName || `进度 ${Math.round(progress)}%`,
        createdAt: Date.now(),
      };
      try {
        await addHighlight(highlight);
        setHighlights((prev) => [highlight, ...prev]);
        setSelectionToolbar(null);
        showToast('高亮已添加');
      } catch (err) {
        console.error('添加高亮失败:', err);
        showToast('添加高亮失败，请刷新页面重试', 'error');
      }
    },
    [book, selectionToolbar, currentLocation, currentChapterName, progress, showToast]
  );

  // 处理添加批注
  const handleAddNote = useCallback(
    async (color: HighlightColor, note: string) => {
      if (!book || !selectionToolbar) return;
      const highlight: Highlight = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        bookId: book.id,
        location: selectionToolbar.cfiRange || currentLocation,
        text: selectionToolbar.text,
        color,
        note,
        chapter: currentChapterName || `进度 ${Math.round(progress)}%`,
        createdAt: Date.now(),
      };
      try {
        await addHighlight(highlight);
        setHighlights((prev) => [highlight, ...prev]);
        setSelectionToolbar(null);
        showToast('批注已添加');
      } catch (err) {
        console.error('添加批注失败:', err);
        showToast('添加批注失败，请刷新页面重试', 'error');
        throw err; // 抛出让 SelectionToolbar 知道失败了
      }
    },
    [book, selectionToolbar, currentLocation, currentChapterName, progress, showToast]
  );

  // 处理高亮点击 - 显示详情弹窗
  const handleHighlightClick = useCallback((highlight: Highlight, position?: { x: number; y: number }) => {
    if (!position) return;
    // 计算弹窗位置，确保不超出视口
    const popoverWidth = 300;
    const popoverHeight = 280;
    let x = position.x - popoverWidth / 2;
    let y = position.y + 8;

    if (x + popoverWidth > window.innerWidth - 16) x = window.innerWidth - popoverWidth - 16;
    if (x < 16) x = 16;
    if (y + popoverHeight > window.innerHeight - 16) y = position.y - popoverHeight - 8;
    if (y < 16) y = 16;

    setHighlightPopover({ highlight, position: { x, y } });
    setEditingNote(false);
    setEditNoteText(highlight.note || '');
  }, []);

  // 关闭高亮弹窗
  const handleClosePopover = useCallback(() => {
    setHighlightPopover(null);
    setEditingNote(false);
  }, []);

  // 保存编辑的批注
  const handleSaveNote = useCallback(async () => {
    if (!highlightPopover) return;
    const updated = { ...highlightPopover.highlight, note: editNoteText.trim() || undefined };
    try {
      await updateHighlight(updated);
      setHighlights((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      setHighlightPopover({ ...highlightPopover, highlight: updated });
      setEditingNote(false);
      showToast('批注已更新');
    } catch (err) {
      console.error('更新批注失败:', err);
      showToast('更新批注失败', 'error');
    }
  }, [highlightPopover, editNoteText, showToast]);

  // 从弹窗中删除标注
  const handleDeleteFromPopover = useCallback(async () => {
    if (!highlightPopover) return;
    try {
      await deleteHighlight(highlightPopover.highlight.id);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightPopover.highlight.id));
      setHighlightPopover(null);
      setEditingNote(false);
      showToast('标注已删除');
    } catch (err) {
      console.error('删除标注失败:', err);
      showToast('删除标注失败', 'error');
    }
  }, [highlightPopover, showToast]);

  // 从标注面板删除
  const handleDeleteHighlight = useCallback(async (id: string) => {
    try {
      await deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      showToast('标注已删除');
    } catch (err) {
      console.error('删除标注失败:', err);
      showToast('删除标注失败', 'error');
    }
  }, [showToast]);

  // 点击标注记录定位到文章位置
  const handleHighlightNavigate = useCallback((highlight: Highlight) => {
    if (book?.format === 'epub') {
      // EPUB: 使用 CFI range 定位
      epubReaderRef.current?.goToLocation(highlight.location);
    } else if (book?.format === 'txt') {
      // TXT: 先跳转到对应章节，然后滚动到高亮位置
      try {
        const loc = JSON.parse(highlight.location);
        if (typeof loc.chapter === 'number') {
          txtReaderRef.current?.goToChapter(loc.chapter);
          // 等待章节渲染完成后滚动到高亮位置
          setTimeout(() => {
            txtReaderRef.current?.scrollToHighlight(highlight.id);
          }, 100);
        }
      } catch {
        // 解析失败忽略
      }
    } else if (book?.format === 'pdf') {
      // PDF: 解析位置信息跳转页面
      try {
        const loc = JSON.parse(highlight.location);
        if (typeof loc.page === 'number') {
          pdfReaderRef.current?.goToPage(loc.page);
        }
      } catch {
        // 解析失败忽略
      }
    }
  }, [book?.format]);

  // 点击弹窗外部关闭
  useEffect(() => {
    if (!highlightPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClosePopover();
      }
    };
    // 延迟添加监听，避免当前点击立即触发关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [highlightPopover, handleClosePopover]);

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
    (location: string, newProgress: number, chapterName?: string) => {
      setCurrentLocation(location);
      setProgress(newProgress);
      if (chapterName) {
        setCurrentChapterName(chapterName);
      }

      // 记录最新值到 ref，用于组件卸载时刷新保存
      pendingLocationRef.current = location;
      pendingProgressRef.current = newProgress;

      // 防抖保存（2秒内只保存一次），使用 bookRef 避免闭包捕获过期 book
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const latestBook = bookRef.current;
        if (latestBook) {
          updateBook({
            ...latestBook,
            currentLocation: pendingLocationRef.current,
            progress: pendingProgressRef.current,
            lastReadTime: Date.now(),
          });
        }
      }, 2000);
    },
    [updateBook]
  );

  // 组件卸载时立即刷新保存进度，防止防抖定时器未触发导致进度丢失
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const latestBook = bookRef.current;
      if (latestBook && pendingLocationRef.current) {
        updateBook({
          ...latestBook,
          currentLocation: pendingLocationRef.current,
          progress: pendingProgressRef.current,
          lastReadTime: Date.now(),
        });
      }
    };
  }, [updateBook]);

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
          {/* 标注笔记按钮 */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-2 rounded-lg transition-colors relative ${showNotes ? 'bg-black/10' : 'hover:bg-black/5'}`}
            title="标注笔记"
          >
            <Highlighter className="w-4 h-4" />
            {highlights.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-warm-400 text-white text-[10px] rounded-full flex items-center justify-center">
                {highlights.length > 9 ? '9+' : highlights.length}
              </span>
            )}
          </button>

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

        {/* 标注笔记面板 */}
        {showNotes && (
          <aside className="w-72 border-r border-black/5 bg-black/5 p-4 overflow-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium opacity-70">标注笔记</h3>
              <button onClick={() => setShowNotes(false)} className="p-1 hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {highlights.length === 0 ? (
              <div className="text-center py-8">
                <Highlighter className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs opacity-50">暂无标注</p>
                <p className="text-xs opacity-40 mt-1">选中文本即可添加标注</p>
              </div>
            ) : (
              <div className="space-y-3">
                {highlights.map((highlight) => {
                  const colors = highlightColorMap[highlight.color];
                  return (
                    <div
                      key={highlight.id}
                      className="p-3 rounded-lg bg-white/50 border border-black/5 group cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleHighlightNavigate(highlight)}
                    >
                      {/* 高亮文本 */}
                      <div
                        className="text-xs mb-2 p-2 rounded"
                        style={{ backgroundColor: colors.bg }}
                      >
                        "{highlight.text}"
                      </div>

                      {/* 批注 */}
                      {highlight.note && (
                        <div className="text-xs text-warm-600 mb-2 pl-2 border-l-2 border-warm-300">
                          {highlight.note}
                        </div>
                      )}

                      {/* 元信息 */}
                      <div className="flex items-center justify-between text-xs opacity-50">
                        <span className="truncate">{highlight.chapter}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHighlight(highlight.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                          title="删除标注"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
            />
          ) : book.format === 'pdf' ? (
            <PdfReader
              ref={pdfReaderRef}
              book={book}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
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
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
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

      {/* 选中文本工具栏 */}
      <SelectionToolbar
        visible={selectionToolbar !== null}
        selectedText={selectionToolbar?.text || ''}
        initialPosition={selectionToolbar?.position}
        onHighlight={handleHighlight}
        onAddNote={handleAddNote}
        onClose={() => setSelectionToolbar(null)}
      />

      {/* 高亮详情弹窗 */}
      {highlightPopover && (
        <div
          ref={popoverRef}
          className="note-popover fixed z-50 bg-white rounded-xl shadow-2xl border border-black/10 w-72 overflow-hidden"
          style={{
            left: `${highlightPopover.position.x}px`,
            top: `${highlightPopover.position.y}px`,
          }}
        >
          {/* 高亮颜色条 */}
          <div
            className="h-1"
            style={{ backgroundColor: highlightColorMap[highlightPopover.highlight.color].border }}
          />

          <div className="p-4 space-y-3">
            {/* 高亮文本 */}
            <div
              className="text-sm text-warm-700 rounded-lg p-3 max-h-20 overflow-auto leading-relaxed border-l-3"
              style={{
                backgroundColor: highlightColorMap[highlightPopover.highlight.color].bg,
                borderLeftColor: highlightColorMap[highlightPopover.highlight.color].border,
              }}
            >
              "{highlightPopover.highlight.text}"
            </div>

            {/* 批注内容 / 编辑模式 */}
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                  placeholder="输入批注内容..."
                  className="w-full text-sm border border-black/10 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-warm-400/50"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingNote(false);
                      setEditNoteText(highlightPopover.highlight.note || '');
                    }}
                    className="flex-1 px-2 py-1.5 text-xs text-warm-500 hover:bg-black/5 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="flex-1 px-2 py-1.5 text-xs text-white bg-warm-400 hover:bg-warm-500 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    保存
                  </button>
                </div>
              </div>
            ) : highlightPopover.highlight.note ? (
              <div className="text-sm text-warm-600 pl-3 border-l-2 border-warm-300 leading-relaxed">
                {highlightPopover.highlight.note}
              </div>
            ) : null}

            {/* 操作按钮 */}
            <div className="flex items-center justify-between pt-1 border-t border-black/5">
              <span className="text-xs text-warm-400 truncate mr-2">
                {highlightPopover.highlight.chapter}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingNote(true);
                    setEditNoteText(highlightPopover.highlight.note || '');
                  }}
                  className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                  title={highlightPopover.highlight.note ? '编辑批注' : '添加批注'}
                >
                  <Pencil className="w-3.5 h-3.5 text-warm-400" />
                </button>
                <button
                  onClick={handleDeleteFromPopover}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除标注"
                >
                  <Trash2 className="w-3.5 h-3.5 text-warm-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg text-sm text-white transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
