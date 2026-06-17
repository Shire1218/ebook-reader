# 墨卷（Inking）桌面端迁移计划

## 一、详细分析阶段

### 1.1 当前架构评估

**项目名称**：墨卷（Inking）v0.5.0  
**项目类型**：全栈电子书阅读器 Web 应用  
**代码规模**：前端约 7000+ 行，后端约 800+ 行，共约 50 个源文件

#### 技术栈总览

| 层面 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React + TypeScript | 18.3.1 / 5.6 |
| 构建工具 | Vite | 6.0 |
| 样式方案 | TailwindCSS + PostCSS | 3.4 / 8.4 |
| 状态管理 | Zustand | 5.0 |
| 路由 | react-router-dom | 6.28 |
| EPUB 引擎 | epubjs | 0.3.93 |
| PDF 引擎 | pdfjs-dist | 5.6 |
| 后端框架 | Express | 4.21 |
| ORM | Prisma | 6.9 |
| 数据库 | SQLite | - |
| 认证 | JWT + bcryptjs | 9.0 / 2.4 |

#### 核心组件清单

| 组件 | 文件 | 功能 | 桌面迁移影响 |
|------|------|------|-------------|
| AppLayout | `src/components/Layout/AppLayout.tsx` | 全局布局 | 低 - 直接复用 |
| Sidebar | `src/components/Layout/Sidebar.tsx` | 侧边导航 | 低 - 直接复用 |
| TopBar | `src/components/Layout/TopBar.tsx` | 顶部工具栏 | 低 - 直接复用 |
| EpubReader | `src/components/Reader/EpubReader.tsx` | EPUB 渲染 | 中 - epubjs 在桌面端兼容性需验证 |
| PdfReader | `src/components/Reader/PdfReader.tsx` | PDF 渲染 | 中 - Canvas 渲染在桌面端需验证 |
| TxtReader | `src/components/Reader/TxtReader.tsx` | TXT 渲染 | 低 - 纯 DOM 操作 |
| MobiReader | `src/components/Reader/MobiReader.tsx` | MOBI 渲染 | 低 - 纯 JS 解析 |
| DropZone | `src/components/DropZone.tsx` | 拖拽导入 | 中 - 需适配原生文件对话框 |
| bookStore | `src/stores/bookStore.ts` | 书籍数据管理 | 高 - 存储层需替换/扩展 |
| authStore | `src/stores/authStore.ts` | 认证状态 | 中 - Token 存储需适配 |
| db.ts | `src/utils/db.ts` | IndexedDB 操作 | 高 - 核心存储层，需评估保留或替换 |
| api.ts | `src/utils/api.ts` | HTTP 请求 | 中 - 后端集成方式需调整 |
| Express 后端 | `server/` | API 服务 | 高 - 需决定内嵌或独立运行 |

#### 浏览器 API 依赖分析

| API | 使用位置 | 桌面端替代方案 |
|-----|---------|---------------|
| IndexedDB | `db.ts` - 全部数据存储 | 方案 A: 保留（Electron/Tauri 均支持）<br>方案 B: 替换为 Node.js 文件系统 |
| localStorage | `authStore.ts`, `preferenceStore.ts` | 保留（所有 WebView 方案均支持）|
| File API / Drag & Drop | `DropZone.tsx`, `useBookImport.ts` | 增强为原生文件对话框 |
| Clipboard API | `Discover.tsx`, `SelectionToolbar.tsx` | 保留，可增强为系统剪贴板 |
| Selection / Range API | 所有阅读器 | 保留（WebView 完全支持）|
| contentEditable | `TxtReader.tsx` 编辑模式 | 保留 |
| Canvas API | `PdfReader.tsx` | 保留 |
| TextDecoder/Encoder | `txtParser.ts`, `mobiParser.ts` | 保留 |
| CustomEvent | `Reader.tsx` 进度跳转 | 保留 |
| Google Fonts 加载 | `index.html` | 需改为本地字体文件 |

### 1.2 功能清单与保留要求

#### 必须完整保留的功能

| 功能模块 | 子功能 | 优先级 |
|---------|--------|--------|
| 书籍导入 | 拖拽导入、文件选择器导入、新建 TXT | P0 |
| 书架管理 | 网格/列表视图、搜索、排序、分类、删除、重命名 | P0 |
| EPUB 阅读 | 分页渲染、目录导航、主题切换、字体设置 | P0 |
| PDF 阅读 | Canvas 渲染、翻页、缩放、目录 | P0 |
| TXT 阅读 | 章节导航、滚动阅读、编码检测 | P0 |
| MOBI 阅读 | 解析渲染、章节导航 | P0 |
| 标注系统 | 多色高亮、批注、笔记管理 | P0 |
| 书签系统 | 添加/删除/跳转 | P0 |
| 全文搜索 | 书内搜索、高亮匹配、导航 | P0 |
| 阅读设置 | 字体/字号/行距/主题/亮度/对齐/段距 | P0 |
| 进度管理 | 进度条、断点续读、位置记忆 | P0 |
| 快捷键 | 翻页、导航、操作快捷键 | P1 |
| TXT 编辑 | contentEditable 编辑、格式化、保存 | P1 |
| 设置页面 | 偏好设置、实时预览 | P1 |
| 发现页面 | 资源站点推荐 | P2 |

#### 需要新增/增强的桌面端功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 原生文件对话框 | 替代浏览器 file input | P0 |
| 系统托盘 | 最小化到托盘、托盘菜单 | P1 |
| 原生菜单 | 菜单栏（文件/编辑/视图/帮助） | P1 |
| 文件关联 | 双击 EPUB/PDF/TXT 文件直接打开 | P1 |
| 自动更新 | 应用内检测和下载安装更新 | P1 |
| 系统通知 | 导入完成、同步完成等通知 | P2 |
| 全局快捷键 | 应用未聚焦时也可触发的快捷键 | P2 |
| 多窗口 | 同时打开多本书籍 | P2 |
| 任务栏进度 | 阅读进度显示在任务栏 | P3 |

### 1.3 性能基线指标

| 指标 | 当前 Web 端值 | 桌面端目标值 | 说明 |
|------|-------------|-------------|------|
| 应用启动时间 | 2-3s（含网络加载） | < 1.5s（本地加载） | 桌面端无网络延迟 |
| 首屏渲染 | < 2s | < 1s | 本地资源加载更快 |
| 内存占用（空闲） | ~80MB（浏览器标签） | 150-250MB（含运行时） | 桌面运行时额外开销 |
| 内存占用（阅读中） | 200-500MB | 250-500MB | 渲染引擎为主要消耗 |
| EPUB 翻页帧率 | >= 30fps | >= 30fps | 保持一致 |
| PDF 渲染帧率 | >= 20fps | >= 25fps | 桌面端 GPU 加速可提升 |
| 文件导入速度 | 受浏览器 File API 限制 | 提升 30-50% | Node.js 文件系统更高效 |
| 磁盘占用 | - | 150-300MB（含运行时） | 安装包体积 |
| IndexedDB 读写 | 浏览器实现 | 保留或替换为 SQLite | 视方案而定 |

