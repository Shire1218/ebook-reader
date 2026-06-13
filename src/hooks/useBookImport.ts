import { useCallback } from 'react';
import { useBookStore } from '@/stores/bookStore';
import { useAuthStore } from '@/stores/authStore';
import { parseFileToBook, isSupportedFormat } from '@/utils/fileParser';
import { saveBookFile } from '@/utils/db';
import { apiUpload } from '@/utils/api';

const ACCEPTED_FORMATS = '.epub,.pdf,.txt,.mobi';

export function useBookImport() {
  const addBook = useBookStore((s) => s.addBook);

  // 处理文件导入
  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter((f) => isSupportedFormat(f.name));
      const isCloud = useAuthStore.getState().isAuthenticated;

      for (const file of validFiles) {
        const book = parseFileToBook(file);
        // 先保存文件二进制数据到 IndexedDB，确保文件数据不会丢失
        const arrayBuffer = await file.arrayBuffer();
        await saveBookFile(book.id, arrayBuffer);
        // 再保存书籍元信息（bookStore 内部会处理云端同步）
        await addBook(book);

        // 云端模式下，额外上传文件到服务端
        if (isCloud) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('book', JSON.stringify(book));
            await apiUpload('/api/books', formData);
          } catch {
            // 上传失败不影响本地导入
          }
        }
      }

      return validFiles.length;
    },
    [addBook]
  );

  // 打开文件选择对话框
  const openFilePicker = useCallback(() => {
    return new Promise<FileList | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = ACCEPTED_FORMATS;
      input.onchange = () => resolve(input.files);
      input.click();
    });
  }, []);

  // 通过文件选择器导入
  const importFromFilePicker = useCallback(async () => {
    const files = await openFilePicker();
    if (files) {
      return importFiles(files);
    }
    return 0;
  }, [openFilePicker, importFiles]);

  // 新建空 TXT 文件
  const createEmptyTxtBook = useCallback(
    async (title: string) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      // 基于书名生成封面颜色
      let hash = 0;
      for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;

      const book = {
        id,
        title,
        author: '未知作者',
        format: 'txt' as const,
        coverUrl: `hsl(${hue}, 45%, 55%)`,
        fileSize: 0,
        progress: 0,
        currentLocation: '',
        currentChapter: '',
        lastReadTime: Date.now(),
        importTime: Date.now(),
        category: '',
      };

      await addBook(book);
      // 创建空的 UTF-8 文本内容
      const encoder = new TextEncoder();
      const data = encoder.encode('').buffer;
      await saveBookFile(id, data);

      return book;
    },
    [addBook]
  );

  return {
    importFiles,
    importFromFilePicker,
    createEmptyTxtBook,
    acceptedFormats: ACCEPTED_FORMATS,
  };
}
