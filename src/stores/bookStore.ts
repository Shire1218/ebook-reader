import { create } from 'zustand';
import type { Book, SortBy } from '@/types';
import { getAllBooks, addBook as dbAddBook, updateBook as dbUpdateBook, deleteBook as dbDeleteBook } from '@/utils/db';

interface BookState {
  books: Book[];
  isLoading: boolean;
  searchQuery: string;
  sortBy: SortBy;
  categoryFilter: string;     // 当前分类筛选（空字符串表示全部）

  // 操作
  loadBooks: () => Promise<void>;
  addBook: (book: Book) => Promise<void>;
  updateBook: (book: Book) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setCategoryFilter: (category: string) => void;
  deleteCategory: (category: string) => Promise<void>;
  getFilteredBooks: () => Book[];
  getCategories: () => string[];
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  isLoading: false,
  searchQuery: '',
  sortBy: 'importTime',
  categoryFilter: '',

  loadBooks: async () => {
    set({ isLoading: true });
    try {
      const books = await getAllBooks();
      set({ books, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addBook: async (book: Book) => {
    await dbAddBook(book);
    set((state) => ({ books: [...state.books, book] }));
  },

  updateBook: async (book: Book) => {
    await dbUpdateBook(book);
    set((state) => ({
      books: state.books.map((b) => (b.id === book.id ? book : b)),
    }));
  },

  removeBook: async (id: string) => {
    await dbDeleteBook(id);
    set((state) => ({ books: state.books.filter((b) => b.id !== id) }));
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSortBy: (sortBy: SortBy) => {
    set({ sortBy });
  },

  setCategoryFilter: (category: string) => {
    set({ categoryFilter: category });
  },

  deleteCategory: async (category: string) => {
    const { books } = get();
    const affected = books.filter((b) => b.category === category);
    for (const book of affected) {
      const updated = { ...book, category: '' };
      await dbUpdateBook(updated);
    }
    set((state) => ({
      books: state.books.map((b) => (b.category === category ? { ...b, category: '' } : b)),
      categoryFilter: state.categoryFilter === category ? '' : state.categoryFilter,
    }));
  },

  getCategories: () => {
    const { books } = get();
    const categories = new Set<string>();
    for (const book of books) {
      if (book.category) {
        categories.add(book.category);
      }
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  },

  getFilteredBooks: () => {
    const { books, searchQuery, sortBy, categoryFilter } = get();

    let filtered = books;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = books.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      filtered = filtered.filter((b) => b.category === categoryFilter);
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'lastRead':
          return b.lastReadTime - a.lastReadTime;
        case 'title':
          return a.title.localeCompare(b.title, 'zh-CN');
        case 'importTime':
        default:
          return b.importTime - a.importTime;
      }
    });
  },
}));
