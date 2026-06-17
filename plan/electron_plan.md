# 墨卷（Inking）Electron 桌面端实施方案

## 一、方案概述

### 1.1 项目背景

墨卷（Inking）是一款基于 React + TypeScript + Vite 的全栈电子书阅读器 Web 应用，支持 EPUB、PDF、TXT、MOBI 四种格式。前端使用 Zustand 状态管理、IndexedDB 本地存储，后端使用 Express + Prisma + SQLite。

本方案将现有 Web 应用迁移为基于 Electron 的跨平台桌面应用，**重点平衡安装包大小与性能优化**，同时保证功能完整性、可维护性和可扩展性。

### 1.2 核心目标

| 目标 | 量化指标 | 优先级 |
|------|---------|--------|
| 安装包体积 | NSIS 安装包 < 80MB，便携版 < 120MB | P0 |
| 启动速度 | 冷启动到可交互 < 2s（主流配置） | P0 |
| 内存占用 | 空闲 < 180MB，阅读中 < 400MB | P0 |
| 功能完整性 | 100% Web 端功能可用 | P0 |
| 可维护性 | 模块化架构，主进程/渲染进程清晰分离 | P1 |
| 可扩展性 | 插件机制，预留扩展接口 | P1 |

### 1.3 技术选型总览

| 类别 | 选型 | 版本 | 选型理由 |
|------|------|------|---------|
| 桌面框架 | Electron | 33+ | 生态最成熟，前端代码 95%+ 复用 |
| 打包工具 | electron-builder | 25+ | 支持 NSIS/便携版，配置灵活 |
| 自动更新 | electron-updater | 6+ | 与 electron-builder 深度集成 |
| 本地数据库 | better-sqlite3 | 11+ | 同步 API 性能优异，替代 Prisma+SQLite |
| 进程管理 | - | - | 主进程内嵌 Express 后端 |
| IPC 通信 | Electron IPC | - | 原生支持，类型安全 |
| 构建工具 | Vite（保留） | 6.0 | 复用现有构建配置 |
| 前端框架 | React + TypeScript（保留） | 18.3 / 5.6 | 零改动迁移 |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron 应用                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    主进程 (Main Process)                   │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ 窗口管理器   │  │ 原生功能层    │  │ Express 后端   │  │   │
│  │  │ WindowManager│  │ NativeModule │  │ (内嵌服务)     │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ 菜单/托盘   │  │ 自动更新     │  │ 文件关联处理   │  │   │
│  │  │ MenuManager │  │ AutoUpdater  │  │ FileAssociation│  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │              数据层 (Data Layer)                   │    │   │
│  │  │  ┌────────────┐  ┌───────────┐  ┌─────────────┐  │    │   │
│  │  │  │better-sqlite3│ │ 文件系统  │  │ 配置存储    │  │    │   │
│  │  │  │ (元数据)    │  │ (书籍文件)│  │ (settings)  │  │    │   │
│  │  │  └────────────┘  └───────────┘  └─────────────┘  │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │ IPC                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  渲染进程 (Renderer Process)               │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │              React 应用（现有前端代码）             │    │   │
│  │  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐   │    │   │
│  │  │  │ 页面路由 │ │ 状态管理 │ │ 阅读器组件       │   │    │   │
│  │  │  │ Router  │ │ Zustand  │ │ EPUB/PDF/TXT/MOBI│   │    │   │
│  │  │  └─────────┘ └──────────┘ └──────────────────┘   │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │           Preload 桥接层 (Context Bridge)          │    │   │
│  │  │  electronAPI: { dialog, fs, db, app, updater }    │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 进程职责划分

#### 主进程职责

| 模块 | 职责 | 对应文件 |
|------|------|---------|
| WindowManager | 窗口创建/管理/状态持久化 | `electron/main/window.ts` |
| MenuManager | 原生菜单栏、右键菜单 | `electron/main/menu.ts` |
| TrayManager | 系统托盘图标和菜单 | `electron/main/tray.ts` |
| FileAssociation | 文件关联、命令行参数处理 | `electron/main/file-association.ts` |
| AutoUpdater | 自动更新检测和安装 | `electron/main/updater.ts` |
| IpcHandlers | IPC 通道注册和处理 | `electron/main/ipc/` |
| ExpressServer | 内嵌后端 API 服务 | `electron/main/server/` |
| DataStore | SQLite 数据库操作 | `electron/main/data/` |
| ConfigStore | 应用配置持久化 | `electron/main/config.ts` |

#### 渲染进程职责

| 模块 | 职责 | 变更范围 |
|------|------|---------|
| React 应用 | 所有 UI 和业务逻辑 | 零改动 |
| Preload 桥接 | 安全暴露主进程 API | 新增 |
| 平台适配层 | 统一 Web/桌面端 API 调用 | 新增 |

### 2.3 数据流架构

```
用户操作（前端）
    │
    ▼
┌─────────────────┐
│ Zustand Store   │ ← 状态管理（保留现有逻辑）
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│ IndexedDB │ │ electronAPI │
│ (Web模式) │ │ (桌面模式)  │
└────────┘ └──────┬───────┘
                  │ IPC
                  ▼
         ┌────────────────┐
         │   主进程数据层   │
         │ ┌────────────┐ │
         │ │ SQLite DB  │ │  ← 书籍元数据、书签、标注
         │ └────────────┘ │
         │ ┌────────────┐ │
         │ │ 文件系统   │ │  ← 书籍文件（epub/pdf/txt/mobi）
         │ └────────────┘ │
         │ ┌────────────┐ │
         │ │ Express API│ │  ← 云端同步（可选）
         │ └────────────┘ │
         └────────────────┘
```

### 2.4 目录结构设计

```
e:\chrome\book\
├── electron/                          # Electron 主进程代码
│   ├── main.ts                        # 主进程入口
│   ├── preload.ts                     # 预加载脚本
│   ├── main/
│   │   ├── window.ts                  # 窗口管理器
│   │   ├── menu.ts                    # 原生菜单
│   │   ├── tray.ts                    # 系统托盘
│   │   ├── updater.ts                 # 自动更新
│   │   ├── file-association.ts        # 文件关联
│   │   ├── config.ts                  # 配置存储
│   │   └── ipc/
│   │       ├── index.ts               # IPC 通道注册入口
│   │       ├── dialog.ts              # 文件对话框
│   │       ├── fs.ts                  # 文件系统操作
│   │       ├── db.ts                  # 数据库操作
│   │       ├── app.ts                 # 应用控制
│   │       └── updater.ts             # 更新相关 IPC
│   ├── server/
│   │   ├── index.ts                   # Express 服务启动
│   │   ├── routes/                    # 复用现有路由（符号链接或复制）
│   │   └── middleware/                # 复用现有中间件
│   └── data/
│       ├── database.ts                # better-sqlite3 封装
│       ├── migrations/                # 数据库迁移脚本
│       └── schema.sql                 # 建表 SQL
├── src/                               # 前端代码（基本不变）
│   ├── ...                            # 现有代码保持不变
│   └── platform/                      # 新增：平台抽象层
│       ├── index.ts                   # 统一接口导出
│       ├── types.ts                   # 平台 API 类型定义
│       ├── web.ts                     # Web 端实现（IndexedDB）
│       ├── electron.ts                # Electron 端实现（IPC）
│       └── detect.ts                  # 运行环境检测
├── build/                             # 打包资源
│   ├── icon.ico                       # Windows 图标（256x256）
│   ├── icon.png                       # Linux/macOS 图标
│   ├── nsis/
│   │   └── installer.nsh              # NSIS 自定义脚本
│   └── fonts/                         # 本地字体
│       └── NotoSerifSC-Regular.otf
├── resources/                         # electron-builder 额外资源
│   └── extra/                         # 打包到安装目录的额外文件
├── package.json                       # 合并后的依赖
├── electron-builder.config.js         # 打包配置
├── vite.config.ts                     # 构建配置（微调）
└── tsconfig.json                      # TypeScript 配置
```

---

## 三、安装包体积优化策略

### 3.1 体积构成分析

Electron 安装包体积主要由以下部分构成：

| 组成部分 | 典型大小 | 可优化空间 |
|---------|---------|-----------|
| Electron 运行时（Chromium + Node.js） | 100-150MB | 中（裁剪未使用模块） |
| 应用代码（asar 包） | 5-20MB | 高（代码分割+压缩） |
| 字体文件 | 5-15MB | 中（子集化） |
| 原生模块（better-sqlite3 等） | 2-5MB | 低 |
| Express 后端依赖 | 3-8MB | 高（精简依赖） |
| 其他资源（图标等） | < 1MB | 低 |

### 3.2 优化策略详解

#### 策略 1：Electron 运行时精简

