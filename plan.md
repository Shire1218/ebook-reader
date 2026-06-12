# 电子书阅读器开发计划

## 一、项目概述

开发一款面向桌面浏览器的电子书阅读器 Web 应用，支持多种格式（EPUB、TXT、PDF），提供舒适的阅读体验和完整的书籍管理功能。目标用户为喜欢在浏览器中阅读电子书的用户，对标微信读书、Kindle 阅读器的核心体验。

## 二、技术选型

| 层面 | 方案 | 说明 |
|------|------|------|
| 框架 | React 18 + TypeScript | 组件化开发，生态成熟 |
| 构建工具 | Vite 6 | 快速开发与构建 |
| EPUB 渲染 | epub.js | 主流 EPUB 渲染引擎 |
| PDF 渲染 | pdfjs-dist | Mozilla 开源 PDF 渲染方案 |
| TXT 渲染 | 自研解析器 + chardet-js | 自动检测 UTF-8/GBK/GB18030 编码，章节自动分割 |
| 样式方案 | TailwindCSS 3 | 快速构建响应式 UI |
| 状态管理 | Zustand 5 | 轻量级状态管理 |
| 本地存储 | IndexedDB + localStorage | 书籍存储与配置持久化 |
| 路由 | React Router v6 | SPA 路由管理 |
| 图标库 | Lucide React | 统一图标风格 |
| 部署方式 | Web 应用（浏览器运行） | 纯前端项目，无需后端服务；后续可选 Electron 桌面端 |

## 三、核心功能模块

### 3.1 书架模块（Library）
- 书籍导入（拖拽 / 文件选择，支持 EPUB、PDF、TXT）
- 书籍封面展示（网格 / 列表视图切换）
- 最近阅读、阅读进度显示
- 搜索与排序（按导入时间/最近阅读/书名）
- 书籍删除

### 3.2 阅读器模块（Reader）
- **EPUB 渲染**: 基于 epub.js，支持分页、主题切换、字体设置、目录导航
- **TXT 渲染**: 自研解析器，支持章节分割、滚动阅读、编码检测（UTF-8/GBK）、键盘翻页
- **PDF 渲染**: 基于 pdfjs-dist，支持翻页、页码显示、目录导航
- 字体设置：字体族、字号、行距
- 主题切换：白天 / 夜间 / 护眼 / 牛皮纸
- 页码/进度显示与跳转
- 目录（TOC）导航
- 书签管理（添加/删除/列表/跳转）
- 阅读进度追踪和断点续读

### 3.3 设置模块（Settings）
- 字体选择（系统默认、思源宋体、等宽字体）
- 字号调节（12-48px）
- 行距调节（1.0-3.0）
- 主题切换预览
- 亮度调节
- 恢复默认设置

## 四、开发阶段

### P0 - 基础框架（已完成）
- [x] 项目初始化（Vite + React + TypeScript + TailwindCSS）
- [x] 项目目录结构搭建
- [x] 路由配置（`/` 书架、`/reader/:bookId` 阅读器、`/settings` 设置）
- [x] 全局布局组件（可折叠侧边栏 + 顶部工具栏）
- [x] 书架页面 UI（网格/列表视图、书籍卡片、搜索、排序）
- [x] 状态管理（Zustand：bookStore + preferenceStore）
- [x] 书籍导入功能（拖拽/文件选择 + IndexedDB 文件存储）
- [x] 设置页面（字体/字号/行距/主题/亮度 + 实时预览）

### P1 - 核心阅读（已完成）
- [x] TXT 文件解析器（编码检测 UTF-8/GBK、章节自动分割、HTML 转换）
- [x] EPUB 阅读器组件（epub.js 集成、主题样式注入、目录加载）
- [x] TXT 阅读器组件（滚动模式、章节导航、键盘翻页）
- [x] Reader 页面重写（根据格式自动选择渲染引擎）
- [x] 阅读设置实时生效（字体/字号/行距/主题）
- [x] 代码分割优化（epubjs / pdfjs / vendor 独立 chunk）

