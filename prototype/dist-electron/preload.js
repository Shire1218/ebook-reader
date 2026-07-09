"use strict";
const electron = require("electron");
const electronAPI = {
  // 文件对话框
  openFileDialog: () => electron.ipcRenderer.invoke("dialog:openFile"),
  // 文件系统操作
  readFile: (filePath) => electron.ipcRenderer.invoke("fs:readFile", filePath),
  getFileInfo: (filePath) => electron.ipcRenderer.invoke("fs:getFileInfo", filePath),
  saveFile: (filePath, content) => electron.ipcRenderer.invoke("fs:saveFile", filePath, content),
  // 应用信息
  getPath: (name) => electron.ipcRenderer.invoke("app:getPath", name),
  // 事件监听
  onFilesOpened: (callback) => {
    electron.ipcRenderer.on("files-opened", (_event, filePaths) => callback(filePaths));
  },
  // 移除监听器
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