```javascript
// electron-builder.config.js
module.exports = {
  electronDownload: {
    // 仅下载当前平台的二进制文件
    platform: 'win32',
    arch: 'x64',
  },
  // 排除不必要的 Electron 模块
  asarUnpack: [
    '**/*.node',           // 原生模块不解压
    '**/build/Release/**', // 释放文件不解压
  ],
  // 使用 asar 打包（压缩应用代码）
  asar: true,
  // 启用智能压缩
  compression: 'maximum',  // 'normal' | 'maximum' | 'store'
};
```

**裁剪未使用的 Chromium 组件：**

```javascript
// electron/main.ts - 启动参数优化
app.commandLine.appendSwitch('disable-gpu-compositing');      // 如不需要 GPU 加速
app.commandLine.appendSwitch('disable-mojo-local-storage');    // 减少 Mojo 开销
app.commandLine.appendSwitch('no-sandbox');                    // 桌面应用无需沙箱（安全权衡）
```

> **注意**：裁剪 Chromium 组件需要自定义 Electron 构建，复杂度较高。建议初期不做裁剪，通过其他方式控制体积。如果最终体积超标，可考虑使用 [electron-minifier](https://github.com/nicedoc/electron-minifier) 或自定义 Electron 构建。

#### 策略 2：应用代码优化

```typescript
// vite.config.ts - 构建优化
export default defineConfig({
  build: {
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 启用源码映射（生产环境可关闭）
    sourcemap: false,
    // 压缩选项
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // 移除 console
        drop_debugger: true,   // 移除 debugger
        pure_funcs: ['console.log', 'console.info'], // 移除特定函数调用
      },
    },
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'epubjs': ['epubjs'],
          'pdfjs': ['pdfjs-dist'],
          'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
    // 目标环境（Electron 33 基于 Chromium 130）
    target: 'chrome130',
    // 减少 chunk 大小
    chunkSizeWarningLimit: 500,
  },
});
```

**Tree-shaking 优化：**

```typescript
// 优化前（可能导致整个库被打包）
import * as lucideIcons from 'lucide-react';

// 优化后（仅打包使用的图标）
import { BookOpen, Settings, Search } from 'lucide-react';
```

#### 策略 3：字体文件优化

```bash
# 使用 fonttools 进行字体子集化（仅保留中文字符集中的常用字符）
# 安装 fonttools
pip install fonttools brotli zopfli

# 子集化 Noto Serif SC（从 15MB 减少到 2-3MB）
pyftsubset NotoSerifSC-Regular.otf \
  --text-file=chinese-common-chars.txt \
  --output-file=NotoSerifSC-Subset.otf \
  --flavor=woff2
```

**chinese-common-chars.txt** 包含 GB2312 常用汉字（6763 个）+ 标点符号 + 数字字母，可将字体从 15MB 压缩到 2-3MB。

**备选方案**：使用系统自带的宋体/微软雅黑作为 fallback，仅内嵌最小字符集。

#### 策略 4：依赖精简

```json
// package.json - 生产依赖 vs 开发依赖 严格分离
{
  "dependencies": {
    // 运行时必需
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.0",
    "epubjs": "^0.3.93",
    "pdfjs-dist": "^5.6.205",
    "lucide-react": "^0.460.0",
    // Electron 主进程运行时必需
    "better-sqlite3": "^11.0.0",
    "express": "^4.21.2",
    "@prisma/client": "^6.9.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    // 仅开发时使用
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.6.3",
    "tailwindcss": "^3.4.15",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.2.1",
    "wait-on": "^8.0.0"
  }
}
```

**Express 依赖精简方案（可选）：**

如果体积仍然超标，可考虑将 Express 替换为更轻量的框架：

| 框架 | 大小 | 兼容性 | 迁移工作量 |
|------|------|--------|-----------|
| Express（当前） | ~5MB | 完全兼容 | 0 |
| Fastify | ~3MB | 需调整路由语法 | 中 |
| Koa | ~2MB | 需调整中间件 | 中 |
| 原生 http 模块 | 0 | 需重写路由层 | 高 |

**建议**：初期保留 Express，体积超标时再考虑替换。

#### 策略 5：打包配置优化

```javascript
// electron-builder.config.js
module.exports = {
  appId: 'com.inking.reader',
  productName: '墨卷',
  copyright: 'Copyright © 2024 Inking',

  // 目录配置
  directories: {
    output: 'release',
    buildResources: 'build',
  },

  // 文件过滤
  files: [
    'dist/**/*',              // Vite 构建产物
    'electron/**/*',          // Electron 主进程代码
    'server/dist/**/*',       // 后端编译产物
    'package.json',
    '!**/node_modules/.cache', // 排除缓存
    '!**/*.map',               // 排除源码映射
    '!**/*.ts',                // 排除 TypeScript 源文件（保留编译产物）
    '!**/{.eslintignore,.eslintrc,.prettierrc,*.config.js}', // 排除配置文件
  ],

  // asar 打包配置
  asar: {
    smartUnpack: true,  // 智能解包（原生模块等）
  },

  // Windows 配置
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],  // 仅 64 位（减少 50% 体积）
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    // 图标
    icon: 'build/icon.ico',
    // 文件关联
    fileAssociations: [
      { ext: 'epub', name: 'EPUB 电子书', mimeType: 'application/epub+zip' },
      { ext: 'pdf', name: 'PDF 文档', mimeType: 'application/pdf' },
      { ext: 'txt', name: '文本文件', mimeType: 'text/plain' },
      { ext: 'mobi', name: 'MOBI 电子书', mimeType: 'application/x-mobipocket-ebook' },
    ],
  },

  // NSIS 安装包配置
  nsis: {
    oneClick: false,          // 非一键安装（允许选择安装路径）
    perMachine: false,        // 用户级安装（无需管理员权限）
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: '墨卷',
    // 使用 LZMA 压缩（最高压缩率）
    compressor: 'lzma',
    // 自定义安装脚本
    include: 'build/nsis/installer.nsh',
  },

  // 额外资源（不打包进 asar）
  extraResources: [
    {
      from: 'build/fonts',
      to: 'fonts',
      filter: ['**/*.otf', '**/*.ttf'],
    },
  ],
};
```

### 3.3 体积优化效果预估

| 优化措施 | 预估节省 | 累计体积 |
|---------|---------|---------|
| 基准（未优化） | - | ~200MB |
| 仅打包 x64 | -30MB | ~170MB |
| asar + LZMA 压缩 | -20MB | ~150MB |
| 字体子集化 | -10MB | ~140MB |
| 移除 console/源码映射 | -5MB | ~135MB |
| 排除开发文件/配置 | -5MB | ~130MB |
| Tree-shaking 优化 | -5MB | ~125MB |
| **最终预估** | **-75MB** | **~125MB** |

> **说明**：Electron 运行时（Chromium + Node.js）是体积的主要来源（约 100-120MB），这部分无法大幅压缩。125MB 的安装包在 Electron 应用中属于合理范围（VS Code 约 90MB，Discord 约 150MB）。

**进一步压缩方案（如需 < 80MB）：**
1. 使用自定义 Electron 构建（裁剪未使用的 Chromium 组件）→ 可节省 30-50MB
2. 将 Express 后端替换为轻量方案 → 可节省 3-5MB
3. 使用 UPX 压缩原生模块 → 可节省 5-10MB
4. 考虑使用 Tauri 作为替代方案（安装包 < 20MB）

---

## 四、性能优化策略

### 4.1 启动速度优化

#### 启动流程优化

```
优化前启动流程：
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐
│ Electron│ -> │ 加载 HTML │ -> │ 解析 JS │ -> │ 渲染 UI  │ -> │ 可交互  │
│  启动   │    │  + CSS   │    │  + 初始化│    │          │    │         │
│  800ms  │    │  200ms   │    │  500ms   │    │  300ms   │    │ 1800ms  │
└─────────┘    └──────────┘    └─────────┘    └──────────┘    └─────────┘

优化后启动流程：
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐
│ Electron│ -> │ 显示骨架  │ -> │ 并行加载 │ -> │ 增量渲染 │ -> │ 可交互  │
│  启动   │    │ 屏/启动图 │    │ 关键资源 │    │          │    │ 1200ms  │
│  600ms  │    │   0ms    │    │  400ms   │    │  200ms   │    │         │
└─────────┘    └──────────┘    └─────────┘    └──────────┘    └─────────┘
```

#### 具体优化措施

```typescript
// electron/main/window.ts
import { BrowserWindow } from 'electron';
import path from 'path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // 启动优化：初始不显示，准备好后再显示
    show: false,
    // 使用原生标题栏（避免自定义标题栏的额外渲染开销）
    titleBarStyle: 'default',
    // 启用硬件加速
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 禁用不必要的 Web 功能
      webSecurity: true,
      // 启用 GPU 光栅化
      enableWebSQL: false,
    },
    // 窗口图标
    icon: path.join(__dirname, '../build/icon.png'),
    // 窗口标题
    title: '墨卷',
  });

  // 就绪后再显示（避免白屏闪烁）
  win.once('ready-to-show', () => {
    win.show();
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5174');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}
```

**V8 代码缓存优化：**

```typescript
// electron/main/window.ts - 启用 V8 代码缓存
const win = new BrowserWindow({
  webPreferences: {
    // 启用 V8 代码缓存（第二次启动时 JS 解析速度提升 20-40%）
    v8CacheOptions: 'bypassHeatCheck',
  },
});
```

**预加载关键数据：**

```typescript
// electron/main.ts - 在主进程启动时预加载数据
app.whenReady().then(async () => {
  // 并行执行：创建窗口 + 预加载数据
  const [win] = await Promise.all([
    createMainWindow(),
    preloadBookList(),     // 预加载书籍列表到内存
    initDatabase(),        // 初始化数据库连接
  ]);
});
```

### 4.2 内存占用优化

#### 内存管理策略

```typescript
// src/platform/electron.ts - 文件系统操作（替代 IndexedDB 存储大文件）
import { readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { app } from 'electron';

// 书籍文件存储目录
const BOOKS_DIR = path.join(app.getPath('userData'), 'books');

// 流式读取大文件（避免一次性加载到内存）
export async function readBookFile(bookId: string): Promise<Buffer> {
  const filePath = path.join(BOOKS_DIR, bookId);
  // 使用流式读取，内存占用恒定
  return readFile(filePath);
}

// 写入书籍文件（流式写入）
export async function writeBookFile(bookId: string, data: Buffer): Promise<void> {
  const filePath = path.join(BOOKS_DIR, bookId);
  await writeFile(filePath, data);
}

// 删除书籍文件
export async function deleteBookFile(bookId: string): Promise<void> {
  const filePath = path.join(BOOKS_DIR, bookId);
  await unlink(filePath);
}
```

**内存监控与告警：**

```typescript
// electron/main/memory-monitor.ts
import { app } from 'electron';

// 定期监控内存使用
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);

  // 内存告警阈值
  if (rssMB > 500) {
    console.warn(`[Memory] RSS 内存过高: ${rssMB}MB`);
    // 触发垃圾回收（如果启用了 --expose-gc）
    if (global.gc) {
      global.gc();
    }
  }
}, 30000); // 每 30 秒检查一次
```

**渲染进程内存优化：**

```typescript
// src/components/Reader/EpubReader.tsx - 阅读器实例管理
import { useEffect, useRef } from 'react';
import ePub from 'epubjs';

export function EpubReader({ bookId, fileUrl }) {
  const bookRef = useRef(null);

  useEffect(() => {
    // 创建阅读器实例
    bookRef.current = ePub(fileUrl);

    return () => {
      // 组件卸载时销毁实例，释放内存
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [fileUrl]);

  // ...
}
```

### 4.3 运行流畅度优化

#### GPU 加速配置

```typescript
// electron/main.ts - GPU 加速配置
import { app } from 'electron';

// 启用硬件加速（如果可用）
app.enableHardwareAcceleration();

// GPU 进程配置
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');  // 减少 GPU 内存拷贝
app.commandLine.appendSwitch('ignore-gpu-blacklist');
```

#### 渲染优化

```typescript
// vite.config.ts - 构建目标优化
export default defineConfig({
  build: {
    // Electron 33 基于 Chromium 130
    target: 'chrome130',
    // 启用 CSS 代码分割
    cssCodeSplit: true,
  },
});
```

**React 渲染优化（已有，保留）：**

```typescript
// 现有代码已使用 useCallback/useMemo 优化渲染
// 在 Electron 环境中这些优化继续生效

// 额外优化：使用 React.memo 包裹纯展示组件
import { memo } from 'react';

export const BookCardGrid = memo(({ book, onClick }) => {
  // ...
});
```

### 4.4 性能基准与监控

| 指标 | 目标值 | 监控方式 |
|------|--------|---------|
| 冷启动时间 | < 2s | `app.on('ready')` 到 `ready-to-show` |
| 热启动时间 | < 1s | 从托盘恢复到窗口显示 |
| 首屏渲染 | < 1.5s | Performance API 测量 |
| 空闲内存 | < 180MB | `process.memoryUsage()` |
| 阅读中内存 | < 400MB | 定期采样 |
| EPUB 翻页帧率 | >= 30fps | `requestAnimationFrame` 计时 |
| PDF 渲染帧率 | >= 25fps | Canvas 渲染计时 |
| 文件导入速度 | >= 50MB/s | Node.js fs 性能 |

---

## 五、功能完整性保证

### 5.1 功能迁移清单

#### 完全保留（零改动）

| 功能模块 | 文件 | 说明 |
|---------|------|------|
| 书架管理 | `src/pages/Library.tsx` | 网格/列表视图、搜索、排序、分类 |
| 书籍卡片 | `src/components/BookCard/` | 网格/列表卡片组件 |
| EPUB 阅读器 | `src/components/Reader/EpubReader.tsx` | epubjs 渲染引擎 |
| PDF 阅读器 | `src/components/Reader/PdfReader.tsx` | pdfjs-dist 渲染引擎 |
| TXT 阅读器 | `src/components/Reader/TxtReader.tsx` | 自研解析器 |
| MOBI 阅读器 | `src/components/Reader/MobiReader.tsx` | 自研解析器 |
| 选中文本工具栏 | `src/components/Reader/SelectionToolbar.tsx` | 高亮/批注 |
| 标注系统 | 所有阅读器 + `db.ts` | 多色高亮、批注、笔记 |
| 书签系统 | 所有阅读器 + `db.ts` | 添加/删除/跳转 |
| 全文搜索 | `src/pages/Reader.tsx` | 书内搜索 |
| 阅读设置 | `src/stores/preferenceStore.ts` | 字体/字号/行距/主题 |
| 快捷键 | `src/hooks/useKeyboardShortcuts.ts` | 翻页/导航 |
| 设置页面 | `src/pages/Settings.tsx` | 偏好设置 |
| 发现页面 | `src/pages/Discover.tsx` | 资源站点推荐 |
| 落地页 | `src/pages/Landing.tsx` | 产品介绍 |
| 布局组件 | `src/components/Layout/` | 侧边栏、顶部栏 |

#### 需要适配

| 功能 | 当前实现 | Electron 适配方案 | 改动量 |
|------|---------|------------------|--------|
| 路由 | BrowserRouter | HashRouter（通过环境检测动态选择） | 小 |
| 文件导入 | `<input type="file">` | `electron.dialog.showOpenDialog()` | 中 |
| 拖拽导入 | HTML5 Drag & Drop | 保留 HTML5 D&D + 增强原生文件路径 | 小 |
| 数据存储 | IndexedDB | 平台抽象层（Web: IndexedDB / Desktop: IPC→SQLite+FS） | 中 |
| Token 存储 | localStorage | `electron.safeStorage` 加密存储 | 小 |
| 字体加载 | Google Fonts CDN | 本地字体文件 | 小 |
| 后端 API | Express (独立进程) | Express (内嵌主进程) 或 直接 SQLite 调用 | 中 |
| 剪贴板 | Clipboard API | 保留 Web API + 增强原生剪贴板 | 小 |
| 外部链接 | `window.open()` | `shell.openExternal()` | 小 |

#### 新增桌面端功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 原生菜单栏 | P1 | 文件/编辑/视图/帮助菜单 |
| 系统托盘 | P1 | 最小化到托盘、托盘菜单 |
| 文件关联 | P1 | 双击 EPUB/PDF/TXT/MOBI 直接打开 |
| 自动更新 | P1 | 检测新版本、下载、安装 |
| 窗口状态持久化 | P2 | 记住窗口位置/大小/最大化状态 |
| 系统通知 | P2 | 导入完成、同步完成通知 |
| 全局快捷键 | P2 | 应用未聚焦时也可触发 |
| 多窗口 | P3 | 同时打开多本书籍 |

### 5.2 平台抽象层设计

```typescript
// src/platform/types.ts - 统一接口定义
export interface PlatformAPI {
  // 文件操作
  openFilePicker(options: FilePickerOptions): Promise<File[]>;
  readBookFile(bookId: string): Promise<ArrayBuffer>;
  saveBookFile(bookId: string, data: ArrayBuffer): Promise<void>;
  deleteBookFile(bookId: string): Promise<void>;

  // 数据库操作
  getAllBooks(): Promise<Book[]>;
  addBook(book: Book): Promise<void>;
  updateBook(book: Book): Promise<void>;
  deleteBook(id: string): Promise<void>;

  getBookmarks(bookId: string): Promise<Bookmark[]>;
  addBookmark(bookmark: Bookmark): Promise<void>;
  deleteBookmark(id: string): Promise<void>;

  getHighlights(bookId: string): Promise<Highlight[]>;
  addHighlight(highlight: Highlight): Promise<void>;
  updateHighlight(highlight: Highlight): Promise<void>;
  deleteHighlight(id: string): Promise<void>;

  // 偏好存储
  getPreference(key: string): Promise<ReadingPreference | null>;
  savePreference(key: string, value: ReadingPreference): Promise<void>;

  // 认证存储
  getAuthTokens(): Promise<{ accessToken: string; refreshToken: string } | null>;
  saveAuthTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
  clearAuthTokens(): Promise<void>;

  // 应用控制
  openExternal(url: string): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
}

export interface FilePickerOptions {
  filters?: { name: string; extensions: string[] }[];
  multiple?: boolean;
}
```

```typescript
// src/platform/detect.ts - 运行环境检测
export function isElectron(): boolean {
  return navigator.userAgent.toLowerCase().includes('electron');
}

export function getPlatform(): 'web' | 'electron' {
  return isElectron() ? 'electron' : 'web';
}
```

```typescript
// src/platform/index.ts - 统一导出
import { getPlatform } from './detect';
import { WebPlatform } from './web';
import { ElectronPlatform } from './electron';
import type { PlatformAPI } from './types';

const platform: PlatformAPI = getPlatform() === 'electron'
  ? new ElectronPlatform()
  : new WebPlatform();

export default platform;
```

### 5.3 后端服务集成方案

#### 方案：主进程内嵌 Express

```typescript
// electron/server/index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { app } from 'electron';

export function startServer(): Promise<number> {
  return new Promise((resolve) => {
    const server = express();
    server.use(cors());
    server.use(express.json({ limit: '10mb' }));

    // 复用现有路由
    const uploadDir = path.join(app.getPath('userData'), 'uploads');
    // ... 挂载路由

    // 随机端口（避免冲突）
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      console.log(`[Server] 内嵌服务启动于 http://localhost:${port}`);
      resolve(port);
    });
  });
}
```

**前端 API 适配：**

```typescript
// src/utils/api.ts - 动态配置 API 基础 URL
let API_BASE = '';

