import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/Layout/TopBar';
import BookCardGrid from '@/components/BookCard/BookCardGrid';
import BookCardList from '@/components/BookCard/BookCardList';
import DropZone from '@/components/DropZone';
import EmptyState from '@/components/EmptyState';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import { useBookImport } from '@/hooks/useBookImport';
import { ArrowDownAZ, Clock, Calendar, Tag, X } from 'lucide-react';
import type { SortBy } from '@/types';

const sortOptions: { value: SortBy; label: string; icon: typeof Clock }[] = [
  { value: 'importTime', label: '导入时间', icon: Calendar },
  { value: 'lastRead', label: '最近阅读', icon: Clock },
  { value: 'title', label: '书名', icon: ArrowDownAZ },
];

export default function Library() {
  const navigate = useNavigate();
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
  const deleteCategory = useBookStore((s) => s.deleteCategory);
  const viewMode = usePreferenceStore((s) => s.viewMode);
  const { createEmptyTxtBook } = useBookImport();

  // 新建 TXT 弹窗状态
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const books = getFilteredBooks();
  const categories = getCategories();

  // 打开新建弹窗
  const handleOpenNewFile = useCallback(() => {
    setNewFileName('');
    setShowNewFileDialog(true);
  }, []);

  // 确认新建
  const handleConfirmNewFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    try {
      const book = await createEmptyTxtBook(name);
      setShowNewFileDialog(false);
      setNewFileName('');
      // 创建后直接跳转到阅读器，方便用户编辑
      navigate(`/reader/${book.id}`);
    } catch (err) {
      console.error('新建文件失败:', err);
    } finally {
      setIsCreating(false);
    }
  }, [newFileName, isCreating, createEmptyTxtBook, navigate]);

  return (
    <DropZone>
      <TopBar title="我的书架" onCreateNew={handleOpenNewFile} />

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
                <X
                  className="w-3 h-3 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCategory(cat);
                  }}
                />
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
        {!isLoading && books.length === 0 && <EmptyState onCreateNew={handleOpenNewFile} />}

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

      {/* 新建 TXT 文件弹窗 */}
      {showNewFileDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => !isCreating && setShowNewFileDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-black/10 w-96 overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
              <h3 className="font-medium text-warm-800">新建 TXT 文件</h3>
              <button
                onClick={() => setShowNewFileDialog(false)}
                disabled={isCreating}
                className="p-1 hover:bg-black/5 rounded transition-colors"
              >
                <X className="w-4 h-4 text-warm-400" />
              </button>
            </div>
            <div className="p-5">
              <label className="text-sm text-warm-600 mb-2 block">文件名</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmNewFile();
                  if (e.key === 'Escape') setShowNewFileDialog(false);
                }}
                placeholder="输入文件名（不含扩展名）"
                autoFocus
                disabled={isCreating}
                className="w-full px-4 py-2.5 text-sm bg-warm-50 border border-warm-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400
                           placeholder:text-warm-300 transition-all disabled:opacity-50"
              />
              <p className="text-xs text-warm-400 mt-2">将创建一个空的 TXT 文件，可在阅读器中编辑内容</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-black/5 bg-warm-50/50">
              <button
                onClick={() => setShowNewFileDialog(false)}
                disabled={isCreating}
                className="px-4 py-2 text-sm text-warm-500 hover:bg-black/5 rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmNewFile}
                disabled={!newFileName.trim() || isCreating}
                className="px-4 py-2 text-sm text-white bg-warm-400 hover:bg-warm-500 rounded-lg
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DropZone>
  );
}
