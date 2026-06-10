import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { Book } from '@/types';
import { getBookFile } from '@/utils/db';

// 使用本地打包的 worker 文件，避免 CDN 加载失败
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfReaderRef {
  goToPage: (page: number) => void;
}

interface PdfReaderProps {
  book: Book;
  theme: string;
  onLocationChange: (location: string, progress: number) => void;
  onTocLoaded: (toc: { label: string; href: string }[]) => void;
}

// 主题颜色映射
const themeColors: Record<string, { bg: string }> = {
  light: { bg: '#FAF8F5' },
  dark: { bg: '#1A1A1A' },
  sepia: { bg: '#F5F0EA' },
  green: { bg: '#E8F0E4' },
};

// 缩放范围
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;
const SCALE_STEP = 0.15;
const BASE_RENDER_SCALE = 1.5;

const PdfReader = forwardRef<PdfReaderRef, PdfReaderProps>(function PdfReader({
  book,
  theme,
  onLocationChange,
  onTocLoaded,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);

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

        // 通知位置变化
        const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
        const location = JSON.stringify({ page: currentPage });
        onLocationChange(location, progress);
      } catch (err) {
        console.error('PDF 渲染失败:', err);
      }
    }

    if (!isLoading) {
      renderPage();
    }
  }, [currentPage, totalPages, isLoading, zoom, onLocationChange]);

  // Ctrl + 滚轮缩放（阻止浏览器默认缩放）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
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
      } else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        setZoom((prev) => Math.min(MAX_SCALE, prev + SCALE_STEP));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom((prev) => Math.max(MIN_SCALE, prev - SCALE_STEP));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
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
      {/* 缩放控制栏 */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-black/10 px-1 py-0.5">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= MIN_SCALE}
          className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="缩小 (Ctrl+-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomReset}
          className="px-2 py-1 text-xs tabular-nums hover:bg-black/5 rounded transition-colors min-w-[48px] text-center"
          title="重置缩放 (Ctrl+0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= MAX_SCALE}
          className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="放大 (Ctrl+=)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="shadow-2xl">
        <canvas ref={canvasRef} className="block" />
      </div>

      {/* 页码显示 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white text-sm rounded-full">
        {currentPage} / {totalPages}
      </div>
    </div>
  );
});

export default PdfReader;