// Electron 环境下，主进程启动后告知端口
export function setApiBase(url: string) {
  API_BASE = url;
}

// 请求时拼接完整 URL
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const fullUrl = API_BASE ? `${API_BASE}${url}` : url;
  // ... 现有逻辑
}
```

### 5.4 数据迁移策略

**从 IndexedDB 迁移到 SQLite + 文件系统：**

```typescript
// electron/data/migration.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export async function migrateFromIndexedDB(): Promise<void> {
  const dbPath = path.join(app.getPath('userData'), 'db', 'inking.db');
  const db = new Database(dbPath);

  // 检查是否已迁移
  const migrated = db.prepare('SELECT value FROM meta WHERE key = ?').get('migrated');
  if (migrated) return;

  // 迁移逻辑：
  // 1. 从 IndexedDB 读取所有数据（通过 IPC 从渲染进程获取）
  // 2. 写入 SQLite 数据库
  // 3. 将书籍文件从 IndexedDB 写入文件系统
  // 4. 标记迁移完成

  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('migrated', 'true');
}
```

**迁移流程（用户视角）：**

1. 首次启动桌面端，检测是否存在 Web 端数据
2. 显示迁移进度界面
3. 后台执行数据迁移（IndexedDB → SQLite + 文件系统）
4. 迁移完成后提示用户
5. 迁移失败时保留原始数据，支持重试

---

## 六、可维护性设计

### 6.1 代码组织规范

#### 模块划分原则

```
electron/
├── main/                    # 主进程核心模块
│   ├── window.ts            # 窗口管理（单一职责）
│   ├── menu.ts              # 菜单管理（单一职责）
│   ├── tray.ts              # 托盘管理（单一职责）
│   └── ipc/                 # IPC 通信（按功能域划分）
│       ├── dialog.ts        # 文件对话框
│       ├── fs.ts            # 文件系统
│       ├── db.ts            # 数据库
│       └── app.ts           # 应用控制
├── server/                  # 后端服务（独立模块）
│   ├── index.ts             # 服务入口
│   ├── routes/              # 路由（复用现有）
│   └── middleware/          # 中间件（复用现有）
└── data/                    # 数据层（独立模块）
    ├── database.ts          # 数据库封装
    └── migrations/          # 迁移脚本
