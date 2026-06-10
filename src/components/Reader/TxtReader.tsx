import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Book } from '@/types';
import { getBookFile } from '@/utils/db';
import { decodeTxtBuffer, splitIntoChapters, textToHtml } from '@/utils/txtParser';
import type { TxtChapter } from '@/utils/txtParser';

export interface TxtReaderRef {
  goToChapter: (index: number) => void;
  goToLocation: (location: string) => void;
}

interface TxtReaderProps {
  book: Book;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: string;
  onLocationChange: (location: string, progress: number) => void;
  onTocLoaded: (toc: { label: string; href: string }[]) => void;
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
      onLocationChange(location, progress);
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
    onLocationChange(location, progress);
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

  const colors = themeColors[theme] ?? themeColors.light!;
  const currentChapter = chapters[chapterIndex];

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
          dangerouslySetInnerHTML={{ __html: textToHtml(currentChapter.content) }}
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