---

## 二、实施方案

### 方案 A：Electron 封装方案

#### A.a 技术需求

**核心工具与框架：**

| 工具 | 版本 | 用途 |
|------|------|------|
| Electron | 33+ | 桌面应用运行时 |
| electron-builder | 25+ | 打包分发 |
| electron-updater | 6+ | 自动更新 |
| electron-store | 10+ | 配置持久化（可选） |

**最低系统要求：**
- 操作系统：Windows 10 1903+（64 位）/ Windows 11
- 内存：4GB RAM（推荐 8GB）
- 磁盘空间：500MB（应用 + 数据）
- GPU：支持 DirectX 11 的显卡（硬件加速）

**开发环境配置：**
```bash
# 安装 Electron 相关依赖
npm install --save-dev electron electron-builder
npm install electron-store electron-updater

# package.json 新增配置
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5174 && electron .\"",
    "electron:build": "vite build && electron-builder"
  }
}
```

#### A.b 开发流程

**Phase 1：项目初始化与环境配置**

```
步骤 1.1 - 安装 Electron 依赖
  ├── npm install --save-dev electron electron-builder
  ├── 创建 electron/ 目录
  └── 创建 electron/main.js（主进程入口）

步骤 1.2 - 配置主进程
  ├── 创建 BrowserWindow 加载 Vite 开发页面
  ├── 配置 preload.js（安全暴露 Node.js API）
  ├── 设置 CSP（内容安全策略）
  └── 配置窗口属性（最小尺寸 800x600、图标、标题）

步骤 1.3 - 配置构建流程
  ├── 修改 vite.config.ts（base 路径为 ./）
  ├── 配置 electron-builder（Windows nsis 安装包）
  └── 配置开发模式热重载（同时启动 Vite + Electron）

步骤 1.4 - 验证基础运行
  └── 确保现有 Web 应用在 Electron 窗口中正常显示和交互
```

**Phase 2：核心应用转换与集成**

```
步骤 2.1 - 路由适配
  ├── 将 BrowserRouter 改为 HashRouter（Electron file:// 协议兼容）
  └── 验证所有路由正常工作

步骤 2.2 - 后端服务集成
  ├── 方案 A：将 Express 后端嵌入 Electron 主进程
  │   ├── 在主进程中启动 Express 服务（监听 localhost:3000）
  │   ├── 将 Prisma + SQLite 数据库打包到应用内
  │   └── 前端 API 请求指向 localhost:3000
  └── 方案 B：移除后端，完全使用本地存储
      ├── 将认证逻辑改为本地密码验证（可选）
      ├── 所有数据操作走 IndexedDB 或 Node.js 文件系统
      └── 保留云端同步为可选功能（连接远程服务器）

步骤 2.3 - 文件存储迁移
  ├── 书籍文件从 IndexedDB 迁移到本地文件系统
  │   ├── 创建 userData/books/ 目录存储书籍文件
  │   ├── 创建 userData/db/ 目录存储 SQLite 数据库
  │   └── 编写数据迁移脚本（IndexedDB → 文件系统）
  ├── 使用 Node.js fs 模块替代 IndexedDB 文件操作
  └── 保留 IndexedDB 作为缓存层（可选）

步骤 2.4 - 文件导入适配
  ├── 使用 Electron dialog.showOpenDialog() 替代 file input
  ├── 增强拖拽导入（支持从文件管理器拖入文件路径）
  └── 支持从命令行参数接收文件路径
```

**Phase 3：桌面特性实现**

```
步骤 3.1 - 原生菜单栏
  ├── 创建应用菜单（文件/编辑/视图/帮助）
  ├── 文件菜单：导入书籍、新建 TXT、设置、退出
  ├── 编辑菜单：撤销、重做、复制、粘贴、查找
  ├── 视图菜单：全屏、开发者工具、缩放
  └── 帮助菜单：关于、快捷键帮助、检查更新

步骤 3.2 - 系统托盘
  ├── 创建 Tray 图标
  ├── 托盘右键菜单（显示/隐藏、导入、退出）
  └── 关闭按钮最小化到托盘

步骤 3.3 - 文件关联
  ├── 在 electron-builder 配置中注册文件类型
  │   ├── .epub → application/epub+zip
  │   ├── .pdf → application/pdf
  │   ├── .txt → text/plain
  │   └── .mobi → application/x-mobipocket-ebook
  └── 处理 open-file 事件打开关联文件

步骤 3.4 - 自动更新
  ├── 集成 electron-updater
  ├── 配置更新源（GitHub Releases 或自建服务器）
  └── 实现更新检测和安装 UI

步骤 3.5 - 其他桌面特性
  ├── 系统通知（Notification API 替换为 Electron Notification）
  ├── 全局快捷键注册（可选）
  ├── 窗口状态持久化（位置、大小、最大化状态）
  └── 单实例锁定（防止重复启动）
```

**Phase 4：测试与质量保证**

```
步骤 4.1 - 功能回归测试
  ├── 四种格式书籍导入和阅读完整测试
  ├── 标注/书签/搜索功能测试
  ├── 设置和偏好保存测试
  └── 认证和云同步测试（如保留）

步骤 4.2 - 桌面特性测试
  ├── 文件关联双击打开测试
  ├── 菜单栏和托盘功能测试
  ├── 自动更新流程测试
  └── 多窗口场景测试（如支持）

步骤 4.3 - 性能测试
  ├── 启动时间测量（目标 < 1.5s）
  ├── 内存占用监控（目标 < 500MB）
  ├── 大文件加载测试（200MB+ EPUB）
  └── 长时间运行稳定性测试

步骤 4.4 - 兼容性测试
  ├── Windows 10 1903+ 测试
  ├── Windows 11 测试
  ├── 不同 DPI 缩放（100%/125%/150%/200%）
  └── 不同分辨率测试（1366x768 ~ 3840x2160）
```

**Phase 5：打包与分发**

```
步骤 5.1 - 打包配置
  ├── 配置 electron-builder NSIS 安装包
  ├── 配置应用签名（代码签名证书）
  ├── 生成安装包（x64 + arm64）
  └── 配置便携版（Portable）

步骤 5.2 - 分发准备
  ├── 创建应用图标（多尺寸 ICO/PNG）
  ├── 编写安装说明
  └── 配置自动更新服务器

步骤 5.3 - 发布
  ├── 测试安装包安装/卸载流程
  ├── 测试首次启动体验
  └── 发布到分发渠道
```

#### A.c 潜在挑战与缓解策略

