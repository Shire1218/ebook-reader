import { useState, useRef, useEffect, useMemo } from 'react';
import { MoreVertical, Pencil, Trash2, X, Tag } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import type { Book } from '@/types';

interface BookCardActionsProps {
  book: Book;
  /** 菜单按钮的额外 className */
  buttonClassName?: string;
}

/**
 * 书籍操作组件：包含更多菜单、重命名弹窗、删除确认弹窗、分类编辑
 */
export default function BookCardActions({ book, buttonClassName = '' }: BookCardActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [newTitle, setNewTitle] = useState(book.title);
  const [newCategory, setNewCategory] = useState(book.category);
  const menuRef = useRef<HTMLDivElement>(null);
  const removeBook = useBookStore((s) => s.removeBook);
  const updateBook = useBookStore((s) => s.updateBook);
  const books = useBookStore((s) => s.books);
  // 用 useMemo 缓存分类列表，避免每次渲染返回新引用导致无限循环
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      if (b.category) set.add(b.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [books]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  useEffect(() => {
    if (showRename) setNewTitle(book.title);
  }, [showRename, book.title]);

  useEffect(() => {
    if (showCategory) setNewCategory(book.category);
  }, [showCategory, book.category]);

  const handleRename = () => {
    const trimmed = newTitle.trim();
    if (trimmed && trimmed !== book.title) {
      updateBook({ ...book, title: trimmed });
    }
    setShowRename(false);
  };

  const handleSetCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed !== book.category) {
      updateBook({ ...book, category: trimmed });
    }
    setShowCategory(false);
  };

  const handleDelete = () => {
    removeBook(book.id);
    setShowDelete(false);
  };

  return (
    <>
      {/* 更多按钮 */}
      <div className={`relative ${buttonClassName}`} ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded-lg bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
        >
          <MoreVertical className="w-3.5 h-3.5 text-warm-600" />
        </button>

        {/* 下拉菜单 */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-warm-200 py-1 z-50 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowRename(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              重命名
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowCategory(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              分类
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowDelete(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </div>
        )}
      </div>

      {/* 重命名弹窗 */}
      {showRename && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            setShowRename(false);
          }}
        >
          <div
            className="bg-white rounded-xl p-6 w-80 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-warm-800">重命名</h3>
              <button onClick={() => setShowRename(false)} className="p-1 hover:opacity-70">
                <X className="w-4 h-4 text-warm-400" />
              </button>
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setShowRename(false);
              }}
              className="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowRename(false)}
                className="px-4 py-2 text-sm text-warm-500 hover:bg-warm-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRename}
                disabled={!newTitle.trim()}
                className="px-4 py-2 text-sm bg-warm-400 text-white rounded-lg hover:bg-warm-500 transition-colors disabled:opacity-50"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分类编辑弹窗 */}
      {showCategory && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            setShowCategory(false);
          }}
        >
          <div
            className="bg-white rounded-xl p-6 w-80 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-warm-800">设置分类</h3>
              <button onClick={() => setShowCategory(false)} className="p-1 hover:opacity-70">
                <X className="w-4 h-4 text-warm-400" />
              </button>
            </div>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSetCategory();
                if (e.key === 'Escape') setShowCategory(false);
              }}
              placeholder="输入分类名称..."
              className="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent mb-3"
              autoFocus
            />
            {/* 已有分类快捷选择 */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                      newCategory === cat
                        ? 'bg-warm-400 text-white'
                        : 'text-warm-400 hover:bg-warm-100 border border-warm-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  // 直接清除分类，不依赖异步的 state 更新
                  if (book.category) {
                    updateBook({ ...book, category: '' });
                  }
                  setShowCategory(false);
                }}
                className="px-4 py-2 text-sm text-warm-500 hover:bg-warm-50 rounded-lg transition-colors"
              >
                清除
              </button>
              <button
                onClick={() => setShowCategory(false)}
                className="px-4 py-2 text-sm text-warm-500 hover:bg-warm-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSetCategory}
                className="px-4 py-2 text-sm bg-warm-400 text-white rounded-lg hover:bg-warm-500 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDelete && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            setShowDelete(false);
          }}
        >
          <div
            className="bg-white rounded-xl p-6 w-80 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-warm-800 mb-2">确认删除</h3>
            <p className="text-sm text-warm-400 mb-5">
              确定要删除《{book.title}》吗？此操作不可恢复。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm text-warm-500 hover:bg-warm-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
