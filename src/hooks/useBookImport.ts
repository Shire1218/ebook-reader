import { useCallback } from 'react';
import { useBookStore } from '@/stores/bookStore';
import { parseFileToBook, isSupportedFormat } from '@/utils/fileParser';
import { saveBookFile } from '@/utils/db';

const ACCEPTED_FORMATS = '.epub,.pdf,.txt,.mobi';

export function useBookImport() {
  const addBook = useBookStore((s) => s.addBook);

  // 处理文件导入
  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter((f) => isSupportedFormat(f.name));

      for (const file of validFiles) {
        const book = parseFileToBook(file);
        // 保存书籍元信息
        await addBook(book);
        // 保存文件二进制数据到 IndexedDB
        const arrayBuffer = await file.arrayBuffer();
        await saveBookFile(book.id, arrayBuffer);
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

  return {
    importFiles,
    importFromFilePicker,
    acceptedFormats: ACCEPTED_FORMATS,
  };
}