| 挑战 | 严重程度 | 缓解策略 |
|------|---------|---------|
| 安装包体积大（150-300MB） | 中 | 使用 electron-builder 的 asar 压缩；按需裁剪 Electron 模块；考虑使用 electron-forge 的 tree-shaking |
| 内存占用高（Chromium 内核） | 中 | 启用 Chromium 内存限制标志；优化渲染进程数量；大文件使用流式处理 |
| 后端嵌入增加复杂度 | 高 | 优先考虑"纯本地模式"——移除 Express 后端，直接使用 Node.js fs + better-sqlite3 操作数据 |
| epubjs 在 Electron 中的 iframe 兼容性 | 低 | epubjs 基于标准 Web API，Electron 的 Chromium 内核完全支持 |
| PDF.js Worker 路径问题 | 低 | Electron 中使用 file:// 协议，需正确配置 workerSrc 路径 |
| Windows DPI 缩放模糊 | 中 | 在 app 中启用 `app.commandLine.appendSwitch('high-dpi-support', '1')` 和 `--force-device-scale-factor` |
| 自动更新在 Windows 上的权限问题 | 中 | 使用 NSIS 安装到用户目录（无需管理员权限）；或使用便携版 |
| Google Fonts 外部依赖 | 低 | 将 Noto Serif SC 字体文件下载到本地 `assets/fonts/` 目录，修改 CSS 引用本地路径 |

#### A.d 资源分配

| 角色 | 人数 | 技能要求 | 参与阶段 |
|------|------|---------|---------|
| 前端开发工程师 | 1-2 | React + TypeScript + Electron 基础 | 全程 |
| 桌面端开发工程师 | 1 | Electron 主进程、Node.js、Windows API | Phase 2-5 |
| 测试工程师 | 1 | 功能测试、性能测试、兼容性测试 | Phase 4-5 |

**软硬件资源：**
- 开发机：Windows 10/11，8GB+ RAM，SSD
- 测试机：Windows 10（低配置）、Windows 11、不同 DPI 显示器
- 代码签名证书：EV 代码签名证书（可选但推荐）
- 分发服务器或 GitHub Releases 账号

**人时估算：**

| 阶段 | 人时估算 | 说明 |
|------|---------|------|
| Phase 1 - 初始化 | 16-24h | Electron 项目搭建、基础窗口 |
| Phase 2 - 核心转换 | 40-60h | 路由适配、后端集成、存储迁移 |
| Phase 3 - 桌面特性 | 32-48h | 菜单、托盘、文件关联、自动更新 |
| Phase 4 - 测试修复 | 32-48h | 回归测试、Bug 修复、性能优化 |
| Phase 5 - 打包分发 | 16-24h | 打包配置、签名、发布 |
| **合计** | **136-204h** | 约 3.5-5 周（1 人全职） |

#### A.e 时间线

```
Week 1          Week 2          Week 3          Week 4          Week 5
├───────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ Phase 1       │ Phase 2       │ Phase 3       │ Phase 4       │ Phase 5       │
│ 环境搭建      │ 核心转换      │ 桌面特性      │ 测试修复      │ 打包发布      │
│               │               │               │               │               │
│ ▓▓▓▓░░░░░░░░ │ ░░░░▓▓▓▓▓▓░░ │ ░░░░░░░░▓▓▓▓ │ ▓▓▓▓▓▓░░░░░░ │ ░░░░░░░░▓▓▓▓ │
│               │               │               │ ░░░░▓▓▓▓▓▓░░ │               │
│ M1            │ M2            │ M3            │ M4            │ M5            │
```

- **M1**（Week 1 末）：Electron 窗口能正常加载应用
- **M2**（Week 2 末）：所有核心功能在桌面端正常工作
- **M3**（Week 3 末）：桌面特性全部实现
- **M4**（Week 4 末）：测试通过，无 P0/P1 级 Bug
- **M5**（Week 5 末）：安装包发布

---

### 方案 B：Tauri 原生容器方案

#### B.a 技术需求

**核心工具与框架：**

| 工具 | 版本 | 用途 |
|------|------|------|
| Tauri | 2.x | 桌面应用框架（Rust 后端 + WebView） |
| Rust | 1.75+ | Tauri 后端语言 |
| WebView2 | 系统内置 | Windows 上的渲染引擎（基于 Edge Chromium） |
| create-tauri-app | 最新 | 项目脚手架 |

**最低系统要求：**
- 操作系统：Windows 10 1803+（64 位）/ Windows 11
- WebView2 Runtime：Windows 11 已预装，Windows 10 需确认
- 内存：4GB RAM
- 磁盘空间：200MB
- Rust 工具链（开发时）

**开发环境配置：**
```bash
# 安装 Rust（如未安装）
# 从 https://rustup.rs 下载安装

# 初始化 Tauri
npm install --save-dev @tauri-apps/cli
npx tauri init

# 安装 Tauri API
npm install @tauri-apps/api

# 开发模式
npx tauri dev

# 构建
npx tauri build
```

#### B.b 开发流程

**Phase 1：项目初始化与环境配置**

```
步骤 1.1 - 安装 Rust 工具链
  ├── 安装 rustup（Rust 版本管理器）
  ├── 安装 MSVC 构建工具（Windows）
  └── 验证 cargo、rustc 可用

步骤 1.2 - 初始化 Tauri 项目
  ├── npx tauri init
  ├── 配置 tauri.conf.json
  │   ├── 应用名称、标识符、版本号
  │   ├── 开发服务器 URL（http://localhost:5174）
  │   ├── 构建命令（npm run build）
  │   └── 输出目录（dist）
  └── 创建 src-tauri/ 目录（Rust 后端代码）

步骤 1.3 - 配置窗口属性
  ├── 最小窗口尺寸 800x600
  ├── 窗口标题 "墨卷"
  ├── 窗口图标（ICO 格式）
  └── 启用装饰（原生标题栏）

步骤 1.4 - 验证基础运行
  └── 确保 Web 应用在 WebView2 中正常显示和交互
```

**Phase 2：核心应用转换与集成**

```
步骤 2.1 - WebView2 兼容性验证
  ├── 测试 epubjs 在 WebView2 中的渲染
  ├── 测试 pdfjs-dist Canvas 渲染
  ├── 测试 IndexedDB 在 WebView2 中的支持
  └── 测试 contentEditable 编辑功能

步骤 2.2 - 路由适配
  ├── 确认 Tauri 对 BrowserRouter 的支持
  │   （Tauri 2.x 支持自定义协议，可使用 BrowserRouter）
  └── 或使用 HashRouter 确保兼容性

步骤 2.3 - 后端服务集成
  ├── 方案 A：使用 Rust 后端替代 Express
  │   ├── 使用 rusqlite 操作 SQLite 数据库
  │   ├── 使用 Tauri Command 暴露 API 给前端
  │   └── 前端通过 @tauri-apps/api/invoke 调用 Rust 函数
  └── 方案 B：嵌入 Express 作为子进程
      ├── 在 Tauri sidecar 中运行 Node.js + Express
      └── 前端通过 HTTP 请求通信

步骤 2.4 - 文件系统适配
  ├── 使用 Tauri fs API 替代 IndexedDB 文件存储
  │   ├── import { writeBinaryFile, readBinaryFile } from '@tauri-apps/plugin-fs'
  │   ├── 书籍文件存储到 appDataDir/books/
  │   └── 数据库存储到 appDataDir/db/
  └── 使用 Tauri dialog API 替代文件选择器
      ├── import { open } from '@tauri-apps/plugin-dialog'
      └── 支持文件类型过滤（EPUB/PDF/TXT/MOBI）
```

