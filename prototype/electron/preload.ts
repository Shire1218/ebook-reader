import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的 API
const electronAPI = {
  // 文件对话框
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  
  // 文件系统操作
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('fs:getFileInfo', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:saveFile', filePath, content),
  
  // 应用信息
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  
  // 事件监听
  onFilesOpened: (callback: (filePaths: string[]) => void) => {
    ipcRenderer.on('files-opened', (_event, filePaths) => callback(filePaths));
  },
  
  // 移除监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// 安全地暴露 API 到 window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型定义（供渲染进程使用）
export type ElectronAPI = typeof electronAPI;