### P2 - 阅读增强（已完成）
- [x] 目录导航（点击跳转到对应章节/页面）
- [x] 进度管理（底部进度条展示和拖动）
- [x] 书签功能（添加/删除/列表/跳转，IndexedDB 持久化）
- [x] PDF 支持（pdfjs-dist 集成、翻页、页码显示、目录加载）
- [x] 阅读位置防抖保存（2秒防抖）
- [x] TypeScript 检查 + 构建验证

### P3 - 标注系统（已完成）
- [x] 文本高亮（多色）
- [x] 批注功能
- [x] 笔记管理
- [x] 标注导出

### P4 - 体验优化（待开发）
- [ ] 全文搜索
- [ ] 快捷键支持
- [ ] 动画效果优化
- [ ] 性能优化
- [ ] MOBI 格式支持
- [ ] 书籍分类
- [ ] 全文内搜索
- [ ] 拖拽进度条以定位
- [ ] 支持更多的字体

### P5 - 编辑操作（待开发）
- [ ] 文本编辑（复制、粘贴、删除）
- [ ] 格式化（加粗、斜体、下划线）
- [ ] 段落格式（段落间距、对齐方式）

### 后续功能（待开发）
- [ ] 标注导出（PDF、图片）
- [ ] 书签同步（云存储）
- [ ] 书籍收藏（IndexedDB 持久化）
- [ ] 评论功能（用户评论、点赞、收藏）
- [ ] 离线使用

## 五、主流阅读器对标配置

参考微信读书、Kindle、多看阅读等主流产品的标准配置：

- **字体**：支持系统字体 + 内置精选字体（思源宋体），字号 12-48px 可调
- **行距**：1.0 - 3.0 倍可调
- **主题**：4 种预设主题（白天/夜间/护眼/牛皮纸）
- **排版**：支持首行缩进、段间距
- **进度**：百分比 + 页码双模式，章节级别进度追踪
- **缓存**：已读书籍离线缓存（IndexedDB），支持断点续读

## 六、项目结构

```
e:\chrome\book\
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx          # 全局布局（侧边栏 + 主内容区）
│   │   │   ├── Sidebar.tsx            # 侧边导航栏（可折叠）
│   │   │   └── TopBar.tsx             # 顶部工具栏（搜索/视图切换/导入）
│   │   ├── BookCard/
│   │   │   ├── BookCardGrid.tsx       # 网格视图书籍卡片
│   │   │   └── BookCardList.tsx       # 列表视图书籍行
│   │   ├── Reader/
│   │   │   ├── EpubReader.tsx         # EPUB 渲染器（epub.js）
│   │   │   ├── TxtReader.tsx          # TXT 渲染器（滚动模式）
│   │   │   └── PdfReader.tsx          # PDF 渲染器（pdfjs-dist）
│   │   ├── DropZone.tsx               # 拖拽导入蒙层
│   │   └── EmptyState.tsx             # 空状态提示
│   ├── pages/
│   │   ├── Library.tsx                # 书架页面
│   │   ├── Reader.tsx                 # 阅读器页面（集成目录/书签/设置/进度）
│   │   └── Settings.tsx               # 设置页面
│   ├── stores/
│   │   ├── bookStore.ts               # 书籍数据 store（CRUD + 搜索/排序）
│   │   └── preferenceStore.ts         # 阅读偏好 store（localStorage 持久化）
│   ├── hooks/
│   │   └── useBookImport.ts           # 书籍导入 hook（文件解析 + IndexedDB 存储）
│   ├── utils/
│   │   ├── db.ts                      # IndexedDB 工具（books/files/bookmarks/preferences）
│   │   ├── fileParser.ts              # 文件解析工具（格式检测/元信息提取）
│   │   └── txtParser.ts               # TXT 解析器（编码检测/章节分割/分页/HTML转换）
│   ├── types/
│   │   └── index.ts                   # 全局类型定义
│   ├── styles/
│   │   └── index.css                  # 全局样式 + Tailwind 入口
│   ├── App.tsx                        # 根组件 + 路由配置
│   ├── main.tsx                       # 入口文件
│   └── vite-env.d.ts                  # Vite 类型声明
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

## 七、数据模型

### 7.1 TypeScript 类型定义

```typescript
// 书籍格式
type BookFormat = 'epub' | 'pdf' | 'txt';

