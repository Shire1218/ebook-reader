import { isElectron } from './detect';
import { webPlatform } from './web';
import { electronPlatform } from './electron';
import type { PlatformAPI } from './types';

// 根据运行环境选择平台实现
export const platform: PlatformAPI = isElectron() ? electronPlatform : webPlatform;

// 导出类型和工具函数
export { isElectron, getPlatform } from './detect';
export type { PlatformAPI, FileInfo, FilesOpenedCallback } from './types';

// 监听文件打开事件（仅 Electron 环境）
export const onFilesOpened = (callback: (filePaths: string[]) => void) => {
  if (isElectron()) {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onFilesOpened) {
      electronAPI.onFilesOpened(callback);
    }
  }
};