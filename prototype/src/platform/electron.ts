import type { PlatformAPI, FileInfo } from './types';

// Electron 端平台实现
export const electronPlatform: PlatformAPI = {
  // 打开文件对话框
  openFileDialog: async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return null;
    return electronAPI.openFileDialog();
  },
  
  // 读取文件
  readFile: async (filePath: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return null;
    return electronAPI.readFile(filePath);
  },
  
  // 获取文件信息
  getFileInfo: async (filePath: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return null;
    return electronAPI.getFileInfo(filePath);
  },
  
  // 保存文件
  saveFile: async (filePath: string, content: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return false;
    return electronAPI.saveFile(filePath, content);
  },
  
  // 获取应用路径
  getPath: async (name: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return '';
    return electronAPI.getPath(name);
  },
};