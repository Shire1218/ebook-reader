import type { PlatformAPI, FileInfo } from './types';

// Web 端平台实现（使用 IndexedDB）
export const webPlatform: PlatformAPI = {
  // Web 端不支持原生文件对话框，使用 input[type=file] 替代
  openFileDialog: async () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.epub,.pdf,.txt,.mobi';
      input.multiple = true;
      
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Web 端返回文件名而非路径
          const fileNames = Array.from(files).map(f => f.name);
          resolve(fileNames);
        } else {
          resolve(null);
        }
      };
      
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
  
  // Web 端读取文件（通过 IndexedDB）
  readFile: async (fileName: string) => {
    // Web 端通过 IndexedDB 存储文件，这里返回文件名
    // 实际读取需要通过 bookStore 或 db 工具
    console.warn('Web 端 readFile 需要通过 IndexedDB 处理:', fileName);
    return null;
  },
  
  // Web 端获取文件信息
  getFileInfo: async (fileName: string) => {
    return {
      name: fileName,
      size: 0, // Web 端无法直接获取文件大小
      path: fileName, // Web 端使用文件名作为标识
    };
  },
  
  // Web 端保存文件（通过 IndexedDB）
  saveFile: async (fileName: string, content: string) => {
    console.warn('Web 端 saveFile 需要通过 IndexedDB 处理:', fileName);
    return false;
  },
  
  // Web 端获取路径
  getPath: async (name: string) => {
    console.warn('Web 端不支持 getPath:', name);
    return '';
  },
};