```

#### 命名规范

```typescript
// 文件名：kebab-case
// electron/main/window-manager.ts

// 类名：PascalCase
export class WindowManager { }

// 函数/变量：camelCase
export function createMainWindow() { }
export const mainWindowState = { };

// 常量：UPPER_SNAKE_CASE
export const MAX_WINDOW_WIDTH = 1920;
export const DEFAULT_WINDOW_SIZE = { width: 1200, height: 800 };

// IPC 通道名：冒号分隔的命名空间
export const IPC_CHANNELS = {
  DIALOG_OPEN_FILE: 'dialog:open-file',
  FS_READ_BOOK: 'fs:read-book',
  FS_WRITE_BOOK: 'fs:write-book',
  DB_GET_BOOKS: 'db:get-books',
  DB_ADD_BOOK: 'db:add-book',
  APP_GET_VERSION: 'app:get-version',
  UPDATER_CHECK: 'updater:check',
} as const;
```

### 6.2 类型安全

```typescript
// electron/types/ipc.ts - IPC 通道类型定义
export interface IpcChannelMap {
  // 文件对话框
  'dialog:open-file': {
    input: { filters?: FileFilter[]; multiple?: boolean };
    output: string[];
  };
  // 文件系统
  'fs:read-book': {
    input: { bookId: string };
    output: Buffer;
  };
  'fs:write-book': {
    input: { bookId: string; data: Buffer };
    output: void;
  };
  // 数据库
  'db:get-books': {
    input: void;
    output: Book[];
  };
  'db:add-book': {
    input: Book;
    output: void;
  };
  // ...
}

// 类型安全的 IPC 调用封装
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannelMap } from './types/ipc';

