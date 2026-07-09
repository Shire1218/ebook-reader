import { BookOpen, Upload, FilePlus } from 'lucide-react';
import { useBookImport } from '@/hooks/useBookImport';

interface EmptyStateProps {
  onCreateNew?: () => void;
}

export default function EmptyState({ onCreateNew }: EmptyStateProps) {
  const { importFromFilePicker } = useBookImport();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        {/* 图标 */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-warm-100 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-warm-300" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-warm-400 flex items-center justify-center shadow-lg">
            <Upload className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* 文字 */}
        <div>
          <h3 className="text-lg font-serif font-semibold text-warm-800">书架空空如也</h3>
          <p className="text-sm text-warm-400 mt-2 leading-relaxed">
            拖拽电子书文件到此处，或点击下方按钮导入
            <br />
            支持 EPUB、PDF、TXT 格式
          </p>
        </div>

        {/* 按钮 */}
        <div className="flex items-center gap-3">
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-warm-600 text-sm font-medium
                         rounded-lg border border-warm-300 hover:bg-warm-50 hover:border-warm-400
                         shadow-sm transition-all duration-200"
            >
              <FilePlus className="w-4 h-4" />
              <span>新建 TXT</span>
            </button>
          )}
          <button
            onClick={importFromFilePicker}
            className="flex items-center gap-2 px-6 py-2.5 bg-warm-400 text-white text-sm font-medium
                       rounded-lg hover:bg-warm-500 shadow-sm hover:shadow-md
                       transition-all duration-200 hover:-translate-y-0.5"
          >
            <Upload className="w-4 h-4" />
            <span>选择文件导入</span>
          </button>
        </div>
      </div>
    </div>
  );
}