**Phase 3：桌面特性实现**

```
步骤 3.1 - 原生菜单栏
  ├── 在 tauri.conf.json 中配置菜单
  └── 或使用 Rust 代码动态创建菜单

步骤 3.2 - 系统托盘
  ├── 在 tauri.conf.json 中配置 tray icon
  └── 在 Rust 端处理托盘事件

步骤 3.3 - 文件关联
  ├── 在 tauri.conf.json 中配置文件类型关联
  └── 处理 deep link / file open 事件

步骤 3.4 - 自动更新
  ├── 使用 @tauri-apps/plugin-updater
  ├── 配置更新端点
  └── 实现更新 UI

步骤 3.5 - 其他桌面特性
  ├── 系统通知（@tauri-apps/plugin-notification）
  ├── 窗口状态持久化（@tauri-apps/plugin-window-state）
  ├── 全局快捷键（@tauri-apps/plugin-global-shortcut）
  └── 单实例锁定（@tauri-apps/plugin-single-instance）
```

**Phase 4：测试与质量保证**

```
（与方案 A 的 Phase 4 相同，增加以下 Tauri 特有测试）

步骤 4.x - Tauri 特有测试
  ├── WebView2 Runtime 缺失场景测试
  ├── Rust 后端命令的错误处理测试
  ├── 文件系统权限测试
  └── 安装包体积验证（目标 < 20MB）
```

**Phase 5：打包与分发**

```
步骤 5.1 - 打包配置
  ├── 配置 Tauri 构建（MSI + NSIS 双格式）
  ├── 配置代码签名
  └── 生成 x64 和 arm64 安装包

步骤 5.2 - 分发
  ├── 测试安装/卸载流程
  └── 发布到分发渠道
```

#### B.c 潜在挑战与缓解策略

| 挑战 | 严重程度 | 缓解策略 |
|------|---------|---------|
| WebView2 Runtime 依赖 | 中 | Windows 11 已预装；Windows 10 可通过 Evergreen bootstrapper 自动安装；Tauri 安装包可捆绑 WebView2 |
| Rust 学习曲线 | 高 | 后端逻辑相对简单（文件操作 + SQLite）；可参考 Tauri 官方示例；核心业务逻辑仍在前端 |
| epubjs 在 WebView2 中的兼容性 | 中 | WebView2 基于 Chromium，与 Chrome 行为高度一致；需实际测试验证 iframe 和 CFI 定位 |
| Tauri 2.x 生态成熟度 | 中 | 插件系统已较完善；部分高级功能可能需要自行编写 Rust 代码 |
| 前端调用 Rust 的桥接开销 | 低 | Tauri IPC 桥接性能足够；大批量数据传输可使用 async 命令 |
| contentEditable 在 WebView2 中的行为差异 | 低 | WebView2 与 Chrome 行为一致，风险极低 |
| PDF.js Worker 在 Tauri 中的加载 | 低 | 使用 Tauri 的 asset 协议加载 worker 文件 |

#### B.d 资源分配

| 角色 | 人数 | 技能要求 | 参与阶段 |
|------|------|---------|---------|
| 前端开发工程师 | 1-2 | React + TypeScript | 全程 |
| Rust/Tauri 开发工程师 | 1 | Rust 基础 + Tauri 框架 + SQLite | Phase 1-5 |
| 测试工程师 | 1 | 功能测试、兼容性测试 | Phase 4-5 |

**软硬件资源：**
- 开发机：Windows 10/11，8GB+ RAM，SSD
- Rust 工具链：rustup、cargo、MSVC 构建工具
- 测试机：Windows 10（验证 WebView2 安装）、Windows 11

**人时估算：**

| 阶段 | 人时估算 | 说明 |
|------|---------|------|
| Phase 1 - 初始化 | 20-30h | Rust 环境搭建、Tauri 项目初始化、学习 Rust 基础 |
| Phase 2 - 核心转换 | 48-72h | Rust 后端开发、文件系统适配、WebView2 兼容性调试 |
| Phase 3 - 桌面特性 | 24-40h | Tauri 插件集成、菜单/托盘/文件关联 |
| Phase 4 - 测试修复 | 32-48h | 回归测试、Bug 修复、性能调优 |
| Phase 5 - 打包分发 | 12-20h | 打包配置、签名、发布 |
| **合计** | **136-210h** | 约 3.5-5.5 周（1 人全职） |

#### B.e 时间线

```
Week 1          Week 2          Week 3          Week 4          Week 5/6
├───────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ Phase 1       │ Phase 2       │ Phase 3       │ Phase 4       │ Phase 5       │
│ Rust+Tauri    │ 核心转换      │ 桌面特性      │ 测试修复      │ 打包发布      │
│               │               │               │               │               │
│ ▓▓▓▓░░░░░░░░ │ ░░░░▓▓▓▓▓▓▓▓ │ ░░░░░░░░▓▓▓▓ │ ▓▓▓▓▓▓░░░░░░ │ ░░░░░░░░▓▓▓▓ │
│               │               │               │ ░░░░▓▓▓▓▓▓░░ │               │
│ M1            │ M2            │ M3            │ M4            │ M5            │
```

- **M1**（Week 1 末）：Tauri 窗口能正常加载应用
- **M2**（Week 3 初）：所有核心功能在桌面端正常工作
- **M3**（Week 3 末）：桌面特性全部实现
- **M4**（Week 4 末）：测试通过
- **M5**（Week 5-6 末）：安装包发布

---

### 方案 C：PWA 转桌面方案（Neutralinojs / NW.js）

#### C.a 技术需求

**核心工具与框架（NW.js 方案）：**

| 工具 | 版本 | 用途 |
|------|------|------|
| NW.js | 0.90+ | 桌面运行时（Chromium + Node.js） |
| nwjs-builder-phoenix | 最新 | 打包工具 |

**核心工具与框架（Neutralinojs 方案）：**

| 工具 | 版本 | 用途 |
|------|------|------|
| Neutralinojs | 5.x | 轻量桌面运行时（系统 WebView） |
| @neutralinojs/api | 最新 | JS API 库 |
| neu CLI | 最新 | 开发和打包工具 |

**以下以 NW.js 为例（与 Electron 类似但更简单）：**

**最低系统要求：**
- 操作系统：Windows 10+（64 位）
- 内存：4GB RAM
- 磁盘空间：300MB

**开发环境配置：**
```bash
# NW.js 方案
npm install nw --save-dev
npm install nwjs-builder-phoenix --save-dev

# Neutralinojs 方案
npm install -g @neutralinojs/neu
neu create desktop-app --template neutralinojs/neutralinojs-minimal
```

