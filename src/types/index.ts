// 书籍格式
export type BookFormat = 'epub' | 'pdf' | 'txt' | 'mobi';

// 主题类型
export type ThemeType = 'light' | 'dark' | 'sepia' | 'green';

// 视图模式
export type ViewMode = 'grid' | 'list';

// 排序方式
export type SortBy = 'lastRead' | 'title' | 'importTime';

// 文本对齐方式
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

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
  category: string;             // 书籍分类
}

// 阅读偏好
export interface ReadingPreference {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  theme: ThemeType;
  brightness: number;
  viewMode: ViewMode;
  textAlignment: TextAlignment;   // 文本对齐方式
  paragraphSpacing: number;       // 段间距 (em)
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

// 高亮颜色
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

// 标注/高亮
export interface Highlight {
  id: string;
  bookId: string;
  location: string;           // 位置信息（与 Book.currentLocation 格式一致）
  text: string;               // 选中的文本内容
  color: HighlightColor;      // 高亮颜色
  note?: string;              // 批注/笔记
  chapter: string;            // 章节名称
  createdAt: number;
  paragraphIndex?: number;    // 段落索引（TXT 格式精确位置）
  offsetInParagraph?: number; // 在段落中的偏移位置（TXT 格式精确位置）
}
