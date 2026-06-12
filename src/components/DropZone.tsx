import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useBookImport } from '@/hooks/useBookImport';

interface DropZoneProps {
  children: React.ReactNode;
}

export default function DropZone({ children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { importFiles } = useBookImport();
  const dragCounter = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter[0]++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [dragCounter]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter[0]--;
    if (dragCounter[0] === 0) {
      setIsDragging(false);
    }
  }, [dragCounter]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter[0] = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await importFiles(e.dataTransfer.files);
      }
    },
    [importFiles, dragCounter]
  );

  return (
    <div
      className="relative h-full flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* 拖拽蒙层 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-warm-400/10 backdrop-blur-sm border-2 border-dashed border-warm-400 rounded-xl m-4">
          <div className="flex flex-col items-center gap-3 text-warm-600">
            <Upload className="w-12 h-12 animate-bounce" />
            <p className="text-lg font-medium">释放以导入书籍</p>
            <p className="text-sm text-warm-400">支持 EPUB、PDF、TXT、MOBI 格式</p>
          </div>
        </div>
      )}
    </div>
  );
}
