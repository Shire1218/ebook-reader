import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Book, Highlight, HighlightColor } from '@/types';
import { getBookFile } from '@/utils/db';
import { decodeTxtBuffer, splitIntoChapters, textToHtml, textToHtmlWithHighlights, textToHtmlWithSearch } from '@/utils/txtParser';
import type { TxtChapter } from '@/utils/txtParser';

export interface TxtReaderRef {
  goToChapter: (index: number) => void;
  goToLocation: (location: string) => void;
  scrollToHighlight: (highlightId: string) => void;
  getChaptersText: () => string[];
  scrollToSearchMatch: (matchIndex: number) => void;
}

interface TxtReaderProps {
  book: Book;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: string;
  onLocationChange: (location: string, progress: number, chapterName?: string) => void;
  onTocLoaded: (toc: { label: string; href: string }[]) => void;
  highlights: Highlight[];
  onTextSelected: (selection: { text: string; position: { x: number; y: number } }) => void;
  onHighlightClick: (highlight: Highlight, position?: { x: number; y: number }) => void;
  searchQuery?: string;
}

// 主题颜色映射
const themeColors: Record<string, { bg: string; text: string }> = {
  light: { bg: '#FAF8F5', text: '#2C2420' },
  dark: { bg: '#1A1A1A', text: '#D4D4D4' },
  sepia: { bg: '#F5F0EA', text: '#2C2420' },
  green: { bg: '#E8F0E4', text: '#333333' },
};

