import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';
import type { Book, Highlight, HighlightColor } from '@/types';
import { getBookFile, arrayBufferToBlobUrl } from '@/utils/db';

export interface EpubReaderRef {
  goToChapter: (href: string) => void;
  goToLocation: (location: string) => void;
  scrollToSearchMatch: (matchIndex: number) => void;
}

interface EpubReaderProps {
  book: Book;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: string;
  onLocationChange: (location: string, progress: number, chapterName?: string) => void;
  onTocLoaded: (toc: { label: string; href: string }[]) => void;
  highlights: Highlight[];
  onTextSelected: (selection: { text: string; cfiRange: string; position: { x: number; y: number } }) => void;
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

const EpubReader = forwardRef<EpubReaderRef, EpubReaderProps>(function EpubReader({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const epubBookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  // 跟踪已添加到 epubjs 的标注 CFI
  const renderedCfiRanges = useRef<Set<string>>(new Set());
  // 存储目录信息用于查找当前章节
  const tocRef = useRef<{ label: string; href: string }[]>([]);

  // 暴露跳转方法给父组件
  useImperativeHandle(ref, () => ({
    goToChapter: (href: string) => {
      renditionRef.current?.display(href);
    },
    goToLocation: (location: string) => {
      renditionRef.current?.display(location);
    },
    // 滚动到指定搜索匹配项（在 iframe 内）
    scrollToSearchMatch: (matchIndex: number) => {
      const iframe = containerRef.current?.querySelector('iframe');
      const doc = iframe?.contentDocument;
      if (!doc) return;
      const marks = doc.querySelectorAll('mark.search-match');
      if (marks && marks.length > matchIndex) {
        const mark = marks[matchIndex] as HTMLElement;
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mark.classList.add('search-match-active');
        setTimeout(() => {
          mark.classList.remove('search-match-active');
        }, 2000);
      }
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
          tocRef.current = tocItems;
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
      rendition.on('relocated', (location: { start?: { cfi?: string; index?: number } }) => {
        if (location?.start?.cfi) {
          const progress = epubBook.locations?.percentageFromCfi(location.start.cfi);
          const pct = progress ? Math.round(progress * 100) : 0;
          // 根据当前 spine index 查找章节名
          let chapterName = '';
          if (location.start.index !== undefined && tocRef.current.length > 0) {
            const spineItem = epubBook.spine?.get(location.start.index);
            if (spineItem) {
              const tocItem = tocRef.current.find((t) => spineItem.href.includes(t.href) || t.href.includes(spineItem.href));
              if (tocItem) {
                chapterName = tocItem.label;
              }
            }
          }
          onLocationChange(location.start.cfi, pct, chapterName);
        }
      });

      // 监听文本选择
      rendition.on('selected', (cfiRange: string, contents: any) => {
        const selection = contents?.window?.getSelection();
        if (selection && selection.toString().trim()) {
          const text = selection.toString().trim();
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const iframe = contents?.window?.frameElement;
          const iframeRect = iframe?.getBoundingClientRect();

          const position = {
            x: (iframeRect?.left || 0) + rect.left + rect.width / 2,
            y: (iframeRect?.top || 0) + rect.top,
          };

          onTextSelected({ text, cfiRange, position });
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
      renderedCfiRanges.current.clear();
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

  // 渲染高亮标注
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const colorMap: Record<HighlightColor, string> = {
      yellow: '#FEF3C7',
      green: '#D1FAE5',
      blue: '#DBEAFE',
      pink: '#FCE7F3',
      purple: '#EDE9FE',
    };

    // 移除不再存在的标注
    const currentCfiSet = new Set(highlights.map((h) => h.location));
    renderedCfiRanges.current.forEach((cfiRange) => {
      if (!currentCfiSet.has(cfiRange)) {
        try {
          rendition.annotations.remove(cfiRange, 'highlight');
        } catch {
          // 标注可能已不存在
        }
        renderedCfiRanges.current.delete(cfiRange);
      }
    });

    // 添加新的标注
    highlights.forEach((highlight) => {
      if (renderedCfiRanges.current.has(highlight.location)) return;

      try {
        rendition.annotations.highlight(
          highlight.location,
          {},
          (e: Event) => {
            e.stopPropagation();
            const mouseEvent = e as MouseEvent;
            onHighlightClick(highlight, { x: mouseEvent.clientX, y: mouseEvent.clientY });
          },
          undefined,
          {
            fill: colorMap[highlight.color],
            'fill-opacity': '0.5',
            'mix-blend-mode': 'multiply',
          }
        );
        renderedCfiRanges.current.add(highlight.location);
      } catch {
        // CFI 可能不在当前页面，忽略
      }
    });
  }, [highlights, onHighlightClick]);

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

  // 在 iframe 内容中高亮搜索关键词
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    function highlightSearchInIframe() {
      const iframe = containerRef.current?.querySelector('iframe');
      const doc = iframe?.contentDocument;
      if (!doc || !doc.body) return;

      // 先清除旧的搜索高亮
      const oldMarks = doc.querySelectorAll('mark.search-match');
      oldMarks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(doc.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });

      if (!searchQuery?.trim()) return;

      // 在文本节点中查找并高亮搜索关键词
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQuery, 'gi');
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      const textNodes: Text[] = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text);
      }

      for (const node of textNodes) {
        const text = node.textContent || '';
        if (!regex.test(text)) continue;
        regex.lastIndex = 0;

        const frag = doc.createDocumentFragment();
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(doc.createTextNode(text.slice(lastIdx, match.index)));
          }
          const mark = doc.createElement('mark');
          mark.className = 'search-match';
          mark.textContent = match[0];
          frag.appendChild(mark);
          lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) {
          frag.appendChild(doc.createTextNode(text.slice(lastIdx)));
        }
        node.parentNode?.replaceChild(frag, node);
      }
    }

    // 页面渲染后高亮
    rendition.on('rendered', highlightSearchInIframe);
    // searchQuery 变化时也高亮当前页
    if (searchQuery?.trim()) {
      setTimeout(highlightSearchInIframe, 100);
    }

    return () => {
      rendition.off('rendered', highlightSearchInIframe);
    };
  }, [searchQuery]);

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
