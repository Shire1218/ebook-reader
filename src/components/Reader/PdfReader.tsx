import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// 直接导入 worker 模块，它会设置 globalThis.pdfjsWorker，
// pdfjs 检测到后直接在主线程运行，避免 Worker 创建和动态导入失败
import 'pdfjs-dist/build/pdf.worker.mjs';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { Book, Highlight, HighlightColor } from '@/types';
import { getBookFile } from '@/utils/db';

// worker 已通过上方 import 加载到 globalThis.pdfjsWorker，无需设置 workerSrc

export interface PdfReaderRef {
  goToPage: (page: number) => void;
}

interface PdfReaderProps {
  book: Book;
  theme: string;
  onLocationChange: (location: string, progress: number, chapterName?: string) => void;
  onTocLoaded: (toc: { label: string; href: string }[]) => void;
  highlights: Highlight[];
  onTextSelected: (selection: { text: string; position: { x: number; y: number } }) => void;
  onHighlightClick: (highlight: Highlight, position?: { x: number; y: number }) => void;
}

// 高亮颜色映射
const highlightColorMap: Record<HighlightColor, string> = {
  yellow: '#FEF3C7',
  green: '#D1FAE5',
  blue: '#DBEAFE',
  pink: '#FCE7F3',
  purple: '#EDE9FE',
};

// 主题颜色映射
const themeColors: Record<string, { bg: string }> = {
  light: { bg: '#FAF8F5' },
  dark: { bg: '#1A1A1A' },
  sepia: { bg: '#F5F0EA' },
  green: { bg: '#E8F0E4' },
};

// 缩放范围
const MIN_SCALE = 0.25;
const MAX_SCALE = 8.0;
const SCALE_STEP = 0.15;
const BASE_RENDER_SCALE = 1.5;