const TxtReader = forwardRef<TxtReaderRef, TxtReaderProps>(function TxtReader({
  book,
  fontSize,
  lineHeight,
  fontFamily,
  theme,
  onLocationChange,
  onTocLoaded,
  highlights,
  onTextSelected,
  onHighlightClick,
  searchQuery,
}, ref) {
  const [chapters, setChapters] = useState<TxtChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  // 暴露跳转方法给父组件
  useImperativeHandle(ref, () => ({
    goToChapter: (index: number) => {
      if (index >= 0 && index < chapters.length) {
        setChapterIndex(index);
      }
    },
    goToLocation: (location: string) => {
      try {
        const loc = JSON.parse(location);
        if (typeof loc.chapter === 'number') {
          setChapterIndex(loc.chapter);
        }
      } catch {
        // 解析失败忽略
      }
    },
    scrollToHighlight: (highlightId: string) => {
      // 查找高亮元素并滚动到该位置
      const highlightEl = containerRef.current?.querySelector(`[data-highlight-id="${highlightId}"]`);
      if (highlightEl) {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 添加短暂高亮闪烁效果
        const el = highlightEl as HTMLElement;
        const originalBoxShadow = el.style.boxShadow;
        el.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.5)';
        setTimeout(() => {
          el.style.boxShadow = originalBoxShadow;
        }, 1500);
      }
    },
    // 获取所有章节文本（用于搜索索引）
    getChaptersText: () => {
      return chapters.map((ch) => ch.content);
    },
    // 滚动到指定搜索匹配项
    scrollToSearchMatch: (matchIndex: number) => {
      const marks = containerRef.current?.querySelectorAll('mark.search-match');
      if (marks && marks.length > matchIndex) {
        const mark = marks[matchIndex] as HTMLElement;
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 闪烁效果
        mark.classList.add('search-match-active');
        setTimeout(() => {
          mark.classList.remove('search-match-active');
        }, 2000);
      }
    },
  }));

  // 加载并解析 TXT 文件
  useEffect(() => {
    async function loadTxt() {
      const data = await getBookFile(book.id);
      if (!data) {
        setIsLoading(false);
        return;
      }

      const text = decodeTxtBuffer(data);
      const parsedChapters = splitIntoChapters(text);
      setChapters(parsedChapters);

      // 通知目录
      const tocItems = parsedChapters.map((ch, idx) => ({
        label: ch.title,
        href: `chapter-${idx}`,
      }));
      onTocLoaded(tocItems);

      // 恢复阅读位置
      let savedChapter = 0;
      let savedScrollRatio = 0;
      if (book.currentLocation) {
        try {
          const loc = JSON.parse(book.currentLocation);
          savedChapter = loc.chapter ?? 0;
          savedScrollRatio = loc.scrollRatio ?? 0;
        } catch {
          // 解析失败从头开始
        }
      }

      setChapterIndex(savedChapter);
      setIsLoading(false);

      // 恢复滚动位置（需要等 DOM 渲染完成）
      if (savedScrollRatio > 0) {
        isRestoringRef.current = true;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (containerRef.current) {
              const el = containerRef.current;
              const maxScroll = el.scrollHeight - el.clientHeight;
              if (maxScroll > 0) {
                el.scrollTop = maxScroll * savedScrollRatio;
              }
            }
            isRestoringRef.current = false;
          });
        });
      }
    }

    loadTxt();
  }, [book.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 章节变化时滚动到顶部，并立即通知父组件保存进度
  useEffect(() => {
    if (!isRestoringRef.current) {
      containerRef.current?.scrollTo(0, 0);
    }
    // 章节切换后立即通知父组件保存进度（键盘切换章节时滚动事件可能丢失）
    if (chapters.length > 0 && !isRestoringRef.current) {
      const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
      const readChars = chapters.slice(0, chapterIndex).reduce((sum, ch) => sum + ch.content.length, 0);
      const progress = totalChars > 0 ? (readChars / totalChars) * 100 : 0;
      const location = JSON.stringify({ chapter: chapterIndex, scrollRatio: 0 });
      const chapterName = chapters[chapterIndex]?.title || '';
      onLocationChange(location, progress, chapterName);
    }
  }, [chapterIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 滚动时计算进度并通知父组件
  const handleScroll = useCallback(() => {
    if (chapters.length === 0 || isRestoringRef.current) return;

    const el = containerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    const scrollRatio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;

    // 计算总进度
    let totalChars = 0;
    let readChars = 0;
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch) continue;
      const len = ch.content.length;
      totalChars += len;
      if (i < chapterIndex) readChars += len;
      if (i === chapterIndex) {
        readChars += len * Math.min(scrollRatio, 1);
      }
    }
    const progress = totalChars > 0 ? (readChars / totalChars) * 100 : 0;

    const location = JSON.stringify({ chapter: chapterIndex, scrollRatio: Math.min(scrollRatio, 1) });
    const chapterName = chapters[chapterIndex]?.title || '';
    onLocationChange(location, progress, chapterName);
  }, [chapterIndex, chapters, onLocationChange]);

  // 用节流控制滚动回调频率
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  // 键盘事件：上下方向键滚动，左右切换章节
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const el = containerRef.current;
      if (!el) return;

      if (e.key === 'ArrowDown') {
        // 向下滚动一屏
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight * 0.8, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        // 向上滚动一屏
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight * 0.8, behavior: 'smooth' });
      } else if (e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight * 0.9, behavior: 'smooth' });
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight * 0.9, behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        // 下一章
        if (chapterIndex < chapters.length - 1) {
          setChapterIndex((c) => c + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        // 上一章
        if (chapterIndex > 0) {
          setChapterIndex((c) => c - 1);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapterIndex, chapters.length]);

  // 监听文本选择
  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const position = {
          x: rect.left + rect.width / 2,
          y: rect.top,
        };

        onTextSelected({ text, position });
      }
    }

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [onTextSelected]);

  // 监听进度条拖拽跳转事件
  useEffect(() => {
    function handleSeek(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail || typeof detail.progress !== 'number' || chapters.length === 0) return;

      const targetProgress = detail.progress;
      const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
      const targetChars = (targetProgress / 100) * totalChars;

      // 找到目标章节
      let accChars = 0;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]!;
        if (accChars + ch.content.length >= targetChars) {
          setChapterIndex(i);
          // 计算章节内滚动比例
          const chapterOffset = targetChars - accChars;
          const scrollRatio = ch.content.length > 0 ? chapterOffset / ch.content.length : 0;
          // 等待渲染后滚动
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (containerRef.current) {
                const el = containerRef.current;
                const maxScroll = el.scrollHeight - el.clientHeight;
                el.scrollTop = maxScroll * Math.min(scrollRatio, 1);
              }
            });
          });
          break;
        }
        accChars += ch.content.length;
      }
    }

    window.addEventListener('reader-seek', handleSeek);
    return () => window.removeEventListener('reader-seek', handleSeek);
  }, [chapters]);

  const colors = themeColors[theme] ?? themeColors.light!;
  const currentChapter = chapters[chapterIndex];

  // 高亮颜色映射
  const colorMap: Record<HighlightColor, string> = {
    yellow: '#FEF3C7',
    green: '#D1FAE5',
    blue: '#DBEAFE',
    pink: '#FCE7F3',
    purple: '#EDE9FE',
  };

  // 渲染带高亮的章节内容
  const renderContentWithHighlights = (content: string) => {
    // 如果有搜索词，优先显示搜索高亮
    if (searchQuery?.trim()) {
      return textToHtmlWithSearch(content, searchQuery);
    }

    // 获取当前章节的高亮，转换为 HighlightInfo 格式
    const chapterHighlights = highlights
      .filter((h) => h.chapter === currentChapter?.title)
      .map((h) => ({
        text: h.text,
        color: colorMap[h.color],
        id: h.id,
        hasNote: !!h.note,
      }));

    if (chapterHighlights.length === 0) {
      return textToHtml(content);
    }

    return textToHtmlWithHighlights(content, chapterHighlights);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-warm-200 border-t-warm-400 rounded-full animate-spin" />
          <span className="text-sm text-warm-400">加载中...</span>
        </div>
      </div>
    );
  }

  if (!currentChapter) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm opacity-50">章节内容为空</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      ref={containerRef}
      style={{ backgroundColor: colors.bg }}
    >
      <div
        className="max-w-3xl mx-auto px-8 py-12"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: lineHeight,
          fontFamily: fontFamily,
          color: colors.text,
        }}
      >
        {/* 章节标题 */}
        {currentChapter.title !== '正文' && (
          <h2
            className="text-center font-serif font-bold mb-8"
            style={{ fontSize: `${Math.min(fontSize * 1.5, 36)}px`, color: colors.text }}
          >
            {currentChapter.title}
          </h2>
        )}

        {/* 章节完整内容 */}
        <div
          className="txt-content"
          dangerouslySetInnerHTML={{ __html: renderContentWithHighlights(currentChapter.content) }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('highlight-mark')) {
              const highlightId = target.getAttribute('data-highlight-id');
              const highlight = highlights.find((h) => h.id === highlightId);
              if (highlight) {
                const rect = target.getBoundingClientRect();
                onHighlightClick(highlight, { x: rect.left + rect.width / 2, y: rect.bottom });
              }
            }
          }}
        />

        {/* 章节末尾导航 */}
        <div className="flex items-center justify-between mt-16 pt-8 border-t border-current/10 opacity-40">
          <button
            onClick={() => chapterIndex > 0 && setChapterIndex((c) => c - 1)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-opacity ${
              chapterIndex > 0 ? 'hover:opacity-70 cursor-pointer' : 'opacity-30 cursor-default'
            }`}
          >
            上一章
          </button>
          <span className="text-xs">
            {chapterIndex + 1} / {chapters.length}
          </span>
          <button
            onClick={() => chapterIndex < chapters.length - 1 && setChapterIndex((c) => c + 1)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-opacity ${
              chapterIndex < chapters.length - 1 ? 'hover:opacity-70 cursor-pointer' : 'opacity-30 cursor-default'
            }`}
          >
            下一章
          </button>
        </div>
      </div>
    </div>
  );
});

export default TxtReader;
