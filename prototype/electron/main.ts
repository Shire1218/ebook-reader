import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

// 禁用 GPU 加速（可选，解决某些兼容性问题）
// app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

// 窗口配置
const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  title: '墨卷',
  icon: path.join(__dirname, '../build/icon.ico'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
};

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  // 开发环境加载本地服务器，生产环境加载打包文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置菜单
  createMenu();
}

// 创建应用菜单
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开书籍',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于墨卷',
          click: () => showAboutDialog(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 打开文件对话框
async function openFileDialog() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择书籍文件',
    filters: [
      {
        name: '电子书',
        extensions: ['epub', 'pdf', 'txt', 'mobi'],
      },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    // 通知渲染进程处理文件
    mainWindow.webports.send('files-opened', result.filePaths);
  }
}

// 显示关于对话框
function showAboutDialog() {
  if (!mainWindow) return;

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于墨卷',
    message: '墨卷（Inking）桌面版',
    detail: '版本 0.1.0\n一款简洁的电子书阅读器',
  });
}

// IPC 处理器
function setupIpcHandlers() {
  // 文件对话框
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择书籍文件',
      filters: [
        {
          name: '电子书',
          extensions: ['epub', 'pdf', 'txt', 'mobi'],
        },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    return result.canceled ? null : result.filePaths;
  });

  // 读取文件
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer.toString('base64');
    } catch (error) {
      console.error('读取文件失败:', error);
      return null;
    }
  });

  // 获取文件信息
  ipcMain.handle('fs:getFileInfo', async (_event, filePath: string) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        name: path.basename(filePath),
        size: stats.size,
        path: filePath,
      };
    } catch (error) {
      console.error('获取文件信息失败:', error);
      return null;
    }
  });

  // 保存文件
  ipcMain.handle('fs:saveFile', async (_event, filePath: string, content: string) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('保存文件失败:', error);
      return false;
    }
  });

  // 获取应用路径
  ipcMain.handle('app:getPath', (_event, name: string) => {
    return app.getPath(name as any);
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  setupIpcHandlers();
  createMainWindow();

  // macOS 点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});