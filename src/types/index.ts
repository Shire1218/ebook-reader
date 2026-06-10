// 书籍格式
export type BookFormat = 'epub' | 'pdf' | 'txt';

// 主题类型
export type ThemeType = 'light' | 'dark' | 'sepia' | 'green';

// 视图模式
export type ViewMode = 'grid' | 'list';

// 排序方式
export type SortBy = 'lastRead' | 'title' | 'importTime';

// 书籍元信息
export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  coverUrl: string;
  fileSize: number;
  progress: number;
  currentLocation: string;
  currentChapter: string;
  lastReadTime: number;
  importTime: number;
}

// 阅读偏好
export interface ReadingPreference {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  theme: ThemeType;
  brightness: number;
  viewMode: ViewMode;
}

// 目录项
export interface TocItem {
  id: string;
  label: string;
  href: string;
  children?: TocItem[];
}

// 书签
export interface Bookmark {
  id: string;
  bookId: string;
  location: string;
  chapter: string;
  progress: number;
  note?: string;
  createdAt: number;
}
