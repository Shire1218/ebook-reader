import { Search, LayoutGrid, List, Plus, FilePlus } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import { useBookImport } from '@/hooks/useBookImport';

interface TopBarProps {
  title?: string;
  showImport?: boolean;
  onCreateNew?: () => void;
}

export default function TopBar({ title, showImport = true, onCreateNew }: TopBarProps) {
  const searchQuery = useBookStore((s) => s.searchQuery);
  const setSearchQuery = useBookStore((s) => s.setSearchQuery);
  const viewMode = usePreferenceStore((s) => s.viewMode);
  const setViewMode = usePreferenceStore((s) => s.setViewMode);
  const { importFromFilePicker } = useBookImport();

  const handleImport = async () => {
    await importFromFilePicker();
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-warm-50 border-b border-warm-200 theme-transition">
      {/* 左侧标题 */}
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="font-serif text-xl font-semibold text-warm-800">{title}</h1>
        )}
      </div>

      {/* 右侧工具栏 */}
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-300" />
          <input
            type="text"
            placeholder="搜索书籍..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 pl-9 pr-4 py-2 text-sm bg-warm-100 border border-warm-200 rounded-full
                       focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400
                       placeholder:text-warm-300 transition-all"
          />
        </div>

        {/* 视图切换 */}
        <div className="flex items-center bg-warm-100 rounded-lg p-0.5 border border-warm-200">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-warm-400 shadow-sm'
                : 'text-warm-300 hover:text-warm-600'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'list'
                ? 'bg-white text-warm-400 shadow-sm'
                : 'text-warm-300 hover:text-warm-600'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* 新建 TXT 按钮 */}
        {showImport && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-white text-warm-600 text-sm font-medium
                       rounded-lg border border-warm-300 hover:bg-warm-50 hover:border-warm-400
                       shadow-sm transition-all duration-200"
          >
            <FilePlus className="w-4 h-4" />
            <span>新建</span>
          </button>
        )}

        {/* 导入按钮 */}
        {showImport && (
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-warm-400 text-white text-sm font-medium
                       rounded-lg hover:bg-warm-500 shadow-sm hover:shadow-md
                       transition-all duration-200 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>导入</span>
          </button>
        )}
      </div>
    </header>
  );
}
