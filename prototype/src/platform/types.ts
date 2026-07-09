// 平台 API 类型定义
export interface PlatformAPI {
  // 文件操作
  openFileDialog: () => Promise<string[] | null>;
  readFile: (filePath: string) => Promise<string | null>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  
  // 应用信息
  getPath: (name: string) => Promise<string>;
}

export interface FileInfo {
  name: string;
  size: number;
  path: string;
}

// 文件打开事件回调类型
export type FilesOpenedCallback = (filePaths: string[]) => void;