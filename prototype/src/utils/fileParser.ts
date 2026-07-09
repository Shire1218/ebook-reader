import type { Book, BookFormat } from '@/types';

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// 从文件名提取书名（去掉扩展名）
function extractTitle(filename: string): string {
  return filename.replace(/\.(epub|pdf|txt|mobi)$/i, '');
}

// 获取文件格式
function getFormat(filename: string): BookFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'epub' || ext === 'pdf' || ext === 'txt' || ext === 'mobi') {
    return ext;
  }
  return 'txt';
}

// 生成默认封面颜色（基于书名哈希）
function generateCoverColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

// 解析文件为书籍对象
export function parseFileToBook(file: File): Book {
  const title = extractTitle(file.name);
  const format = getFormat(file.name);

  return {
    id: generateId(),
    title,
    author: '未知作者',
    format,
    coverUrl: generateCoverColor(title),
    fileSize: file.size,
    progress: 0,
    currentLocation: '',
    currentChapter: '',
    lastReadTime: Date.now(),
    importTime: Date.now(),
    category: '',
  };
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 格式化时间
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 验证文件格式是否支持
export function isSupportedFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['epub', 'pdf', 'txt', 'mobi'].includes(ext || '');
}