#### C.b 开发流程（以 NW.js 为例）

**Phase 1：项目初始化**

```
步骤 1.1 - 安装 NW.js
  ├── npm install nw --save-dev
  ├── 创建 package.json 的 nwjs 配置
  └── 配置 main（指向 index.html 或入口 JS）

步骤 1.2 - 配置窗口
  ├── 在 package.json 中配置 window 属性
  │   ├── width/height/min_width/min_height
  │   ├── title、icon
  │   └── toolbar（生产环境设为 false）
  └── 配置 chromium-args（硬件加速等）

步骤 1.3 - 验证运行
  └── 确保 Web 应用在 NW.js 窗口中正常显示
```

**Phase 2：核心转换**

```
步骤 2.1 - Node.js 集成
  ├── 使用 Node.js fs 模块操作文件
  ├── 使用 better-sqlite3 替代后端 Express + Prisma
  └── 前端通过 require/import 直接调用 Node.js 模块

步骤 2.2 - 文件对话框
  ├── 使用 nw.Dialog 打开文件
  └── 支持文件类型过滤

步骤 2.3 - 数据迁移
  └── IndexedDB → 本地文件系统 + SQLite
```

**Phase 3：桌面特性**

```
步骤 3.1 - 原生菜单
  ├── 使用 nw.Menu 创建原生菜单
  └── 配置菜单栏和右键菜单

步骤 3.2 - 系统托盘
  ├── 使用 nw.Tray 创建托盘图标
  └── 配置托盘菜单

步骤 3.3 - 文件关联和单实例
  ├── 配置文件关联
  └── 使用单实例锁
```

**Phase 4-5：测试与打包**

```
（类似方案 A，使用 nwjs-builder-phoenix 打包）
```

#### C.c 潜在挑战与缓解策略

| 挑战 | 严重程度 | 缓解策略 |
|------|---------|---------|
| NW.js 社区活跃度下降 | 高 | 作为备选方案，如果 Electron/Tauri 均不适用再考虑 |
| NW.js 版本更新慢，Chromium 版本滞后 | 中 | 评估最新 NW.js 的 Chromium 版本是否支持所需 Web API |
| Neutralinojs 功能有限 | 中 | 系统 WebView 功能受限，epubjs/pdfjs 兼容性风险较高 |
| 打包体积仍然较大（NW.js） | 中 | 与 Electron 类似，使用 UPX 压缩 |
| 文档和社区支持不如 Electron | 中 | 参考 Electron 方案，大部分逻辑可迁移 |

#### C.d 资源分配

| 角色 | 人数 | 技能要求 |
|------|------|---------|
| 前端开发工程师 | 1-2 | React + TypeScript + NW.js API |
| 测试工程师 | 1 | 功能测试 |

**人时估算：**

| 阶段 | 人时估算 |
|------|---------|
| Phase 1 - 初始化 | 12-16h |
| Phase 2 - 核心转换 | 36-52h |
| Phase 3 - 桌面特性 | 24-36h |
| Phase 4 - 测试修复 | 28-40h |
| Phase 5 - 打包分发 | 12-20h |
| **合计** | **112-164h** |

#### C.e 时间线

```
Week 1          Week 2          Week 3          Week 4
├───────────────┼───────────────┼───────────────┼───────────────┤
│ Phase 1       │ Phase 2       │ Phase 3       │ Phase 4 + 5   │
│ 初始化        │ 核心转换      │ 桌面特性      │ 测试+打包     │
│ ▓▓▓░░░░░░░░░ │ ░░░▓▓▓▓▓▓░░░ │ ░░░░░░▓▓▓▓░░ │ ▓▓▓▓▓▓▓▓▓▓░░ │
│ M1            │ M2            │ M3           │ M4            │
```

---

## 三、跨平台考量

### 3.1 Windows 专项实现（Windows 10 & 11）

