// 检测是否在 Electron 环境中运行
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof (window as any).electronAPI !== 'undefined';
};

// 获取平台信息
export const getPlatform = () => {
  if (isElectron()) {
    return 'electron';
  }
  return 'web';
};