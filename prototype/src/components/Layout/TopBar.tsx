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
    <header className="h-16 flex items-center justify-between px-6 theme-transition"
      style={{
        backgroundColor: 'var(--theme-bg-primary)',
        borderBottom: '1px solid var(--theme-border)',
      }}
    >
      {/* 左侧标题 */}
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="font-serif text-xl font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {title}
          </h1>
        )}
      </div>

      {/* 右侧工具栏 */}
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />
          <input
            type="text"
            placeholder="搜索书籍..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 pl-9 pr-4 py-2 text-sm rounded-full focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: 'var(--theme-bg-secondary)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          />
        </div>

        {/* 视图切换 */}
        <div className="flex items-center rounded-lg p-0.5"
          style={{
            backgroundColor: 'var(--theme-bg-secondary)',
            border: '1px solid var(--theme-border)',
          }}
        >
          <button
            onClick={() => setViewMode('grid')}
            className="p-1.5 rounded-md transition-all"
            style={{
              backgroundColor: viewMode === 'grid' ? 'var(--theme-bg-primary)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--theme-accent)' : 'var(--theme-text-tertiary)',
              boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="p-1.5 rounded-md transition-all"
            style={{
              backgroundColor: viewMode === 'list' ? 'var(--theme-bg-primary)' : 'transparent',
              color: viewMode === 'list' ? 'var(--theme-accent)' : 'var(--theme-text-tertiary)',
              boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* 新建 TXT 按钮 */}
        {showImport && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all duration-200"
            style={{
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-secondary)',
              border: '1px solid var(--theme-border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--theme-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--theme-border)';
            }}
          >
            <FilePlus className="w-4 h-4" />
            <span>新建</span>
          </button>
        )}

        {/* 导入按钮 */}
        {showImport && (
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            <Plus className="w-4 h-4" />
            <span>导入</span>
          </button>
        )}
      </div>
    </header>
  );
}
