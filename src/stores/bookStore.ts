import { create } from 'zustand';
import type { Book, SortBy } from '@/types';
import { getAllBooks, addBook as dbAddBook, updateBook as dbUpdateBook, deleteBook as dbDeleteBook } from '@/utils/db';

interface BookState {
  books: Book[];
  isLoading: boolean;
  searchQuery: string;
  sortBy: SortBy;

  // 操作
  loadBooks: () => Promise<void>;
  addBook: (book: Book) => Promise<void>;
  updateBook: (book: Book) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  getFilteredBooks: () => Book[];
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  isLoading: false,
  searchQuery: '',
  sortBy: 'importTime',

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

  getFilteredBooks: () => {
    const { books, searchQuery, sortBy } = get();

    let filtered = books;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = books.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
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