| 方面 | 实现细节 |
|------|---------|
| **安装方式** | NSIS 安装包（用户级安装，无需管理员权限）+ 便携版 |
| **DPI 适配** | 声明 DPI 感知（Per-Monitor V2），处理 100%-200% 缩放 |
| **暗色模式** | 检测 Windows 暗色模式设置，自动切换应用主题 |
| **文件路径** | 使用 `\` 分隔符，处理长路径（> 260 字符）|
| **注册表** | 文件关联通过安装程序写入注册表 |
| **开始菜单** | 安装时创建开始菜单快捷方式 |
| **任务栏** | 支持任务栏预览、跳转列表（Jump List）|
| **Windows 10 兼容** | 最低支持 Windows 10 1803（Tauri）或 1903（Electron）|
| **Windows 11 优化** | 支持 Windows 11 的圆角窗口、Mica 材质（需额外开发）|
| **Windows Defender** | 代码签名避免误报；如未签名，SmartScreen 会警告 |

### 3.2 未来扩展到其他操作系统

| 平台 | Electron | Tauri | NW.js |
|------|---------|-------|-------|
| macOS | 完全支持 | 完全支持（WebKit） | 完全支持 |
| Linux (Ubuntu/Debian) | 完全支持 | 完全支持（WebKitGTK） | 完全支持 |
| 额外工作 | 各平台打包配置 | 几乎无额外工作 | 各平台打包配置 |
| 注意事项 | macOS 需代码签名和公证 | Linux 需安装 WebKitGTK | 各平台行为一致性较好 |

**跨平台抽象建议：**
- 将所有平台相关代码封装在 `platform/` 模块中
- 使用统一接口封装文件对话框、通知、托盘等功能
- 条件判断平台类型，执行对应实现

### 3.3 OS 特有功能处理

| 功能 | Windows | macOS（未来） | Linux（未来） |
|------|---------|-------------|-------------|
| 文件系统访问 | NTFS 路径，长路径支持 | APFS 路径，沙箱权限 | ext4 路径，权限管理 |
| 系统通知 | Windows 通知中心 | Notification Center | libnotify |
| 快捷方式 | .lnk 文件 / 开始菜单 | Dock / Launchpad | .desktop 文件 |
| 文件关联 | 注册表 | Launch Services | MIME types / xdg-mime |
| 全局快捷键 | Win + 组合键 | Cmd + 组合键 | Super + 组合键 |
| 自动更新 | Squirrel / NSIS | Sparkle / DMG | AppImage / deb |

---

## 四、性能优化

### 4.1 内存管理策略

| 策略 | 实现方式 | 目标 |
|------|---------|------|
| 书籍文件流式加载 | 大文件使用 ReadableStream 分段读取，避免一次性加载到内存 | 单次内存占用 < 100MB |
| 阅读器实例管理 | 切换书籍时销毁前一本书的渲染实例（epubjs book.destroy()） | 避免内存泄漏 |
| Canvas 内存回收 | PDF 页面切换时释放前一页的 Canvas 和 ImageData | 减少 50-100MB 占用 |
| 虚拟列表 | 书签/标注列表超过 100 条时使用虚拟滚动 | UI 渲染内存恒定 |
| 图片懒加载 | 书籍封面仅在可视区域时加载 | 减少初始内存占用 |
| 定时 GC 提示 | 长时间运行后提示 Chromium 进行垃圾回收 | 减少内存膨胀 |
| 渲染进程隔离 | （Electron）为阅读器使用独立渲染进程 | 主进程稳定性 |

### 4.2 资源利用基准与优化目标

| 指标 | 当前 Web 端 | 桌面端目标 | 优化手段 |
|------|-----------|-----------|---------|
| 启动到可交互 | 2-3s | < 1.5s | 本地资源 + 预加载 |
| 空闲内存 | ~80MB | 150-200MB | 运行时固有开销 |
| 阅读中内存 | 200-500MB | 250-500MB | 流式加载 + 实例管理 |
| CPU 空闲占用 | < 1% | < 2% | 避免后台轮询 |
| 磁盘写入 | IndexedDB 异步 | 批量写入 + 防抖 | 2s 防抖已实现 |
| 安装包大小 | - | < 200MB（Electron）/ < 20MB（Tauri） | 压缩 + 裁剪 |

### 4.3 各方案性能特性对比

| 性能维度 | Electron | Tauri | NW.js |
|---------|---------|-------|-------|
| 启动速度 | 中等（1-3s） | 快（0.5-1.5s） | 中等（1-3s） |
| 内存占用 | 高（150-500MB） | 低（80-300MB） | 高（150-500MB） |
| CPU 占用 | 中等 | 低 | 中等 |
| 渲染性能 | 优秀（自带 Chromium） | 优秀（WebView2 Chromium） | 优秀（自带 Chromium） |
| 磁盘占用 | 大（150-300MB） | 小（5-20MB） | 大（150-300MB） |
| 文件 I/O | 优秀（Node.js） | 优秀（Rust） | 优秀（Node.js） |
| 多进程 | 支持（独立渲染进程） | 不支持（单 WebView） | 有限支持 |

### 4.4 缓存机制与离线功能

| 缓存层 | 实现方式 | 用途 |
|--------|---------|------|
| 书籍文件缓存 | 本地文件系统（userData/books/） | 已导入书籍永久离线可用 |
| 书籍元信息缓存 | SQLite 数据库 | 快速查询和索引 |
| 阅读进度缓存 | SQLite + 内存（Zustand） | 实时保存，批量写入磁盘 |
| 渲染缓存 | epubjs 的 localStorage 缓存 | EPUB 页面预加载 |
| 字体缓存 | 本地字体文件 | 避免重复加载 |
| 封面缓存 | 文件系统（userData/covers/） | 书架快速加载 |

**离线功能策略：**
- 应用完全离线可用——所有数据存储在本地
- 云同步为可选功能——登录后可同步到远程服务器
- 同步策略：本地优先，联网时增量同步变更
- 冲突处理：最后写入优先（与当前 Web 端行为一致）

---

## 五、用户体验适配

### 5.1 桌面端 UI/UX 调整

| 调整项 | 说明 |
|--------|------|
| 窗口标题 | 动态显示当前书名和章节名 |
| 最小窗口尺寸 | 800x600，确保布局不会破损 |
| 默认窗口尺寸 | 1200x800，适合书架视图 |
| 标题栏 | 使用系统原生标题栏（简化开发），可选自定义标题栏 |
| 字体 | 内置 Noto Serif SC，无需网络加载 |
| 右键菜单 | 阅读器区域自定义右键菜单（复制/高亮/批注） |
| 拖拽行为 | 支持从外部文件管理器拖入文件 |
| 缩放 | 支持 Ctrl+/- 和 Ctrl+滚轮 缩放整个界面 |
| 全屏 | F11 或双击标题栏进入全屏阅读模式 |

### 5.2 原生 OS 功能集成

| 功能 | 实现 |
|------|------|
| **菜单栏** | 文件（导入/新建/设置/退出）、编辑（撤销/重做/复制/粘贴/查找）、视图（全屏/缩放/开发者工具）、帮助（关于/快捷键/检查更新） |
| **任务栏** | 应用图标、阅读进度叠加层（可选） |
| **系统托盘** | 托盘图标 + 右键菜单（显示主窗口/导入书籍/退出） |
| **跳转列表** | Windows 任务栏跳转列表显示最近阅读的书籍 |
| **通知** | 导入完成、同步完成、更新可用等场景 |
| **文件拖入** | 从文件管理器拖入 EPUB/PDF/TXT/MOBI 文件直接导入 |

### 5.3 窗口管理

| 场景 | 行为 |
|------|------|
| 单窗口模式（默认） | 所有操作在一个窗口内完成，书架和阅读器通过路由切换 |
| 多窗口模式（可选） | 点击书籍在新窗口中打开阅读器，主窗口保持书架 |
| 关闭行为 | 点击关闭按钮最小化到托盘（可在设置中配置为直接退出） |
| 窗口状态恢复 | 记住窗口位置、大小、最大化状态，下次启动恢复 |
| 全屏模式 | 阅读器支持全屏模式（F11），隐藏菜单栏和标题栏 |

### 5.4 离线功能与数据同步

```
数据流架构：

┌─────────────────────────────────────────────┐
│                 前端（React）                │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Zustand  │  │ 阅读器   │  │ UI 组件   │  │
│  │ Stores   │  │ 组件     │  │           │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
│  ┌────┴──────────────┴──────────────┴─────┐  │
│  │         数据访问层（DAL）               │  │
│  │  ┌──────────┐  ┌──────────────────┐    │  │
│  │  │ 本地存储  │  │ 云端同步（可选） │    │  │
│  │  │ SQLite   │  │ HTTP API         │    │  │
│  │  │ 文件系统  │  │                  │    │  │
│  │  └──────────┘  └──────────────────┘    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │                    │
    ┌────┴────┐         ┌────┴────┐
    │ 本地 DB │         │ 远程 API│
    │ SQLite  │         │ 服务器  │
    │ 文件    │         │         │
    └─────────┘         └─────────┘
```

**同步策略：**
1. 所有操作先写入本地 SQLite
2. 联网且已登录时，将变更推送到远程服务器
3. 启动时拉取远程变更，合并到本地
4. 冲突解决：以最后修改时间为准（last-write-wins）

---

## 六、集成需求

### 6.1 API 集成点

| 集成点 | 当前实现 | 桌面端方案 |
|--------|---------|-----------|
| 用户认证 | Express + JWT | 方案 A: 内嵌 Express<br>方案 B: Rust/Node 实现认证逻辑 |
| 书籍 CRUD | REST API | 方案 A: 保留 API 层<br>方案 B: 直接调用本地 DB |
| 文件上传 | multer + 磁盘存储 | 直接写入本地文件系统 |
| 书签/标注 | REST API | 同书籍 CRUD |
| 云同步 | HTTP API | 保留 HTTP 客户端，连接远程服务器 |
| 健康检查 | GET /api/health | 本地模式下不需要 |

### 6.2 数据存储方案

**桌面端存储架构：**

```
userData/
├── db/
│   └── inking.db          # SQLite 数据库（书籍、书签、标注、用户）
├── books/
│   ├── {bookId}.epub      # 书籍文件
│   ├── {bookId}.pdf
│   ├── {bookId}.txt
│   └── {bookId}.mobi
├── covers/
│   └── {bookId}.jpg       # 封面图片（如有）
├── config/
│   └── settings.json      # 应用设置
└── logs/
    └── app.log            # 应用日志
