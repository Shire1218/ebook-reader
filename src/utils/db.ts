import type { Book, ReadingPreference, Bookmark, Highlight } from '@/types';

const DB_NAME = 'ebook-reader-db';
const DB_VERSION = 9;
const BOOKS_STORE = 'books';
const PREFERENCES_STORE = 'preferences';
const FILES_STORE = 'files';
const BOOKMARKS_STORE = 'bookmarks';
const HIGHLIGHTS_STORE = 'highlights';

// 打开 IndexedDB 数据库
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        const store = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
        store.createIndex('importTime', 'importTime', { unique: false });
        store.createIndex('lastReadTime', 'lastReadTime', { unique: false });
      }
      if (!db.objectStoreNames.contains(PREFERENCES_STORE)) {
        db.createObjectStore(PREFERENCES_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
        const bookmarkStore = db.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' });
        bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
        bookmarkStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(HIGHLIGHTS_STORE)) {
        const highlightStore = db.createObjectStore(HIGHLIGHTS_STORE, { keyPath: 'id' });
        highlightStore.createIndex('bookId', 'bookId', { unique: false });
        highlightStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 删除旧的 textEdits 存储（如果存在）
      if (db.objectStoreNames.contains('textEdits')) {
        db.deleteObjectStore('textEdits');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 获取所有书籍
export async function getAllBooks(): Promise<Book[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readonly');
    const store = tx.objectStore(BOOKS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 添加书籍
export async function addBook(book: Book): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readwrite');
    const store = tx.objectStore(BOOKS_STORE);
    store.put(book);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 更新书籍
export async function updateBook(book: Book): Promise<void> {
  return addBook(book);
}

// 删除书籍（同时删除文件数据、关联书签和标注）
export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BOOKS_STORE, FILES_STORE, BOOKMARKS_STORE, HIGHLIGHTS_STORE], 'readwrite');
    tx.objectStore(BOOKS_STORE).delete(id);
    tx.objectStore(FILES_STORE).delete(id);
    // 清理关联书签
    const bookmarkStore = tx.objectStore(BOOKMARKS_STORE);
    const bookmarkIndex = bookmarkStore.index('bookId');
    const bookmarkRequest = bookmarkIndex.openCursor(id);
    bookmarkRequest.onsuccess = () => {
      const cursor = bookmarkRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    // 清理关联标注
    const highlightStore = tx.objectStore(HIGHLIGHTS_STORE);
    const highlightIndex = highlightStore.index('bookId');
    const highlightRequest = highlightIndex.openCursor(id);
    highlightRequest.onsuccess = () => {
      const cursor = highlightRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 保存书籍文件数据
export async function saveBookFile(bookId: string, data: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    store.put({ bookId, data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 读取书籍文件数据
export async function getBookFile(bookId: string): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readonly');
    const store = tx.objectStore(FILES_STORE);
    const request = store.get(bookId);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.data : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// 将 ArrayBuffer 转为 Blob URL（epub.js 需要 URL）
export function arrayBufferToBlobUrl(data: ArrayBuffer, mimeType: string): string {
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

// 保存阅读偏好
export async function savePreference(key: string, value: ReadingPreference): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFERENCES_STORE, 'readwrite');
    const store = tx.objectStore(PREFERENCES_STORE);
    store.put({ key, ...value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 读取阅读偏好
export async function loadPreference(key: string): Promise<ReadingPreference | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFERENCES_STORE, 'readonly');
    const store = tx.objectStore(PREFERENCES_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key: _key, ...pref } = result;
        resolve(pref as ReadingPreference);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// 添加书签
export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
    const store = tx.objectStore(BOOKMARKS_STORE);
    store.put(bookmark);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 获取指定书籍的所有书签
export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS_STORE, 'readonly');
    const store = tx.objectStore(BOOKMARKS_STORE);
    const index = store.index('bookId');
    const request = index.getAll(bookId);
    request.onsuccess = () => {
      const bookmarks = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(bookmarks);
    };
    request.onerror = () => reject(request.error);
  });
}

// 删除书签
export async function deleteBookmark(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
    const store = tx.objectStore(BOOKMARKS_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 添加标注
export async function addHighlight(highlight: Highlight): Promise<void> {
  const db = await openDB();
  // 检查 highlights 存储是否存在
  if (!db.objectStoreNames.contains(HIGHLIGHTS_STORE)) {
    throw new Error('数据库缺少 highlights 存储，请刷新页面重试');
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
    const store = tx.objectStore(HIGHLIGHTS_STORE);
    store.put(highlight);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 获取指定书籍的所有标注
export async function getHighlights(bookId: string): Promise<Highlight[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HIGHLIGHTS_STORE, 'readonly');
    const store = tx.objectStore(HIGHLIGHTS_STORE);
    const index = store.index('bookId');
    const request = index.getAll(bookId);
    request.onsuccess = () => {
      const highlights = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(highlights);
    };
    request.onerror = () => reject(request.error);
  });
}

// 更新标注（编辑批注/颜色）
export async function updateHighlight(highlight: Highlight): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
    const store = tx.objectStore(HIGHLIGHTS_STORE);
    store.put(highlight);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 删除标注
export async function deleteHighlight(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
    const store = tx.objectStore(HIGHLIGHTS_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