const PdfReader = forwardRef<PdfReaderRef, PdfReaderProps>(function PdfReader({
  book,
  theme,
  onLocationChange,
  onTocLoaded,
  highlights,
  onTextSelected,
  onHighlightClick,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  // 高亮矩形位置信息
  const [highlightRects, setHighlightRects] = useState<
    { x: number; y: number; width: number; height: number; color: string; id: string }[]
  >([]);
  // 存储目录信息用于查找当前章节
  const tocRef = useRef<{ label: string; page: number }[]>([]);

  // 暴露跳转方法给父组件
  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
  }));

  // 加载 PDF
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      const data = await getBookFile(book.id);
      if (!data || cancelled) {
        setIsLoading(false);
        return;
      }

      try {
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);

        // 加载目录
        const outline = await pdf.getOutline();
        if (outline) {
          const tocItems = outline.map((item, idx) => ({
            label: item.title,
            href: `page-${idx + 1}`,
          }));
          // 存储目录用于查找当前章节（简化：使用索引作为页码）
          tocRef.current = outline.map((item, idx) => ({
            label: item.title,
            page: idx + 1,
          }));
          onTocLoaded(tocItems);
        }

        // 恢复阅读位置
        if (book.currentLocation) {
          try {
            const loc = JSON.parse(book.currentLocation);
            if (typeof loc.page === 'number') {
              setCurrentPage(loc.page);
            }
          } catch {
            // 解析失败从第1页开始
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('PDF 加载失败:', err);
        setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [book.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 渲染当前页
  useEffect(() => {
    async function renderPage() {
      const pdf = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;

      try {
        const page = await pdf.getPage(currentPage);
        const scale = BASE_RENDER_SCALE * zoom;
        const viewport = page.getViewport({ scale });

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;

        // 渲染文本层（用于文本选择）
        const textLayerDiv = document.getElementById('pdf-text-layer');
        const textContent = await page.getTextContent();

        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;

          // 使用 pdfjs-lib 的 TextLayer 渲染
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });
          await textLayer.render();

          // 添加文本层样式
          textLayerDiv.style.position = 'absolute';
          textLayerDiv.style.left = '0';
          textLayerDiv.style.top = '0';
          textLayerDiv.style.overflow = 'hidden';
          textLayerDiv.style.opacity = '0.3';
          textLayerDiv.style.lineHeight = '1.0';
        }

        // 渲染高亮标注
        const highlightOverlays: typeof highlightRects = [];
        for (const highlight of highlights) {
          // 检查高亮是否在当前页面（通过位置信息判断）
          try {
            const loc = JSON.parse(highlight.location);
            if (loc.page !== currentPage) continue;
          } catch {
            // 如果不是 JSON 格式，尝试通过文本匹配
          }

          // 在当前页面文本内容中查找高亮文本
          const textItems = textContent.items as any[];
          const pageText = textItems
            .filter((item) => item.str !== undefined)
            .map((item) => item.str)
            .join('');

          if (!pageText.includes(highlight.text)) continue;

          // 找到高亮文本在页面中的位置
          for (const item of textItems) {
            if (item.str === undefined) continue;
            const itemText = item.str as string;
            const idx = itemText.indexOf(highlight.text);
            if (idx !== -1) {
              // 计算高亮在 item 中的位置
              const transform = item.transform as number[];
              const t0 = transform[0] ?? 1;
              const t1 = transform[1] ?? 0;
              const t4 = transform[4] ?? 0;
              const t5 = transform[5] ?? 0;
              const fontSize = Math.sqrt(t0 * t0 + t1 * t1);
              const startX = t4 + idx * fontSize * 0.5; // 估算字符宽度
              const width = highlight.text.length * fontSize * 0.5;

              highlightOverlays.push({
                x: startX,
                y: viewport.height - t5 - fontSize, // PDF 坐标系转换
                width: width,
                height: fontSize * 1.2,
                color: highlightColorMap[highlight.color],
                id: highlight.id,
              });
              break;
            }
          }
        }
        setHighlightRects(highlightOverlays);

        // 通知位置变化
        const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
        const location = JSON.stringify({ page: currentPage });
        // 查找当前页对应的章节名
        let chapterName = '';
        if (tocRef.current.length > 0) {
          // 找到最后一个页码小于等于当前页的目录项
          for (let i = tocRef.current.length - 1; i >= 0; i--) {
            const tocItem = tocRef.current[i];
            if (tocItem && tocItem.page <= currentPage) {
              chapterName = tocItem.label;
              break;
            }
          }
        }
        if (!chapterName) {
          chapterName = `第 ${currentPage} 页`;
        }
        onLocationChange(location, progress, chapterName);
      } catch (err) {
        console.error('PDF 渲染失败:', err);
      }
    }

    if (!isLoading) {
      renderPage();
    }
  }, [currentPage, totalPages, isLoading, zoom, onLocationChange]);

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

  // Ctrl + 滚轮缩放（阻止浏览器默认缩放）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
        setZoom((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)));
      }
    }

    // passive: false 才能 preventDefault
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // 键盘事件
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentPage < totalPages) {
          setCurrentPage((p) => p + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentPage > 1) {
          setCurrentPage((p) => p - 1);
        }
      } else if (e.altKey && e.key === '=') {
        e.preventDefault();
        setZoom((prev) => Math.min(MAX_SCALE, prev + SCALE_STEP));
      } else if (e.altKey && e.key === '-') {
        e.preventDefault();
        setZoom((prev) => Math.max(MIN_SCALE, prev - SCALE_STEP));
      } else if (e.altKey && e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_SCALE, prev + SCALE_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_SCALE, prev - SCALE_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  const colors = themeColors[theme] ?? themeColors.light!;

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

  return (
    <div
      className="flex-1 min-h-0 overflow-auto flex flex-col items-center justify-center relative"
      ref={containerRef}
      style={{ backgroundColor: colors.bg }}
    >
      {/* 左下角缩放比例显示 */}
      <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-black/10">
        <span className="text-xs tabular-nums text-warm-600 font-medium">{Math.round(zoom * 100)}%</span>
      </div>

      {/* 缩放控制栏 */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-black/10 px-1 py-0.5">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= MIN_SCALE}
          className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="缩小 (Alt+-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomReset}
          className="px-2 py-1 text-xs tabular-nums hover:bg-black/5 rounded transition-colors min-w-[48px] text-center"
          title="重置缩放 (Alt+0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= MAX_SCALE}
          className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="放大 (Alt+=)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="shadow-2xl relative">
        <canvas ref={canvasRef} className="block" />
        <div id="pdf-text-layer" className="absolute left-0 top-0" />
        {/* 高亮标注覆盖层 */}
        {highlightRects.map((rect) => (
          <div
            key={rect.id}
            className="absolute pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              backgroundColor: rect.color,
              opacity: 0.5,
              mixBlendMode: 'multiply',
            }}
            onClick={(e) => {
              e.stopPropagation();
              const highlight = highlights.find((h) => h.id === rect.id);
              if (highlight) onHighlightClick(highlight, { x: e.clientX, y: e.clientY });
            }}
          />
        ))}
      </div>

      {/* 页码显示 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white text-sm rounded-full">
        {currentPage} / {totalPages}
      </div>
    </div>
  );
});

export default PdfReader;