```

**SQLite Schema（复用当前 Prisma Schema）：**

```sql
-- 复用现有 Prisma 数据模型
CREATE TABLE users (
  id        TEXT PRIMARY KEY,
  username  TEXT UNIQUE NOT NULL,
  email     TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE books (
  id              TEXT PRIMARY KEY,
  userId          TEXT REFERENCES users(id),
  title           TEXT NOT NULL,
  author          TEXT NOT NULL DEFAULT '',
  format          TEXT NOT NULL,
  coverUrl        TEXT DEFAULT '',
  fileSize        INTEGER DEFAULT 0,
  progress        REAL DEFAULT 0,
  currentLocation TEXT DEFAULT '',
  currentChapter  TEXT DEFAULT '',
  category        TEXT DEFAULT '',
  filePath        TEXT DEFAULT '',
  lastReadTime    DATETIME,
  importTime      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- bookmarks, highlights 同理
```

### 6.3 认证与安全

| 方面 | 实现方案 |
|------|---------|
| 本地认证 | 可选——本地模式无需认证；或提供本地密码锁 |
| 云端认证 | 保留 JWT 双 Token 机制，Token 存储在加密的本地文件中 |
| 密码存储 | 本地用户密码使用 bcrypt 哈希存储在 SQLite |
| Token 存储 | 使用 Electron 的 safeStorage API 或 Tauri 的加密存储 |
| 数据传输 | 云端通信强制 HTTPS |
| 本地数据 | SQLite 数据库可选 SQLCipher 加密 |
| CSP | 配置严格的内容安全策略，限制外部资源加载 |

### 6.4 更新与版本管理

| 方面 | Electron | Tauri |
|------|---------|-------|
| 更新检测 | electron-updater 定期检查 GitHub Releases | tauri-updater 检查配置的端点 |
| 更新下载 | 后台下载差分更新包 | 后台下载更新包 |
| 更新安装 | 提示用户重启安装 | 提示用户重启安装 |
| 更新频率 | 随功能发版，语义化版本号 | 同左 |
| 回滚机制 | 保留上一版本安装包 | 同左 |

---

## 七、评估框架

### 7.1 定量评估标准

| 评估维度 | 权重 | Electron | Tauri | NW.js |
|---------|------|---------|-------|-------|
| **开发工作量** | 20% | | | |
| 总人时 | | 136-204h | 136-210h | 112-164h |
| 学习成本 | | 低（JS 全栈） | 高（需学 Rust） | 低（JS 全栈） |
| **性能指标** | 20% | | | |
| 安装包大小 | | 150-300MB | 5-20MB | 150-300MB |
| 内存占用 | | 150-500MB | 80-300MB | 150-500MB |
| 启动速度 | | 1-3s | 0.5-1.5s | 1-3s |
| **资源需求** | 10% | | | |
| 开发环境复杂度 | | 低 | 高（Rust 工具链） | 低 |
| CI/CD 构建时间 | | 中等 | 较长（Rust 编译） | 中等 |

### 7.2 定性评估标准

| 评估维度 | 权重 | Electron | Tauri | NW.js |
|---------|------|---------|-------|-------|
| **可维护性** | 15% | | | |
| 代码复用率 | | 95%+ | 85-90% | 90-95% |
| 社区生态 | | 最大最成熟 | 快速增长 | 社区较小 |
| 文档质量 | | 优秀 | 良好 | 一般 |
| 长期维护风险 | | 低 | 低 | 中（社区活跃度） |
| **用户体验** | 15% | | | |
| 渲染一致性 | | 优秀（自带 Chromium） | 优秀（WebView2） | 优秀 |
| 原生集成深度 | | 深度 | 中等 | 中等 |
| 安装包体验 | | 成熟（NSIS） | 良好（MSI/NSIS） | 一般 |
| **可扩展性** | 10% | | | |
| 跨平台扩展 | | 完全支持 | 完全支持 | 完全支持 |
| 插件生态 | | 丰富 | 增长中 | 有限 |
| 新功能开发效率 | | 高 | 中等（需写 Rust） | 高 |

### 7.3 加权评分系统

| 评估维度 | 权重 | Electron | Tauri | NW.js |
|---------|------|---------|-------|-------|
| 开发工作量 | 20% | 7/10 | 6/10 | 8/10 |
| 性能表现 | 20% | 6/10 | 9/10 | 6/10 |
| 资源需求 | 10% | 7/10 | 5/10 | 7/10 |
| 可维护性 | 15% | 9/10 | 7/10 | 6/10 |
| 用户体验 | 15% | 8/10 | 8/10 | 7/10 |
| 可扩展性 | 10% | 9/10 | 8/10 | 6/10 |
| 社区与生态 | 10% | 10/10 | 7/10 | 5/10 |
| **加权总分** | **100%** | **7.65** | **7.15** | **6.45** |

**计算明细：**

| 方案 | 计算过程 | 总分 |
|------|---------|------|
| Electron | 0.2×7 + 0.2×6 + 0.1×7 + 0.15×9 + 0.15×8 + 0.1×9 + 0.1×10 | **7.65** |
| Tauri | 0.2×6 + 0.2×9 + 0.1×5 + 0.15×7 + 0.15×8 + 0.1×8 + 0.1×7 | **7.15** |
| NW.js | 0.2×8 + 0.2×6 + 0.1×7 + 0.15×6 + 0.15×7 + 0.1×6 + 0.1×5 | **6.45** |

### 7.4 最终推荐

#### 推荐方案：Electron（首选）

**推荐理由：**

1. **技术可行性最高**
   - 前端代码几乎 100% 复用，无需学习新语言
   - 现有 React + TypeScript 技术栈完全兼容
   - epubjs、pdfjs-dist 等核心库在 Electron 中完全支持
   - IndexedDB 可直接保留，也可渐进迁移到文件系统

2. **开发效率最高**
   - 团队无需学习 Rust（对比 Tauri）
   - Node.js 后端可直接嵌入，现有 Express + Prisma 代码复用
   - 丰富的 Electron 生态提供现成解决方案
   - 调试工具完善（Chrome DevTools 原生集成）

3. **长期维护优势**
   - 最大的桌面 Web 应用社区（VS Code、Discord、Slack 等均使用）
   - 持续的版本更新和安全补丁
   - 丰富的第三方库和插件
   - 招聘容易，Electron 开发者数量远超 Rust/Tauri 开发者

4. **与项目目标对齐**
   - plan.md 中提到"后续可选 Electron 桌面端"，方向一致
   - 项目的"编辑模式"构想（运行代码文件）在 Electron 中更容易实现（Node.js 子进程）
   - 双模式（阅读+编辑）的复杂功能需求适合 Electron 的灵活性

**备选方案：Tauri**
- 如果对安装包大小有严格要求（< 20MB），Tauri 是更好的选择
- 如果团队有 Rust 经验或愿意投入学习成本
- 可以在 Electron 方案成熟后，将核心逻辑迁移到 Tauri

---

## 八、风险评估

### 8.1 技术风险

| 风险 | 方案 | 概率 | 影响 | 缓解策略 |
|------|------|------|------|---------|
| epubjs 在桌面 WebView 中渲染异常 | A/B/C | 低 | 高 | 早期原型验证；epubjs 基于标准 Web API，风险极低 |
| PDF.js Worker 加载路径错误 | A/B/C | 中 | 中 | 使用绝对路径或 asset 协议；在 Phase 1 即验证 |
| IndexedDB 数据迁移丢失或损坏 | A/B | 低 | 高 | 迁移前备份；分批迁移；迁移后校验数据完整性 |
| 大文件（> 100MB）导入导致内存溢出 | A/B/C | 中 | 中 | 使用流式读取；Node.js fs.createReadStream |
| Windows DPI 缩放导致 UI 模糊 | A/C | 中 | 中 | 启用高 DPI 支持标志；测试多种缩放比例 |
| 自动更新失败导致应用损坏 | A/B | 低 | 高 | 保留上一版本备份；更新前校验安装包完整性 |
| SQLite 并发写入冲突 | A/B | 低 | 中 | 使用 WAL 模式；写入队列序列化 |
| Google Fonts 离线不可用 | A/B/C | 高 | 低 | 打包本地字体文件（已在计划中） |
| 后端 Express 嵌入启动延迟 | A | 中 | 中 | 后端异步启动；前端显示加载状态等待后端就绪 |
| Rust 后端开发效率低于预期 | B | 中 | 中 | 保持后端逻辑简单；必要时回退到 sidecar 方案 |

### 8.2 业务影响分析

| 风险场景 | 影响范围 | 最大延迟 | 应对策略 |
|---------|---------|---------|---------|
| 核心阅读器功能回归 Bug | 所有用户 | 1-2 周 | 建立完整的功能回归测试清单；优先保证核心阅读功能 |
| 数据存储迁移失败 | 已有用户数据 | 2-3 周 | 提供数据迁移工具；保留 Web 端作为回退方案 |
| 安装包兼容性问题 | Windows 特定版本 | 1 周 | 覆盖 Windows 10/11 主要版本测试 |
| 性能不达标 | 低配置设备用户 | 1-2 周 | 设定明确的性能基线；提供"低性能模式"选项 |
| 自动更新机制故障 | 所有桌面用户 | 1 周 | 提供手动下载更新渠道 |

### 8.3 风险缓解总策略

1. **渐进式迁移**
   - 保持 Web 端和桌面端并行开发
   - 桌面端初期直接使用 Web 端构建产物
   - 逐步替换浏览器 API 为桌面端 API

2. **早期验证**
   - Phase 1 结束时完成核心技术验证（epubjs、pdfjs、文件操作）
   - 发现不兼容问题时及时调整方案

3. **数据安全保障**
   - 数据迁移工具经过充分测试
   - 提供 Web 端回退方案
   - 定期备份机制

4. **性能持续监控**
   - 集成性能监控工具
   - 设定性能劣化告警阈值
   - 每次发版前进行性能回归测试

---

## 九、附录

### 附录 A：Electron 项目结构建议

```
e:\chrome\book\
├── electron/                    # Electron 主进程代码
│   ├── main.js                  # 主进程入口
│   ├── preload.js               # 预加载脚本（安全桥接）
│   ├── ipc-handlers.js          # IPC 通信处理
│   ├── menu.js                  # 原生菜单配置
│   ├── tray.js                  # 系统托盘配置
│   ├── updater.js               # 自动更新逻辑
│   └── window-state.js          # 窗口状态管理
├── src/                         # 前端代码（基本不变）
│   ├── ...（现有代码）
│   └── platform/                # 新增：平台抽象层
│       ├── index.ts             # 统一接口
│       ├── web.ts               # Web 端实现
│       └── electron.ts          # Electron 端实现
├── server/                      # 后端代码（可选保留）
├── assets/
│   └── fonts/                   # 新增：本地字体
│       └── NotoSerifSC.otf
├── build/                       # 新增：打包资源
│   ├── icon.ico
│   ├── icon.png
│   └── installer.nsh            # NSIS 自定义脚本
└── ...（现有配置文件）
```

### 附录 B：关键代码变更清单

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `src/App.tsx` | 修改 | BrowserRouter → HashRouter（或通过检测环境动态选择） |
| `src/utils/db.ts` | 修改/扩展 | 增加文件系统存储后端，IndexedDB 作为 fallback |
| `src/utils/api.ts` | 修改 | API 基础 URL 动态配置（开发/生产/桌面端） |
| `src/stores/bookStore.ts` | 修改 | 数据操作适配新的存储层 |
| `src/stores/authStore.ts` | 修改 | Token 存储适配（safeStorage 加密） |
| `src/components/DropZone.tsx` | 修改 | 增加原生文件拖入支持 |
| `index.html` | 修改 | Google Fonts → 本地字体引用 |
| `vite.config.ts` | 修改 | base 路径调整为相对路径 |
| `package.json` | 修改 | 新增 Electron 相关依赖和脚本 |
| `electron/` | 新增 | 整个 Electron 主进程目录 |
| `src/platform/` | 新增 | 平台抽象层 |

### 附录 C：开发脚本命令

```json
{
  "scripts": {
    "dev": "vite",
    "dev:all": "concurrently \"vite\" \"tsx watch server/src/index.ts\"",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5174 && electron .\"",
    "build": "tsc -b && vite build",
    "electron:build": "vite build && electron-builder",
    "electron:preview": "electron .",
    "test": "vitest",
    "lint": "tsc --noEmit"
  }
}
```

### 附录 D：决策记录

| 决策项 | 决策 | 理由 |
|--------|------|------|
| 桌面框架选择 | Electron | 综合评分最高，技术可行性最强 |
| 路由方案 | HashRouter | Electron file:// 协议兼容性最好 |
| 存储方案 | SQLite + 文件系统 | 比 IndexedDB 更适合桌面端，支持大数据量 |
| 后端方案 | 渐进迁移 | 初期可内嵌 Express，后期逐步迁移到直接 DB 操作 |
| 字体方案 | 本地打包 | 离线可用，避免外部依赖 |
| 安装包格式 | NSIS | 用户级安装，支持自定义安装路径 |