const electronAPI = {
  invoke: <K extends keyof IpcChannelMap>(
    channel: K,
    ...args: IpcChannelMap[K]['input'] extends void ? [] : [IpcChannelMap[K]['input']]
  ): Promise<IpcChannelMap[K]['output']> => {
    return ipcRenderer.invoke(channel, ...args);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

### 6.3 日志系统

```typescript
// electron/main/logger.ts
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

class Logger {
  private logFile: string;
  private static instance: Logger;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private constructor() {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFile = path.join(logDir, `app-${this.getDate()}.log`);
  }

  private getDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
  }

  private write(level: string, message: string, meta?: any) {
    const formatted = this.formatMessage(level, message, meta);
    fs.appendFileSync(this.logFile, formatted);

    // 开发环境同时输出到控制台
    if (process.env.NODE_ENV === 'development') {
      console.log(formatted.trim());
    }
  }

  info(message: string, meta?: any) { this.write('INFO', message, meta); }
  warn(message: string, meta?: any) { this.write('WARN', message, meta); }
  error(message: string, meta?: any) { this.write('ERROR', message, meta); }
  debug(message: string, meta?: any) { this.write('DEBUG', message, meta); }
}

export const logger = Logger.getInstance();
```

### 6.4 错误处理规范

```typescript
// electron/main/error-handler.ts
import { app, dialog } from 'electron';
import { logger } from './logger';

// 全局未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获异常', { error: error.message, stack: error.stack });

  dialog.showErrorBox(
    '应用错误',
    `发生了一个未预期的错误：\n${error.message}\n\n请查看日志文件获取详细信息。`
  );
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝', { reason: String(reason) });
});

// IPC 调用错误处理封装
export function handleIpcError<T>(
  channel: string,
  handler: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve()
    .then(() => handler())
    .catch((error) => {
      logger.error(`IPC 通道 ${channel} 错误`, { error: error.message });
      throw error;
    });
}
```

---

## 七、可扩展性设计

### 7.1 插件机制

```typescript
// electron/plugins/types.ts - 插件接口定义
export interface InkingPlugin {
  // 插件元信息
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;

  // 生命周期钩子
  onActivate?(): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;

  // 扩展点
  contributeMenus?(): MenuContribution[];
  contributeCommands?(): CommandContribution[];
  contributeReaders?(): ReaderContribution[];  // 支持新的书籍格式
  contributeSettings?(): SettingContribution[];
}

// 插件注册表示例
export interface MenuContribution {
  menuId: 'main' | 'tray' | 'context';
  items: {
    label: string;
    command: string;
    shortcut?: string;
    group?: string;
  }[];
}

export interface ReaderContribution {
  format: string;  // 如 'cbz', 'cbr', 'djvu'
  component: string;  // 组件路径
  fileExtensions: string[];
}
```

```typescript
// electron/plugins/manager.ts - 插件管理器
import { InkingPlugin } from './types';

class PluginManager {
  private plugins: Map<string, InkingPlugin> = new Map();
  private static instance: PluginManager;

  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  // 注册插件
  async register(plugin: InkingPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`插件 ${plugin.id} 已注册`);
    }
    this.plugins.set(plugin.id, plugin);
    if (plugin.onActivate) {
      await plugin.onActivate();
    }
  }

  // 注销插件
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      if (plugin.onDeactivate) {
        await plugin.onDeactivate();
      }
      this.plugins.delete(pluginId);
    }
  }

  // 获取所有插件
  getPlugins(): InkingPlugin[] {
    return Array.from(this.plugins.values());
  }

  // 获取特定扩展点的贡献
  getContributions<K extends keyof InkingPlugin>(
    extensionPoint: K
  ): NonNullable<InkingPlugin[K]>[] {
    return this.getPlugins()
      .map(p => p[extensionPoint])
      .filter(Boolean) as NonNullable<InkingPlugin[K]>[];
  }
}

export const pluginManager = PluginManager.getInstance();
```

### 7.2 扩展点设计

#### 格式扩展点

```typescript
// 预留接口：支持新的电子书格式
export interface BookFormatHandler {
  format: string;
  extensions: string[];
  parse(file: Buffer): Promise<ParsedBook>;
  render(container: HTMLElement, book: ParsedBook): ReaderInstance;
}

// 示例：CBZ/CBR 漫画格式插件
export const comicPlugin: InkingPlugin = {
  id: 'comic-reader',
  name: '漫画阅读器',
  version: '1.0.0',
  author: 'Inking Team',
  description: '支持 CBZ/CBR 漫画格式',

  contributeReaders() {
    return [{
      format: 'cbz',
      component: 'ComicReader',
      fileExtensions: ['cbz', 'cbr'],
    }];
  },
};
```

#### 导出扩展点

```typescript
// 预留接口：支持多种导出格式
export interface ExportHandler {
  format: string;
  name: string;
  export(highlights: Highlight[], bookmarks: Bookmark[]): Promise<Blob>;
}

// 示例：Markdown 导出插件
export const markdownExportPlugin: InkingPlugin = {
  id: 'markdown-export',
  name: 'Markdown 导出',
  version: '1.0.0',
  author: 'Inking Team',
  description: '将标注和笔记导出为 Markdown 文件',

  contributeCommands() {
    return [{
      id: 'export.markdown',
      label: '导出为 Markdown',
      handler: async (bookId: string) => {
        // 导出逻辑
      },
    }];
  },
};
```

### 7.3 配置扩展

```typescript
// electron/main/config.ts - 可扩展的配置存储
import Store from 'electron-store';

interface AppConfig {
  // 窗口状态
  windowState: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized: boolean;
  };
  // 阅读偏好
  preferences: ReadingPreference;
  // 插件配置
  plugins: Record<string, any>;
  // 自定义扩展
  extensions: Record<string, any>;
}

const config = new Store<AppConfig>({
  defaults: {
    windowState: { width: 1200, height: 800, isMaximized: false },
    preferences: defaultPreferences,
    plugins: {},
    extensions: {},
  },
});

export default config;
```

---

## 八、实现步骤

### Phase 1：项目初始化与环境配置（第 1 周）

#### 1.1 安装依赖

```bash
# 安装 Electron 及构建工具
npm install --save-dev electron@^33.0.0 electron-builder@^25.0.0
npm install --save-dev wait-on@^8.0.0

# 安装主进程运行时依赖
npm install better-sqlite3@^11.0.0 electron-store@^10.0.0
npm install express@^4.21.2 @prisma/client@^6.9.0 bcryptjs@^2.4.3
npm install jsonwebtoken@^9.0.2 multer@^1.4.5-lts.2 cors@^2.8.5

# 安装自动更新
npm install electron-updater@^6.0.0

# 安装类型定义
npm install --save-dev @types/better-sqlite3 @types/express
npm install --save-dev @types/bcryptjs @types/jsonwebtoken @types/multer @types/cors
```

#### 1.2 创建主进程入口

```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createMainWindow } from './main/window';
import { setupMenu } from './main/menu';
import { setupTray } from './main/tray';
import { registerAllIpc } from './main/ipc';
import { startServer } from './server';
import { initDatabase } from './data/database';
import { logger } from './main/logger';
import { setupErrorHandlers } from './main/error-handler';

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let serverPort: number = 3000;

app.on('second-instance', () => {
  // 第二个实例尝试启动时，聚焦到主窗口
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  logger.info('应用启动');

  // 初始化数据库
  await initDatabase();

  // 启动内嵌 Express 服务
  serverPort = await startServer();

  // 注册 IPC 通道
  registerAllIpc();

  // 创建主窗口
  mainWindow = createMainWindow(serverPort);

  // 设置菜单和托盘
  setupMenu(mainWindow);
  setupTray(mainWindow);

  // 设置错误处理
  setupErrorHandlers();
});

app.on('window-all-closed', () => {
  // Windows 上退出应用
  app.quit();
});

app.on('activate', () => {
  // macOS 上重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow(serverPort);
  }
});
```

#### 1.3 创建预加载脚本

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// 类型安全的 IPC 桥接
const electronAPI = {
  // 文件对话框
  openFilePicker: (options: any) => ipcRenderer.invoke('dialog:open-file', options),

  // 文件系统
  readBookFile: (bookId: string) => ipcRenderer.invoke('fs:read-book', bookId),
  saveBookFile: (bookId: string, data: ArrayBuffer) => ipcRenderer.invoke('fs:write-book', bookId, data),
  deleteBookFile: (bookId: string) => ipcRenderer.invoke('fs:delete-book', bookId),

  // 数据库
  getAllBooks: () => ipcRenderer.invoke('db:get-books'),
  addBook: (book: any) => ipcRenderer.invoke('db:add-book', book),
  updateBook: (book: any) => ipcRenderer.invoke('db:update-book', book),
  deleteBook: (id: string) => ipcRenderer.invoke('db:delete-book', id),

  // 书签
  getBookmarks: (bookId: string) => ipcRenderer.invoke('db:get-bookmarks', bookId),
  addBookmark: (bookmark: any) => ipcRenderer.invoke('db:add-bookmark', bookmark),
  deleteBookmark: (id: string) => ipcRenderer.invoke('db:delete-bookmark', id),

  // 标注
  getHighlights: (bookId: string) => ipcRenderer.invoke('db:get-highlights', bookId),
  addHighlight: (highlight: any) => ipcRenderer.invoke('db:add-highlight', highlight),
  updateHighlight: (highlight: any) => ipcRenderer.invoke('db:update-highlight', highlight),
  deleteHighlight: (id: string) => ipcRenderer.invoke('db:delete-highlight', id),

  // 应用信息
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => process.platform,

  // 外部链接
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),

  // 更新
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),

  // 事件监听
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['updater:progress', 'updater:available', 'app:focus'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
```

#### 1.4 配置 Vite 构建

```typescript
// vite.config.ts - 修改项
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Electron 使用相对路径
  base: './',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'chrome130',  // Electron 33 的 Chromium 版本
    sourcemap: false,      // 生产环境不生成源码映射
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'epubjs': ['epubjs'],
          'pdfjs': ['pdfjs-dist'],
          'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
});
```

#### 1.5 配置开发脚本

```json
// package.json - 新增脚本
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "dev:all": "concurrently -n fe,be -c blue,green \"npm run dev\" \"npm run dev --prefix server\"",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "check": "tsc --noEmit",
    // Electron 开发
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5174 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:preview": "electron .",
    // 打包
    "release": "npm run build && electron-builder --win --x64",
    "release:portable": "npm run build && electron-builder --win portable"
  }
}
```

#### 1.6 验证里程碑

- [ ] Electron 窗口能正常启动并加载 Vite 开发页面
- [ ] 所有页面路由正常跳转
- [ ] 四种格式书籍能正常导入和阅读
- [ ] 标注/书签功能正常
- [ ] 设置和偏好正常保存

### Phase 2：核心功能迁移（第 2 周）

#### 2.1 路由适配

```typescript
// src/App.tsx - 修改路由模式
import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
// ... 其他导入

// 检测运行环境
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const Router = isElectron ? HashRouter : BrowserRouter;