// 主题类型
type ThemeType = 'light' | 'dark' | 'sepia' | 'green';

// 视图模式
type ViewMode = 'grid' | 'list';

// 排序方式
type SortBy = 'lastRead' | 'title' | 'importTime';

// 书籍元信息
interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  coverUrl: string;          // 封面颜色（HSL 格式，基于书名哈希生成）
  fileSize: number;
  progress: number;           // 阅读进度 0-100
  currentLocation: string;    // 阅读位置（EPUB: CFI, TXT: JSON, PDF: JSON）
  currentChapter: string;
  lastReadTime: number;
  importTime: number;
}

// 阅读偏好
interface ReadingPreference {
  fontFamily: string;
  fontSize: number;           // 12-48px
  lineHeight: number;         // 1.0-3.0
  theme: ThemeType;
  brightness: number;         // 0-100
  viewMode: ViewMode;
}

// 目录项
interface TocItem {
  id: string;
  label: string;
  href: string;
  children?: TocItem[];
}

// 书签
interface Bookmark {
  id: string;
  bookId: string;
  location: string;           // 书签位置（与 Book.currentLocation 格式一致）
  chapter: string;            // 章节名称
  progress: number;           // 书签位置进度 0-100
  note?: string;
  createdAt: number;
}
```

### 7.2 IndexedDB 结构

- **数据库名称**: `ebook-reader-db`
- **版本**: 3
- **Object Stores**:

| Store | KeyPath | 索引 | 说明 |
|-------|---------|------|------|
| `books` | `id` | `importTime`, `lastReadTime` | 书籍元信息 |
| `files` | `bookId` | - | 书籍文件二进制数据（ArrayBuffer） |
| `bookmarks` | `id` | `bookId`, `createdAt` | 书签数据 |
| `preferences` | `key` | - | 阅读偏好 |

## 八、性能预算与硬件适配

基于当前开发机配置（i3-10105 / 16GB RAM / UHD 630）：

| 指标 | 预算 | 说明 |
|------|------|------|
| 首屏加载 | < 2s | 路由懒加载 + 代码分割 |
| 内存占用 | < 500MB | 单本书籍渲染内存上限 |
| 翻页帧率 | >= 30fps | 使用 CSS transform 动画，避免 Canvas 重绘 |
| 大文件支持 | EPUB < 200MB, PDF < 500 页 | 超出时分块加载或提示用户 |
| IndexedDB 存储 | 单书籍 < 100MB | 超出建议直接使用 File API 读取 |

**硬件适配策略：**
- PDF 渲染限制同时渲染页数为 1 页（UHD 630 性能有限）
- 大文件采用流式读取（File API slice），避免一次性加载到内存
- epubjs / pdfjs-dist 独立 chunk，按需加载

## 九、错误处理与降级策略

| 场景 | 处理方式 |
|------|----------|
| 文件格式不支持 | 弹窗提示支持的格式列表，引导用户转换 |
| 文件损坏/解析失败 | 显示错误信息，提供「重试」和「移除」选项 |
| TXT 编码检测失败 | 默认回退到 UTF-8（TextDecoder 容错模式） |
| EPUB 结构异常 | 尝试降级解析，提取纯文本内容展示 |
| IndexedDB 存储空间不足 | 提示用户清理，支持删除已缓存书籍 |
| PDF 加载失败 | 控制台输出错误，显示加载失败状态 |
| 字体加载失败 | 回退到系统默认字体 |

## 十、数据持久化方案

**localStorage（< 5MB）：**
- 阅读偏好设置（字体、主题、亮度等）

**IndexedDB（书籍数据仓库）：**
- 书籍文件二进制数据（以 ArrayBuffer 存储）
- 书籍元信息（标题、作者、封面、文件大小、导入时间）
- 阅读进度（位置信息 + 百分比）
- 书签数据（位置、章节、进度、备注）

**存储策略：**
- 导入书籍时同时保存元信息和文件二进制数据
- 阅读位置防抖保存（2秒间隔）
- 提供「清理缓存」功能，可批量删除已缓存的书籍文件
- 书签数据独立存储，不受书籍缓存清理影响

## 十一、响应式设计策略

| 断点 | 宽度 | 布局方案 |
|------|------|----------|
| 桌面端 | >= 1280px | 侧边栏 + 主内容区，书架网格 4-6 列 |
| 小桌面/平板横屏 | >= 1024px | 可折叠侧边栏，书架网格 3-4 列 |
| 平板竖屏 | >= 768px | 侧边栏隐藏，书架网格 2-3 列 |
| 手机端 | < 768px | 全宽布局，书架网格 2 列 |

- 阅读器区域始终占满可用空间，顶部/底部工具栏固定
- 设置面板为右侧抽屉，可展开/收起
- 目录面板为左侧抽屉，可展开/收起

## 十二、测试策略

| 测试类型 | 工具 | 覆盖范围 |
|----------|------|----------|
| 单元测试 | Vitest | 工具函数、TXT 解析器、状态管理 |
| 组件测试 | Vitest + Testing Library | 核心 UI 组件交互逻辑 |
| E2E 测试 | Playwright | 书籍导入 → 阅读 → 标注核心流程 |
| 手动测试 | 浏览器 | 多格式书籍兼容性、不同屏幕尺寸 |

**关键测试场景：**
- 各格式文件（EPUB/PDF/TXT）的导入与渲染
- 编码自动检测准确性（UTF-8/GBK/GB18030）
- 阅读进度保存与恢复
- 书签的创建、删除、跳转
- 大文件加载性能（内存不超限）

## 十三、快捷键方案

| 快捷键 | 功能 |
|--------|------|
| `←` / `→` | 上一章 / 下一章（TXT/PDF） |
| `↑` / `↓` | 向上/向下滚动一屏（TXT） |
| `PageUp` / `PageDown` | 向上/向下翻页 |
| `Space` | 向下翻页（TXT） |

## 十四、构建产物

```
dist/
├── index.html              0.97 kB
├── assets/
│   ├── index.css          19.88 kB  (gzip: 4.29 kB)
│   ├── index.js           51.50 kB  (gzip: 14.09 kB)   ← 应用代码
│   ├── vendor.js         161.80 kB  (gzip: 53.02 kB)   ← React/Zustand/Router
│   ├── epubjs.js         351.58 kB  (gzip: 108.54 kB)  ← epubjs 引擎
│   └── pdfjs.js          452.16 kB  (gzip: 134.75 kB)  ← pdfjs 引擎
```

## 十五、运行命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建（含 TypeScript 检查）
npm run build

# 预览构建结果
npm run preview

# TypeScript 检查
npx tsc --noEmit
```

## 十六、待优化项

1. **性能优化**
   - 大文件分块加载
   - 虚拟滚动（书籍数量多时）
   - 图片懒加载

2. **功能增强**
   - 全文搜索
   - 文本高亮和批注（P3）
   - 导出笔记
   - 更多快捷键
   - MOBI 格式支持

3. **用户体验**
   - 加载动画优化
   - 翻页动画
   - 手势支持（移动端）
   - 离线缓存

4. **兼容性**
   - 更多浏览器测试
   - 移动端适配优化
