import { useEffect } from 'react';
import TopBar from '@/components/Layout/TopBar';
import BookCardGrid from '@/components/BookCard/BookCardGrid';
import BookCardList from '@/components/BookCard/BookCardList';
import DropZone from '@/components/DropZone';
import EmptyState from '@/components/EmptyState';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import { ArrowDownAZ, Clock, Calendar } from 'lucide-react';
import type { SortBy } from '@/types';

const sortOptions: { value: SortBy; label: string; icon: typeof Clock }[] = [
  { value: 'importTime', label: '导入时间', icon: Calendar },
  { value: 'lastRead', label: '最近阅读', icon: Clock },
  { value: 'title', label: '书名', icon: ArrowDownAZ },
];

export default function Library() {
  const loadBooks = useBookStore((s) => s.loadBooks);
  const isLoading = useBookStore((s) => s.isLoading);
  const sortBy = useBookStore((s) => s.sortBy);
  const setSortBy = useBookStore((s) => s.setSortBy);
  const getFilteredBooks = useBookStore((s) => s.getFilteredBooks);
  const viewMode = usePreferenceStore((s) => s.viewMode);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const books = getFilteredBooks();

  return (
    <DropZone>
      <TopBar title="我的书架" />

      <div className="flex-1 overflow-auto p-6">
        {/* 排序栏 */}
        {books.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-warm-400">
              共 {books.length} 本书
            </span>
            <div className="flex items-center gap-1">
              {sortOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                      sortBy === opt.value
                        ? 'bg-warm-400 text-white'
                        : 'text-warm-400 hover:bg-warm-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-warm-200 border-t-warm-400 rounded-full animate-spin" />
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && books.length === 0 && <EmptyState />}

        {/* 网格视图 */}
        {!isLoading && books.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {books.map((book) => (
              <BookCardGrid key={book.id} book={book} />
            ))}
          </div>
        )}

        {/* 列表视图 */}
        {!isLoading && books.length > 0 && viewMode === 'list' && (
          <div className="space-y-2 max-w-4xl">
            {books.map((book) => (
              <BookCardList key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </DropZone>
  );
}