function AppRoutes() {
  // ... 现有路由逻辑不变
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
```

#### 2.2 平台抽象层实现

```typescript
// src/platform/web.ts - Web 端实现（封装现有 IndexedDB 逻辑）
import type { PlatformAPI, FilePickerOptions } from './types';
import * as db from '@/utils/db';

export class WebPlatform implements PlatformAPI {
  async openFilePicker(options: FilePickerOptions): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options.multiple ?? true;
      if (options.filters) {
        input.accept = options.filters.map(f => f.extensions.map(e => `.${e}`).join(',')).join(',');
      }
      input.onchange = () => resolve(Array.from(input.files ?? []));
      input.click();
    });
  }

  async readBookFile(bookId: string): Promise<ArrayBuffer> {
    const data = await db.getBookFile(bookId);
    if (!data) throw new Error('文件不存在');
    return data;
  }

  async saveBookFile(bookId: string, data: ArrayBuffer): Promise<void> {
    await db.saveBookFile(bookId, data);
  }

  async deleteBookFile(bookId: string): Promise<void> {
    // IndexedDB 中文件随书籍删除
  }

  // 数据库操作（直接调用现有 IndexedDB 封装）
  getAllBooks() { return db.getAllBooks(); }
  addBook(book: any) { return db.addBook(book); }
  updateBook(book: any) { return db.updateBook(book); }
  deleteBook(id: string) { return db.deleteBook(id); }

  getBookmarks(bookId: string) { return db.getBookmarks(bookId); }
  addBookmark(b: any) { return db.addBookmark(b); }
  deleteBookmark(id: string) { return db.deleteBookmark(id); }

  getHighlights(bookId: string) { return db.getHighlights(bookId); }
  addHighlight(h: any) { return db.addHighlight(h); }
  updateHighlight(h: any) { return db.updateHighlight(h); }
  deleteHighlight(id: string) { return db.deleteHighlight(id); }

  async getPreference(key: string) { return db.loadPreference(key); }
  async savePreference(key: string, value: any) { return db.savePreference(key, value); }

  async getAuthTokens() {
    const stored = localStorage.getItem('auth-tokens');
    return stored ? JSON.parse(stored) : null;
  }
  async saveAuthTokens(tokens: any) {
    localStorage.setItem('auth-tokens', JSON.stringify(tokens));
  }
  async clearAuthTokens() {
    localStorage.removeItem('auth-tokens');
  }

  async openExternal(url: string) {
    window.open(url, '_blank');
  }

  async showNotification(title: string, body: string) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}
```

```typescript
// src/platform/electron.ts - Electron 端实现
import type { PlatformAPI, FilePickerOptions } from './types';

export class ElectronPlatform implements PlatformAPI {
  private get api() { return window.electronAPI; }

  async openFilePicker(options: FilePickerOptions): Promise<File[]> {
    const paths: string[] = await this.api.openFilePicker(options);
    // 将路径转换为 File 对象（通过 IPC 读取文件内容）
    const files: File[] = [];
    for (const filePath of paths) {
      const data = await this.api.readBookFile(filePath);
      const name = filePath.split(/[/\\]/).pop() || 'unknown';
      files.push(new File([data], name));
    }
    return files;
  }

  async readBookFile(bookId: string): Promise<ArrayBuffer> {
    return this.api.readBookFile(bookId);
  }

  async saveBookFile(bookId: string, data: ArrayBuffer): Promise<void> {
    await this.api.saveBookFile(bookId, data);
  }

  async deleteBookFile(bookId: string): Promise<void> {
    await this.api.deleteBookFile(bookId);
  }

  // 数据库操作（通过 IPC 调用主进程）
  getAllBooks() { return this.api.getAllBooks(); }
  addBook(book: any) { return this.api.addBook(book); }
  updateBook(book: any) { return this.api.updateBook(book); }
  deleteBook(id: string) { return this.api.deleteBook(id); }

  getBookmarks(bookId: string) { return this.api.getBookmarks(bookId); }
  addBookmark(b: any) { return this.api.addBookmark(b); }
  deleteBookmark(id: string) { return this.api.deleteBookmark(id); }

  getHighlights(bookId: string) { return this.api.getHighlights(bookId); }
  addHighlight(h: any) { return this.api.addHighlight(h); }
  updateHighlight(h: any) { return this.api.updateHighlight(h); }
  deleteHighlight(id: string) { return this.api.deleteHighlight(id); }

  async getPreference(key: string) {
    // Electron 端使用 electron-store
    return this.api.getPreference(key);
  }
  async savePreference(key: string, value: any) {
    await this.api.savePreference(key, value);
  }

  async getAuthTokens() {
    return this.api.getAuthTokens();
  }
  async saveAuthTokens(tokens: any) {
    await this.api.saveAuthTokens(tokens);
  }
  async clearAuthTokens() {
    await this.api.clearAuthTokens();
  }

  async openExternal(url: string) {
    await this.api.openExternal(url);
  }

  async showNotification(title: string, body: string) {
    await this.api.showNotification(title, body);
  }
}
```

#### 2.3 适配 Store 和工具函数

```typescript
// src/stores/bookStore.ts - 使用平台抽象层
import { create } from 'zustand';
import platform from '@/platform';
// ... 其他导入

