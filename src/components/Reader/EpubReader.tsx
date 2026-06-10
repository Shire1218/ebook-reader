import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';
import type { Book } from '@/types';
import { getBookFile, arrayBufferToBlobUrl } from '@/utils/db';

export interface EpubReaderRef {
  goToChapter: (href: string) => void;
  goToLocation: (location: string) => void;
}

interface EpubReaderProps {
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

const EpubReader = forwardRef<EpubReaderRef, EpubReaderProps>(function EpubReader({
  book,
  fontSize,
  lineHeight,
  fontFamily,
  theme,
  onLocationChange,
  onTocLoaded,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const epubBookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 暴露跳转方法给父组件
  useImperativeHandle(ref, () => ({
    goToChapter: (href: string) => {
      renditionRef.current?.display(href);
    },
    goToLocation: (location: string) => {
      renditionRef.current?.display(location);
    },
  }));

  // 初始化 epub
  useEffect(() => {
    let cancelled = false;

    async function initEpub() {
      const data = await getBookFile(book.id);
      if (!data || cancelled) {
        setIsLoading(false);
        return;
      }

      const url = arrayBufferToBlobUrl(data, 'application/epub+zip');
      const epubBook = ePub(url);
      epubBookRef.current = epubBook;

      // 等待 book 就绪
      await epubBook.ready;

      if (cancelled) return;

      // 加载目录
      try {
        const navigation = await epubBook.loaded.navigation;
        if (navigation && navigation.toc) {
          const tocItems = navigation.toc.map((item) => ({
            label: item.label?.trim() || '未命名',
            href: item.href,
          }));
          onTocLoaded(tocItems);
        }
      } catch {
        // 目录加载失败不影响阅读
      }

      // 创建 rendition
      if (!containerRef.current || cancelled) return;

      const rendition = epubBook.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      });
      renditionRef.current = rendition;

      // 应用样式
      applyTheme(rendition, theme, fontSize, lineHeight, fontFamily);

      // 监听位置变化
      rendition.on('relocated', (location: { start?: { cfi?: string } }) => {
        if (location?.start?.cfi) {
          const progress = epubBook.locations?.percentageFromCfi(location.start.cfi);
          const pct = progress ? Math.round(progress * 100) : 0;
          onLocationChange(location.start.cfi, pct);
        }
      });

      // 生成 locations（用于进度计算）
      await epubBook.locations.generate(1024);

      // 显示上次位置或开头
      if (book.currentLocation) {
        await rendition.display(book.currentLocation);
      } else {
        await rendition.display();
      }

      setIsLoading(false);
    }

    initEpub();

    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      epubBookRef.current?.destroy();
      renditionRef.current = null;
      epubBookRef.current = null;
    };
  }, [book.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 更新主题样式
  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme, fontSize, lineHeight, fontFamily);
    }
  }, [theme, fontSize, lineHeight, fontFamily]);

  // 暴露翻页方法
  const goNext = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const goPrev = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  // 注册键盘事件
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goPrev();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  return (
    <div className="flex-1 min-h-0 relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-warm-50/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-warm-200 border-t-warm-400 rounded-full animate-spin" />
            <span className="text-sm text-warm-400">加载中...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export default EpubReader;

// 应用主题到 rendition
function applyTheme(
  rendition: Rendition,
  theme: string,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
) {
  const colors = themeColors[theme] ?? themeColors.light!;

  const overrides: Record<string, string> = {
    'body': `background: ${colors.bg}; color: ${colors.text};`,
    'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': `color: ${colors.text};`,
    'a': `color: ${colors.text};`,
  };

  // 逐条注册样式
  for (const [selector, cssValue] of Object.entries(overrides)) {
    rendition.themes.override(selector, cssValue, true);
  }

  rendition.themes.fontSize(`${fontSize}px`);
  rendition.themes.font(fontFamily.replace(/['"]/g, ''));

  // 注册自定义主题
  rendition.themes.register('custom', {
    'body': {
      background: colors.bg,
      color: colors.text,
      'line-height': `${lineHeight}`,
      'font-family': fontFamily,
    },
    'p': {
      'line-height': `${lineHeight}`,
      color: colors.text,
    },
  });
  rendition.themes.select('custom');
}
