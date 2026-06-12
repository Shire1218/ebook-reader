import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Book, Highlight, HighlightColor } from '@/types';
import { getBookFile } from '@/utils/db';
import { decodeTxtBuffer, splitIntoChapters, textToHtml, textToHtmlWithHighlights, textToHtmlWithSearch } from '@/utils/txtParser';
import type { TxtChapter, ParagraphFormat } from '@/utils/txtParser';

export interface TxtReaderRef {
  goToChapter: (index: number) => void;
  goToLocation: (location: string) => void;
  scrollToHighlight: (highlightId: string) => void;
  getChaptersText: () => string[];
  scrollToSearchMatch: (matchIndex: number) => void;
  // 编辑模式方法
  getEditedContent: () => string;  // 获取当前编辑后的 HTML
  getCurrentChapterIndex: () => number;  // 获取当前章节索引
  isDirty: () => boolean;          // 是否有未保存的修改
  reloadChapter: () => void;       // 重新加载当前章节（丢弃编辑）
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
  onTextSelected: (selection: { text: string; position: { x: number; y: number }; paragraphIndex?: number; offsetInParagraph?: number }) => void;
  onHighlightClick: (highlight: Highlight, position?: { x: number; y: number }) => void;
  searchQuery?: string;
  // 编辑模式
  isEditMode?: boolean;
  // 段落格式
  textAlignment?: string;
  paragraphSpacing?: number;
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
  isEditMode = false,
  textAlignment = 'justify',
  paragraphSpacing = 0.8,
}, ref) {
  const [chapters, setChapters] = useState<TxtChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const dirtyRef = useRef(false);  // 跟踪是否有未保存的编辑

  // 段落格式参数
  const paraFormat: ParagraphFormat = {
    alignment: textAlignment,
    spacing: paragraphSpacing,
  };

  // 暴露方法给父组件
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
      const highlightEl = containerRef.current?.querySelector(`[data-highlight-id="${highlightId}"]`);
      if (highlightEl) {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const el = highlightEl as HTMLElement;
        const originalBoxShadow = el.style.boxShadow;
        el.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.5)';
        setTimeout(() => {
          el.style.boxShadow = originalBoxShadow;
        }, 1500);
      }
    },
    getChaptersText: () => {
      return chapters.map((ch) => ch.content);
    },
    scrollToSearchMatch: (matchIndex: number) => {
      const marks = containerRef.current?.querySelectorAll('mark.search-match');
      if (marks && marks.length > matchIndex) {
        const mark = marks[matchIndex] as HTMLElement;
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mark.classList.add('search-match-active');
        setTimeout(() => {
          mark.classList.remove('search-match-active');
        }, 2000);
      }
    },
    // 获取当前编辑后的 HTML 内容
    getEditedContent: () => {
      return contentRef.current?.innerHTML || '';
    },
    // 获取当前章节索引
    getCurrentChapterIndex: () => {
      return chapterIndex;
    },
    // 是否有未保存的修改
    isDirty: () => {
      return dirtyRef.current;
    },
    // 重新加载当前章节（丢弃编辑）
    reloadChapter: () => {
      if (contentRef.current && currentChapter) {
        contentRef.current.innerHTML = textToHtml(currentChapter.content, paraFormat);
        dirtyRef.current = false;
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

  // 章节变化时滚动到顶部，并重置 dirty 状态
  useEffect(() => {
    if (!isRestoringRef.current) {
      containerRef.current?.scrollTo(0, 0);
    }
    dirtyRef.current = false;  // 切换章节时重置 dirty 状态
    if (chapters.length > 0 && !isRestoringRef.current) {
      const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
      const readChars = chapters.slice(0, chapterIndex).reduce((sum, ch) => sum + ch.content.length, 0);
      const progress = totalChars > 0 ? (readChars / totalChars) * 100 : 0;
      const location = JSON.stringify({ chapter: chapterIndex, scrollRatio: 0 });
      const chapterName = chapters[chapterIndex]?.title || '';
      onLocationChange(location, progress, chapterName);
    }
  }, [chapterIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 滚动时计算进度
  const handleScroll = useCallback(() => {
    if (chapters.length === 0 || isRestoringRef.current) return;

    const el = containerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    const scrollRatio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;

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

  // 键盘事件
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditMode) return;

      const el = containerRef.current;
      if (!el) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight * 0.8, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight * 0.8, behavior: 'smooth' });
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight * 0.9, behavior: 'smooth' });
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight * 0.9, behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        if (chapterIndex < chapters.length - 1) {
          setChapterIndex((c) => c + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (chapterIndex > 0) {
          setChapterIndex((c) => c - 1);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapterIndex, chapters.length, isEditMode]);

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

        // 计算选中文本在段落中的精确位置
        let paragraphIndex: number | undefined;
        let offsetInParagraph: number | undefined;

        const container = contentRef.current;
        if (container) {
          const paragraphs = container.querySelectorAll('p');
          const startNode = range.startContainer;
          // 找到选区起点所在的 <p> 元素
          let pNode: Node | null = startNode;
          while (pNode && pNode !== container && pNode.nodeName !== 'P') {
            pNode = pNode.parentNode;
          }
          if (pNode && pNode.nodeName === 'P') {
            // 计算段落索引
            for (let i = 0; i < paragraphs.length; i++) {
              if (paragraphs[i] === pNode) {
                paragraphIndex = i;
                break;
              }
            }
            // 计算在段落文本中的偏移
            const pText = (pNode as HTMLElement).textContent || '';
            // 创建一个临时 range 来计算偏移
            const tempRange = document.createRange();
            tempRange.setStart(pNode, 0);
            tempRange.setEnd(startNode, range.startOffset);
            offsetInParagraph = tempRange.toString().length;
            tempRange.detach();
            // 确保偏移不超过段落长度
            if (offsetInParagraph > pText.length) {
              offsetInParagraph = pText.length;
            }
          }
        }

        onTextSelected({ text, position, paragraphIndex, offsetInParagraph });
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

      let accChars = 0;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]!;
        if (accChars + ch.content.length >= targetChars) {
          setChapterIndex(i);
          const chapterOffset = targetChars - accChars;
          const scrollRatio = ch.content.length > 0 ? chapterOffset / ch.content.length : 0;
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

  // 编辑模式下，监听内容变化标记 dirty
  useEffect(() => {
    if (!isEditMode || !contentRef.current) return;

    const el = contentRef.current;
    function handleInput() {
      dirtyRef.current = true;
    }

    el.addEventListener('input', handleInput);
    return () => {
      el.removeEventListener('input', handleInput);
    };
  }, [isEditMode]);

  const colors = themeColors[theme] ?? themeColors.light!;
  const currentChapter = chapters[chapterIndex];

  const colorMap: Record<HighlightColor, string> = {
    yellow: '#FEF3C7',
    green: '#D1FAE5',
    blue: '#DBEAFE',
    pink: '#FCE7F3',
    purple: '#EDE9FE',
  };

  // 渲染章节内容
  const renderContent = () => {
    if (!currentChapter) return '';

    if (searchQuery?.trim()) {
      return textToHtmlWithSearch(currentChapter.content, searchQuery, paraFormat);
    }

    // 编辑模式下跳过批注渲染，防止 contentEditable DOM 被重置导致编辑状态丢失
    if (isEditMode) {
      return textToHtml(currentChapter.content, paraFormat);
    }

    const chapterHighlights = highlights
      .filter((h) => h.chapter === currentChapter.title)
      .map((h) => ({
        text: h.text,
        color: colorMap[h.color],
        id: h.id,
        hasNote: !!h.note,
        paragraphIndex: h.paragraphIndex,
        offsetInParagraph: h.offsetInParagraph,
      }));

    if (chapterHighlights.length === 0) {
      return textToHtml(currentChapter.content, paraFormat);
    }

    return textToHtmlWithHighlights(currentChapter.content, chapterHighlights, paraFormat);
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
        {currentChapter.title !== '正文' && (
          <h2
            className="text-center font-serif font-bold mb-8"
            style={{ fontSize: `${Math.min(fontSize * 1.5, 36)}px`, color: colors.text }}
          >
            {currentChapter.title}
          </h2>
        )}

        {isEditMode && (
          <div className="mb-4 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-600 text-center">
            编辑模式 - 点击文本区域即可编辑内容
          </div>
        )}

        <div
          ref={contentRef}
          className="txt-content"
          contentEditable={isEditMode}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: renderContent() }}
          style={isEditMode ? {
            outline: 'none',
            cursor: 'text',
            minHeight: '200px',
          } : undefined}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!isEditMode && target.classList.contains('highlight-mark')) {
              const highlightId = target.getAttribute('data-highlight-id');
              const highlight = highlights.find((h) => h.id === highlightId);
              if (highlight) {
                const rect = target.getBoundingClientRect();
                onHighlightClick(highlight, { x: rect.left + rect.width / 2, y: rect.bottom });
              }
            }
          }}
        />

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