export const useBookStore = create<BookState>((set, get) => ({
  // ... 现有状态

  loadBooks: async () => {
    set({ isLoading: true });
    try {
      // 使用平台抽象层替代直接调用 IndexedDB
      const books = await platform.getAllBooks();
      set({ books, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  // ... 其他操作类似修改
}));
```

#### 2.4 验证里程碑

- [ ] 平台抽象层正常工作（Web 模式和 Electron 模式）
- [ ] 书籍导入使用原生文件对话框
- [ ] 数据存储切换到 SQLite + 文件系统
- [ ] 后端 API 通过内嵌 Express 正常工作
- [ ] 所有功能回归测试通过

### Phase 3：桌面特性实现（第 3 周）

#### 3.1 原生菜单栏

```typescript
// electron/main/menu.ts
import { Menu, BrowserWindow, shell, dialog } from 'electron';

export function setupMenu(mainWindow: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入书籍',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:import-books'),
        },
        {
          label: '新建 TXT',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:new-txt'),
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu:navigate', '/settings'),
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
        { type: 'separator' },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu:find'),
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '阅读',
      submenu: [
        {
          label: '上一章',
          accelerator: 'Left',
          click: () => mainWindow.webContents.send('menu:reader-nav', 'prev-chapter'),
        },
        {
          label: '下一章',
          accelerator: 'Right',
          click: () => mainWindow.webContents.send('menu:reader-nav', 'next-chapter'),
        },
        { type: 'separator' },
        {
          label: '添加书签',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow.webContents.send('menu:add-bookmark'),
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键帮助',
          accelerator: 'F1',
          click: () => mainWindow.webContents.send('menu:shortcuts-help'),
        },
        { type: 'separator' },
        {
          label: '检查更新',
          click: () => mainWindow.webContents.send('menu:check-update'),
        },
        {
          label: '关于墨卷',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于墨卷',
              message: `墨卷 (Inking)\n版本: ${app.getVersion()}\n基于 Electron ${process.versions.electron}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
```

#### 3.2 系统托盘

```typescript
// electron/main/tray.ts
import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function setupTray(mainWindow: BrowserWindow) {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('墨卷');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: '导入书籍',
      click: () => mainWindow.webContents.send('menu:import-books'),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}
```

#### 3.3 文件关联

```typescript
// electron/main/file-association.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';

const SUPPORTED_EXTENSIONS = ['.epub', '.pdf', '.txt', '.mobi'];

export function handleFileAssociation(mainWindow: BrowserWindow) {
  // 处理命令行参数中的文件路径（Windows 双击文件打开）
  const args = process.argv.slice(1);
  const filePath = args.find(arg => {
    const ext = path.extname(arg).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });

  if (filePath) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('open-file', filePath);
    });
  }

  // macOS: open-file 事件
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    const ext = path.extname(filePath).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      mainWindow.webContents.send('open-file', filePath);
    }
  });
}
```

#### 3.4 自动更新

```typescript
// electron/main/updater.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { logger } from './logger';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    logger.info('正在检查更新...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('发现新版本', { version: info.version });
    mainWindow.webContents.send('updater:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('当前已是最新版本');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:downloaded');
  });

  autoUpdater.on('error', (err) => {
    logger.error('自动更新错误', { error: err.message });
  });

  // 启动后延迟 10 秒检查更新
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 10000);
}

// IPC 处理：手动检查更新
export function checkForUpdates() {
  return autoUpdater.checkForUpdates();
}

// IPC 处理：下载更新
export function downloadUpdate() {
  return autoUpdater.downloadUpdate();
}

// IPC 处理：安装更新
export function installUpdate() {
  autoUpdater.quitAndInstall();
}
```

#### 3.5 窗口状态持久化

```typescript
// electron/main/window-state.ts
import { BrowserWindow, screen } from 'electron';
import Store from 'electron-store';
import path from 'path';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const store = new Store<{ windowState: WindowState }>({
  defaults: {
    windowState: { width: 1200, height: 800, isMaximized: false },
  },
});

export function loadWindowState(): WindowState {
  return store.get('windowState');
}

export function saveWindowState(win: BrowserWindow) {
  const isMaximized = win.isMaximized();
  const bounds = win.getBounds();

  store.set('windowState', {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  });
}

// 验证窗口位置是否在可见屏幕区域内
export function isWindowStateVisible(state: WindowState): boolean {
  const displays = screen.getAllDisplays();
  return displays.some(display => {
    const { x, y, width, height } = display.bounds;
    return (
      state.x! >= x &&
      state.y! >= y &&
      state.x! < x + width &&
      state.y! < y + height
    );
  });
}
```

#### 3.6 验证里程碑

- [ ] 原生菜单栏功能完整（文件/编辑/视图/阅读/帮助）
- [ ] 系统托盘正常工作（显示/隐藏、导入、退出）
- [ ] 文件关联正常（双击 EPUB/PDF/TXT/MOBI 打开应用）
- [ ] 自动更新检测和下载正常
- [ ] 窗口状态持久化（位置/大小/最大化恢复）
- [ ] 单实例锁定（无法启动第二个实例）

### Phase 4：测试与质量保证（第 4 周）

#### 4.1 功能回归测试

| 测试场景 | 测试步骤 | 预期结果 |
|---------|---------|---------|
| EPUB 导入 | 拖拽/文件选择导入 EPUB | 书籍出现在书架，封面正确 |
| PDF 导入 | 拖拽/文件选择导入 PDF | 书籍出现在书架，页数正确 |
| TXT 导入 | 拖拽/文件选择导入 TXT（UTF-8/GBK） | 编码正确识别，章节正确分割 |
| MOBI 导入 | 拖拽/文件选择导入 MOBI | 书籍正确解析和显示 |
| EPUB 阅读 | 翻页、目录跳转、进度保存 | 所有导航功能正常 |
| PDF 阅读 | 翻页、缩放、目录跳转 | 渲染正确，操作流畅 |
| TXT 阅读 | 章节导航、滚动、键盘翻页 | 阅读体验流畅 |
| MOBI 阅读 | 章节导航、翻页 | 内容正确显示 |
| 高亮标注 | 选中文本 → 5 色高亮 → 添加批注 | 高亮和批注正确保存和显示 |
| 书签 | 添加/删除/跳转书签 | 书签功能完整 |
| 全文搜索 | 搜索关键词 → 高亮匹配 → 导航 | 搜索结果正确 |
| 阅读设置 | 字体/字号/行距/主题/亮度/对齐 | 设置实时生效，重启后保留 |
| TXT 编辑 | 进入编辑模式 → 编辑 → 保存 | 编辑内容正确保存 |
| 分类管理 | 创建/筛选/删除分类 | 分类功能正常 |
| 认证 | 注册/登录/登出/Token 刷新 | 认证流程完整 |
| 文件关联 | 双击 .epub 文件 | 应用启动并打开书籍 |

#### 4.2 性能测试

```typescript
// 性能测试脚本
// electron/test/performance.ts

// 启动时间测试
const startTime = Date.now();
app.whenReady().then(() => {
  const readyTime = Date.now() - startTime;
  console.log(`[Performance] app.whenReady: ${readyTime}ms`);
});

// 内存监控
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`[Performance] RSS: ${Math.round(mem.rss / 1024 / 1024)}MB, Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
}, 60000);

// 渲染进程内存（通过 IPC 获取）
// mainWindow.webContents.executeJavaScript(`
//   JSON.stringify({
//     jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit,
//     totalJSHeapSize: performance.memory?.totalJSHeapSize,
//     usedJSHeapSize: performance.memory?.usedJSHeapSize,
//   })
// `);
```

| 性能指标 | 目标值 | 测试方法 |
|---------|--------|---------|
| 冷启动到可交互 | < 2s | 计时 `app.whenReady()` 到 `ready-to-show` |
| 热启动（从托盘） | < 500ms | 计时 `tray double-click` 到窗口显示 |
| 空闲内存 | < 180MB | `process.memoryUsage().rss` |
| 阅读中内存（EPUB） | < 350MB | 导入 50MB EPUB 后测量 |
| 阅读中内存（PDF） | < 400MB | 导入 200 页 PDF 后测量 |
| EPUB 翻页帧率 | >= 30fps | `requestAnimationFrame` 计时 |
| PDF 渲染帧率 | >= 25fps | Canvas 渲染计时 |
| 文件导入速度 | >= 50MB/s | 导入 100MB 文件计时 |
| 数据库查询（1000本书） | < 100ms | `getAllBooks()` 计时 |

#### 4.3 兼容性测试

| 测试环境 | 配置 | 关注点 |
|---------|------|--------|
| Windows 10 21H2 | i3-10105 / 16GB / UHD 630 | 低配兼容性（开发机） |
| Windows 10 1903 | 4GB RAM | 最低内存要求 |
| Windows 11 23H2 | i5+ / 16GB | 主流配置 |
| 100% DPI | 1920x1080 | 标准显示 |
| 125% DPI | 1920x1080 缩放 | 常见笔记本配置 |
| 150% DPI | 2560x1440 缩放 | 高分屏 |
| 200% DPI | 3840x2160 缩放 | 4K 显示器 |

#### 4.4 安装包测试

| 测试项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 安装包大小 | 查看文件属性 | NSIS < 130MB |
| 安装流程 | 双击安装包 | 安装向导正常，可选安装路径 |
| 卸载流程 | 控制面板卸载 | 完全清理，无残留 |
| 便携版 | 直接运行 exe | 无需安装即可使用 |
| 首次启动 | 安装后首次运行 | 创建数据目录，正常启动 |
| 文件关联 | 安装后双击 .epub | 关联正确，应用打开文件 |
| 开始菜单 | 查看开始菜单 | 快捷方式存在且可用 |
| 桌面快捷方式 | 查看桌面 | 快捷方式存在且可用 |

### Phase 5：打包与发布（第 5 周）

#### 5.1 打包配置

```javascript
// electron-builder.config.js
module.exports = {
  appId: 'com.inking.reader',
  productName: '墨卷',
  copyright: 'Copyright © 2024 Inking',

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  files: [
    'dist/**/*',
    'electron/dist/**/*',      // 编译后的主进程代码
    'server/dist/**/*',         // 编译后的后端代码
    'node_modules/**/*',        // 运行时依赖
    'package.json',
    '!**/node_modules/.cache',
    '!**/*.map',
    '!**/*.ts',
    '!**/.eslintrc*',
    '!**/.prettierrc*',
    '!**/tsconfig*.json',
    '!**/{test,tests,__tests__}/**',
    '!**/{*.test.*,*.spec.*}',
  ],

  asar: true,

  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'build/icon.ico',
    fileAssociations: [
      { ext: 'epub', name: 'EPUB 电子书', mimeType: 'application/epub+zip', description: 'EPUB 格式电子书' },
      { ext: 'pdf', name: 'PDF 文档', mimeType: 'application/pdf', description: 'PDF 格式文档' },
      { ext: 'txt', name: '文本文件', mimeType: 'text/plain', description: '纯文本文件' },
      { ext: 'mobi', name: 'MOBI 电子书', mimeType: 'application/x-mobipocket-ebook', description: 'MOBI 格式电子书' },
    ],
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: '墨卷',
    compressor: 'lzma',
    include: 'build/nsis/installer.nsh',
  },

  extraResources: [
    { from: 'build/fonts', to: 'fonts', filter: ['**/*.otf', '**/*.ttf'] },
  ],

  // 发布配置
  publish: {
    provider: 'github',
    owner: 'your-username',
    repo: 'inking',
    releaseType: 'release',
  },
};
```

#### 5.2 构建脚本

```bash
# 完整构建流程
npm run build                    # 1. 构建前端（Vite）
npx tsc -p electron/tsconfig.json  # 2. 编译主进程 TypeScript
npx tsc -p server/tsconfig.json     # 3. 编译后端 TypeScript
npx electron-builder --win        # 4. 打包 Windows 安装包
```

#### 5.3 发布检查清单

- [ ] 安装包大小符合预期（< 130MB）
- [ ] 在 Windows 10 和 11 上安装/卸载正常
- [ ] 所有功能回归测试通过
- [ ] 性能指标达标
- [ ] 文件关联正确
- [ ] 自动更新流程正常
- [ ] 无安全警告（或已通过代码签名消除）
- [ ] 日志系统正常工作
- [ ] 崩溃报告机制就绪

---

## 九、测试计划

### 9.1 测试策略

| 测试类型 | 工具 | 覆盖范围 | 执行时机 |
|---------|------|---------|---------|
| 单元测试 | Vitest | 平台抽象层、数据库操作、工具函数 | 每次提交 |
| 集成测试 | Vitest + Electron | IPC 通信、文件操作、数据库 CRUD | 每次 PR |
| E2E 测试 | Playwright + Electron | 完整用户流程 | 每次发版 |
| 手动测试 | 人工 | 阅读体验、性能体感、UI 细节 | 每次发版 |
| 性能测试 | 自定义脚本 | 启动时间、内存、帧率 | 每次发版 |
| 兼容性测试 | 多环境 | Windows 10/11、不同 DPI | 每次发版 |

### 9.2 关键测试场景

#### 核心流程测试

```
1. 冷启动 → 书架加载 → 书籍导入 → 打开阅读 → 标注 → 保存 → 关闭 → 重启 → 恢复
2. 双击 .epub 文件 → 应用启动 → 自动导入 → 打开阅读
3. 登录 → 云端同步 → 断网 → 本地操作 → 联网 → 同步恢复
4. 大文件导入（100MB+ EPUB）→ 内存不超限 → 正常阅读
5. 长时间运行（8h+）→ 内存稳定 → 无泄漏
```

#### 边界条件测试

```
1. 导入损坏的文件 → 错误提示 → 不影响其他功能
2. 磁盘空间不足 → 优雅降级 → 提示用户
3. 同时导入 50 本书 → 不卡顿 → 全部成功
4. 书籍数量 > 1000 → 书架加载 < 2s
5. 标注数量 > 10000 → 列表滚动流畅
```

---

## 十、风险评估与缓解

### 10.1 技术风险

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| epubjs 在 Electron WebView 中渲染异常 | 低 | 高 | Phase 1 即验证；epubjs 基于标准 Web API，Electron Chromium 完全支持 |
| better-sqlite3 原生模块编译问题 | 中 | 中 | 使用 `electron-rebuild` 重新编译；备选 `sql.js`（纯 JS 实现） |
| PDF.js Worker 路径在 Electron 中失效 | 中 | 中 | 使用 `file://` 协议或 `asset://` 协议加载 worker |
| Express 内嵌启动延迟 | 中 | 低 | 异步启动，前端显示加载状态；或改为直接 SQLite 调用 |
| 安装包体积超标 | 中 | 中 | 字体子集化 + 依赖精简 + asar 压缩；备选自定义 Electron 构建 |
| Windows DPI 缩放导致 UI 模糊 | 中 | 中 | 启用 `--force-device-scale-factor`；测试多种缩放比例 |
| IndexedDB 数据迁移丢失 | 低 | 高 | 迁移前备份；分批迁移；迁移后校验完整性 |
| 自动更新在 Windows 上权限问题 | 中 | 中 | 用户级安装（无需管理员权限）；保留手动下载渠道 |

### 10.2 业务风险

| 风险 | 影响 | 缓解策略 |
|------|------|---------|
| 开发周期超出预期 | 延期发布 | 分阶段发布：Phase 1-2 完成后发布 MVP，Phase 3-5 后续迭代 |
| 功能回归导致用户体验下降 | 用户流失 | Web 端保持可用作为回退；充分回归测试 |
| 安装包体积影响下载转化率 | 用户获取 | 提供便携版（无需安装）；CDN 加速下载 |
| Windows Defender 误报 | 用户信任 | 代码签名证书（EV 证书最佳）；提交微软恶意软件分析 |

### 10.3 风险缓解总策略

1. **渐进式迁移**：保持 Web 端和桌面端并行，桌面端初期直接加载 Web 构建产物
2. **早期验证**：Phase 1 结束完成核心技术验证（epubjs、pdfjs、文件操作）
3. **数据安全保障**：数据迁移工具充分测试，保留 Web 端回退方案
4. **性能持续监控**：集成性能监控，每次发版前性能回归测试

---

## 十一、附录

### 附录 A：关键文件变更清单

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `package.json` | 修改 | 新增 Electron 依赖和脚本，`main` 字段 |
| `vite.config.ts` | 修改 | `base: './'`，`target: 'chrome130'` |
| `src/App.tsx` | 修改 | BrowserRouter → 动态选择（Web: Browser / Desktop: Hash） |
| `src/utils/db.ts` | 保留 | Web 端继续使用，Electron 端通过平台抽象层替代 |
| `src/utils/api.ts` | 修改 | API 基础 URL 动态配置 |
| `src/stores/bookStore.ts` | 修改 | 使用平台抽象层替代直接 IndexedDB 调用 |
| `src/stores/authStore.ts` | 修改 | Token 存储适配（Electron: safeStorage） |
| `src/platform/` | 新增 | 平台抽象层（types.ts, web.ts, electron.ts, detect.ts, index.ts） |
| `electron/` | 新增 | 整个 Electron 主进程目录 |
| `build/` | 新增 | 打包资源（图标、字体、NSIS 脚本） |
| `electron-builder.config.js` | 新增 | 打包配置 |
| `index.html` | 修改 | Google Fonts → 本地字体引用 |

### 附录 B：IPC 通道清单

| 通道名 | 方向 | 参数 | 返回值 | 用途 |
|--------|------|------|--------|------|
| `dialog:open-file` | R→M | `{ filters, multiple }` | `string[]` | 打开文件对话框 |
| `fs:read-book` | R→M | `bookId` | `Buffer` | 读取书籍文件 |
| `fs:write-book` | R→M | `{ bookId, data }` | `void` | 写入书籍文件 |
| `fs:delete-book` | R→M | `bookId` | `void` | 删除书籍文件 |
| `db:get-books` | R→M | 无 | `Book[]` | 获取所有书籍 |
| `db:add-book` | R→M | `Book` | `void` | 添加书籍 |
| `db:update-book` | R→M | `Book` | `void` | 更新书籍 |
| `db:delete-book` | R→M | `id` | `void` | 删除书籍 |
| `db:get-bookmarks` | R→M | `bookId` | `Bookmark[]` | 获取书签 |
| `db:add-bookmark` | R→M | `Bookmark` | `void` | 添加书签 |
| `db:delete-bookmark` | R→M | `id` | `void` | 删除书签 |
| `db:get-highlights` | R→M | `bookId` | `Highlight[]` | 获取标注 |
| `db:add-highlight` | R→M | `Highlight` | `void` | 添加标注 |
| `db:update-highlight` | R→M | `Highlight` | `void` | 更新标注 |
| `db:delete-highlight` | R→M | `id` | `void` | 删除标注 |
| `app:get-version` | R→M | 无 | `string` | 获取应用版本 |
| `app:open-external` | R→M | `url` | `void` | 打开外部链接 |
| `updater:check` | R→M | 无 | `void` | 检查更新 |
| `updater:available` | M→R | `UpdateInfo` | - | 通知有可用更新 |
| `updater:progress` | M→R | `{ percent }` | - | 更新下载进度 |
| `menu:import-books` | M→R | 无 | - | 菜单触发导入 |
| `menu:navigate` | M→R | `path` | - | 菜单触发导航 |

### 附录 C：数据目录结构

```
%APPDATA%/墨卷/                    # Windows 用户数据目录
├── db/
│   └── inking.db                  # SQLite 数据库
├── books/
│   ├── {bookId}.epub              # 书籍文件
│   ├── {bookId}.pdf
│   ├── {bookId}.txt
│   └── {bookId}.mobi
├── covers/                        # 封面缓存
│   └── {bookId}.jpg
├── logs/
│   └── app-2024-01-01.log         # 应用日志
├── config.json                    # 应用配置（electron-store）
└── updates/                       # 更新缓存
    └── pending-update.exe
```

### 附录 D：开发命令速查

```bash
# 开发模式（前端 + Electron）
npm run electron:dev

# 构建前端
npm run build

# 编译主进程
npx tsc -p electron/tsconfig.json

# 打包安装包
npm run release

# 打包便携版
npm run release:portable

# TypeScript 检查
npm run check

# 运行测试
npm test
```

### 附录 E：决策记录

| 决策项 | 决策 | 理由 |
|--------|------|------|
| 桌面框架 | Electron 33+ | 生态最成熟，前端代码 95%+ 复用，团队无需学习 Rust |
| 路由方案 | 动态选择（Hash/Browser） | Web 端保留 BrowserRouter，Electron 使用 HashRouter |
| 存储方案 | SQLite + 文件系统 | 比 IndexedDB 更适合桌面端，支持大数据量，便于备份迁移 |
| 后端方案 | 主进程内嵌 Express | 最大化复用现有代码，后期可渐进替换为直接 DB 调用 |
| 字体方案 | 本地打包（子集化） | 离线可用，避免外部依赖，子集化控制体积 |
| 安装包格式 | NSIS + 便携版 | NSIS 支持自定义安装路径，便携版满足免安装需求 |
| 仅 x64 架构 | 是 | 覆盖 99%+ Windows 用户，减少 50% 构建体积 |
| 压缩算法 | LZMA | 最高压缩率，安装包体积最小 |
| 插件机制 | 生命周期钩子 + 扩展点 | 参考 VS Code 扩展模型，灵活且可扩展 |