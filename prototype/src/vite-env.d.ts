/// <reference types="vite/client" />

// Electron API 类型声明
interface ElectronAPI {
  openFileDialog: () => Promise<string[] | null>;
  readFile: (filePath: string) => Promise<string | null>;
  getFileInfo: (filePath: string) => Promise<{ name: string; size: number; path: string } | null>;
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  getPath: (name: string) => Promise<string>;
  onFilesOpened: (callback: (filePaths: string[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};