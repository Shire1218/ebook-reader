import { useEffect } from 'react';
import TopBar from '@/components/Layout/TopBar';
import BookCardGrid from '@/components/BookCard/BookCardGrid';
import BookCardList from '@/components/BookCard/BookCardList';
import DropZone from '@/components/DropZone';
import EmptyState from '@/components/EmptyState';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import { ArrowDownAZ, Clock, Calendar, Tag, X } from 'lucide-react';
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
  const categoryFilter = useBookStore((s) => s.categoryFilter);
  // 订阅 books 状态，确保导入/删除书籍后组件重新渲染
  useBookStore((s) => s.books);
  // 订阅 searchQuery 以确保搜索时组件重新渲染
  useBookStore((s) => s.searchQuery);
  const getFilteredBooks = useBookStore((s) => s.getFilteredBooks);
  const getCategories = useBookStore((s) => s.getCategories);
  const setSortBy = useBookStore((s) => s.setSortBy);
  const setCategoryFilter = useBookStore((s) => s.setCategoryFilter);
  const viewMode = usePreferenceStore((s) => s.viewMode);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const books = getFilteredBooks();
  const categories = getCategories();

  return (
    <DropZone>
      <TopBar title="我的书架" />

      <div className="flex-1 overflow-auto p-6">
        {/* 分类筛选栏 */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-warm-400 flex-shrink-0" />
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                !categoryFilter
                  ? 'bg-warm-400 text-white'
                  : 'text-warm-400 hover:bg-warm-100 border border-warm-200'
              }`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={`px-3 py-1 text-xs rounded-full transition-all flex items-center gap-1 ${
                  categoryFilter === cat
                    ? 'bg-warm-400 text-white'
                    : 'text-warm-400 hover:bg-warm-100 border border-warm-200'
                }`}
              >
                <span>{cat}</span>
                {categoryFilter === cat && <X className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}

        {/* 排序栏 */}
        {books.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-warm-400">
              共 {books.length} 本书
              {categoryFilter && <span className="ml-1 text-warm-300">（{categoryFilter}）</span>}
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
          <div className="space-y-2 max-w-4xl pb-16">
            {books.map((book) => (
              <BookCardList key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </DropZone>
  );
}
