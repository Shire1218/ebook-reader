# P6 - 网页优化 开发方案

## 一、核心原则

1. **现有功能零影响**：所有已有页面、组件、样式、交互保持不变
2. **双模式共存**：未登录用户使用本地 IndexedDB 模式（与当前行为完全一致），已登录用户使用云端同步模式
3. **渐进式改造**：新增功能通过扩展而非修改实现，最小化对现有代码的侵入

---

## 二、整体架构

### 2.1 项目结构变更

```
d:\miniprogram\ebook-reader\
├── server/                          ← 新增：后端服务
│   ├── src/
│   │   ├── index.ts                 ← Express 入口
│   │   ├── config.ts                ← 环境变量与配置
│   │   ├── routes/
│   │   │   ├── auth.ts              ← 认证路由（注册/登录/刷新token）
│   │   │   ├── books.ts             ← 书籍 CRUD + 文件上传
│   │   │   ├── bookmarks.ts         ← 书签 CRUD
│   │   │   └── highlights.ts        ← 标注 CRUD
│   │   ├── middleware/
│   │   │   └── auth.ts              ← JWT 验证中间件
│   │   └── db/
│   │       └── index.ts             ← SQLite 连接 + Prisma Client
│   ├── prisma/
│   │   └── schema.prisma            ← 数据库 Schema
│   ├── uploads/                     ← 上传文件存储目录
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                         ← 环境变量（JWT_SECRET、端口等）
├── src/                             ← 前端（现有 + 新增）
│   ├── pages/
│   │   ├── Landing.tsx              ← 新增：Landing 展示页
│   │   ├── Login.tsx                ← 新增：登录页
│   │   ├── Register.tsx             ← 新增：注册页
│   │   ├── Discover.tsx             ← 新增：书籍发现/下载页
│   │   ├── Library.tsx              ← 不变
│   │   ├── Reader.tsx               ← 不变
│   │   └── Settings.tsx             ← 不变
│   ├── stores/
│   │   ├── authStore.ts             ← 新增：用户认证状态管理
│   │   ├── bookStore.ts             ← 改造：支持双模式数据源
│   │   └── preferenceStore.ts       ← 不变
│   ├── utils/
│   │   ├── api.ts                   ← 新增：API 请求封装（fetch + token 管理）
│   │   ├── db.ts                    ← 不变（本地模式保持原样）
│   │   ├── fileParser.ts            ← 不变
│   │   ├── txtParser.ts             ← 不变
│   │   └── mobiParser.ts            ← 不变
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx        ← 微调：增加登录状态检测
│   │   │   ├── Sidebar.tsx          ← 微调：增加「发现」导航项 + 用户信息区
│   │   │   └── TopBar.tsx           ← 不变
│   │   ├── ProtectedRoute.tsx       ← 新增：路由守卫组件
│   │   └── ... (其余组件不变)
│   ├── hooks/
│   │   ├── useBookImport.ts         ← 改造：已登录时同步上传到服务端
│   │   └── useKeyboardShortcuts.ts  ← 不变
│   ├── types/
│   │   └── index.ts                 ← 新增 User、AuthResponse 等类型
│   ├── App.tsx                      ← 改造：增加新路由
│   ├── main.tsx                     ← 不变
│   └── styles/
│       └── index.css                ← 新增 Landing 页相关样式
├── vite.config.ts                   ← 微调：增加 API 代理配置
├── plan.md                          ← 不变
└── plan/
    └── plan_p6.md                   ← 本文件
```

### 2.2 不变清单（明确标注）

以下文件和模块在 P6 中**不做任何修改**：

| 文件 | 说明 |
|------|------|
| `src/components/Reader/*` | 所有阅读器组件（Epub/Txt/Pdf/Mobi/SelectionToolbar） |
| `src/components/BookCard/*` | 书籍卡片组件 |
| `src/components/DropZone.tsx` | 拖拽导入蒙层 |
| `src/components/EmptyState.tsx` | 空状态组件 |
| `src/components/ResizablePanel.tsx` | 可调整面板 |
| `src/pages/Reader.tsx` | 阅读器页面 |
| `src/pages/Settings.tsx` | 设置页面 |
| `src/pages/Library.tsx` | 书架页面 |
| `src/stores/preferenceStore.ts` | 阅读偏好 store |
| `src/utils/db.ts` | IndexedDB 封装（本地模式核心） |
| `src/utils/fileParser.ts` | 文件解析 |
| `src/utils/txtParser.ts` | TXT 解析器 |
| `src/utils/mobiParser.ts` | MOBI 解析器 |
| `src/hooks/useKeyboardShortcuts.ts` | 快捷键 |
| `tailwind.config.js` | Tailwind 配置 |
| `src/styles/index.css` 现有内容 | 现有样式全部保留 |

---

## 三、阶段一：Landing 页面

### 3.1 路由设计

- 路由：`/landing`
- 不使用 `AppLayout` 布局，独立全屏展示
- 未登录用户访问 `/` 时重定向到 `/landing`
- 已登录用户访问 `/landing` 时重定向到 `/`

### 3.2 页面结构

```
┌──────────────────────────────────────────┐
│  Header: Logo「墨卷」 + 导航（功能/关于）+ 登录按钮  │
├──────────────────────────────────────────┤
│                                          │
│  Hero 区域                                │
│  标题：「墨卷 — 你的浏览器电子书阅读器」           │
│  副标题：产品简介                            │
│  CTA 按钮：「开始使用」/「登录」                 │
│                                          │
├──────────────────────────────────────────┤
│  特性展示（4 列网格）                        │
│  📚 多格式支持    🎨 主题切换               │
│  🔖 书签标注      📊 进度管理               │
├──────────────────────────────────────────┤
│  格式支持展示                              │
│  EPUB / PDF / TXT / MOBI                 │
├──────────────────────────────────────────┤
│  Footer: 版权信息                          │
└──────────────────────────────────────────┘
```

### 3.3 样式方案

- 沿用项目现有的 `warm` 暖色调色系（`warm-50` ~ `warm-900`）
- 使用 TailwindCSS 实现响应式布局
- 不引入新的 CSS 框架或组件库
- 在 `index.css` 末尾追加 Landing 页专用样式

### 3.4 涉及文件

| 操作 | 文件 |
|------|------|
| 新增 | `src/pages/Landing.tsx` |
| 修改 | `src/App.tsx`（增加路由） |
| 修改 | `src/styles/index.css`（追加 Landing 样式） |

---

## 四、阶段二：登录模块

### 4.1 后端服务

#### 4.1.1 技术栈

| 层面 | 方案 | 说明 |
|------|------|------|
| 运行时 | Node.js | 与前端同生态 |
| 框架 | Express | 轻量成熟 |
| 数据库 | SQLite | 轻量级，文件级存储，无需额外安装 |
| ORM | Prisma | TypeScript 友好，Schema 驱动 |
| 认证 | JWT | access token (2h) + refresh token (7d) |
| 密码加密 | bcryptjs | 行业标准 |
| 文件上传 | multer | Express 文件上传中间件 |
| 跨域 | cors | 开发环境代理，生产环境 CORS |

#### 4.1.2 数据库 Schema（Prisma）

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  email        String    @unique
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  books        Book[]
  bookmarks    Bookmark[]
  highlights   Highlight[]

  @@map("users")
}

model Book {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  title           String
  author          String
  format          String    // epub | pdf | txt | mobi
  coverUrl        String    @map("cover_url")
  fileSize        Int       @map("file_size")
  progress        Float     @default(0)
  currentLocation String    @default("") @map("current_location")
  currentChapter  String    @default("") @map("current_chapter")
  category        String    @default("")
  filePath        String?   @map("file_path")   // 服务端文件存储路径
  lastReadTime    DateTime  @map("last_read_time")
  importTime      DateTime  @default(now()) @map("import_time")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  user            User      @relation(fields: [userId], references: [id])
  bookmarks       Bookmark[]
  highlights      Highlight[]

  @@map("books")
}

model Bookmark {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  bookId    String    @map("book_id")
  location  String
  chapter   String
  progress  Float
  note      String?
  createdAt DateTime  @default(now()) @map("created_at")

  user      User      @relation(fields: [userId], references: [id])
  book      Book      @relation(fields: [bookId], references: [id])

  @@map("bookmarks")
}

model Highlight {
  id                String    @id @default(cuid())
  userId            String    @map("user_id")
  bookId            String    @map("book_id")
  location          String
  text              String
  color             String    // yellow | green | blue | pink | purple
  note              String?
  chapter           String
  paragraphIndex    Int?      @map("paragraph_index")
  offsetInParagraph Int?      @map("offset_in_paragraph")
  createdAt         DateTime  @default(now()) @map("created_at")

  user              User      @relation(fields: [userId], references: [id])
  book              Book      @relation(fields: [bookId], references: [id])

  @@map("highlights")
}
```

#### 4.1.3 API 设计

**认证接口（无需 token）：**

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/auth/register` | 注册 | `{ username, email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/api/auth/login` | 登录 | `{ username, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/api/auth/refresh` | 刷新 token | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| GET  | `/api/auth/me` | 获取当前用户 | - | `{ user }` |

**书籍接口（需要 token）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/books` | 获取当前用户所有书籍 |
| POST | `/api/books` | 上传新书籍（multipart/form-data，含文件 + 元信息） |
| PUT | `/api/books/:id` | 更新书籍信息（进度、位置、分类等） |
| DELETE | `/api/books/:id` | 删除书籍（级联删除书签、标注） |
| GET | `/api/books/:id/file` | 下载书籍文件 |

**书签接口（需要 token）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/books/:bookId/bookmarks` | 获取指定书籍的所有书签 |
| POST | `/api/books/:bookId/bookmarks` | 添加书签 |
| DELETE | `/api/bookmarks/:id` | 删除书签 |

**标注接口（需要 token）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/books/:bookId/highlights` | 获取指定书籍的所有标注 |
| POST | `/api/books/:bookId/highlights` | 添加标注 |
| PUT | `/api/highlights/:id` | 更新标注 |
| DELETE | `/api/highlights/:id` | 删除标注 |

**统一响应格式：**

```typescript
// 成功
{ "success": true, "data": { ... } }

// 失败
{ "success": false, "error": "错误信息" }
```

#### 4.1.4 后端目录结构

```
server/
├── src/
│   ├── index.ts              ← Express 应用入口，挂载路由和中间件
│   ├── config.ts             ← 读取 .env 配置
│   ├── routes/
│   │   ├── auth.ts           ← 认证路由
│   │   ├── books.ts          ← 书籍路由
│   │   ├── bookmarks.ts      ← 书签路由
│   │   └── highlights.ts     ← 标注路由
│   ├── middleware/
│   │   └── auth.ts           ← JWT 验证中间件（从 Authorization header 提取 token）
│   └── db/
│       └── index.ts          ← Prisma Client 单例
├── prisma/
│   └── schema.prisma         ← 数据库 Schema
├── uploads/                  ← 书籍文件存储目录（gitignore）
├── package.json
├── tsconfig.json
└── .env                      ← JWT_SECRET, DATABASE_URL, PORT 等
```

#### 4.1.5 后端新增依赖

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "@prisma/client": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "multer": "^1.4.5",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/multer": "^1.4.0",
    "@types/cors": "^2.8.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 4.2 前端改造

#### 4.2.1 新增类型定义（追加到 `src/types/index.ts`）

```typescript
// 用户信息
export interface User {
  id: string;
  username: string;
  email: string;
}

// 认证响应
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// API 统一响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

> **注意**：仅追加新类型，不修改现有任何类型定义。

#### 4.2.2 新增 authStore（`src/stores/authStore.ts`）

```
状态：
  - user: User | null          ← 当前登录用户
  - accessToken: string | null
  - refreshToken: string | null
  - isAuthenticated: boolean   ← 计算属性
  - isLoading: boolean

方法：
  - login(username, password)         ← 调用 API 登录
  - register(username, email, password) ← 调用 API 注册
  - logout()                          ← 清除状态 + 清除 localStorage
  - refreshAccessToken()              ← 刷新 token
  - initAuth()                        ← 启动时从 localStorage 恢复 token

持久化：
  - token 存储在 localStorage（key: 'auth-tokens'）
  - 应用启动时自动恢复登录状态
```

#### 4.2.3 新增 API 工具（`src/utils/api.ts`）

```
功能：
  - 封装 fetch 请求，统一处理 headers、token、错误
  - 自动在请求头添加 Authorization: Bearer <token>
  - 401 响应时自动尝试刷新 token 并重试
  - 刷新失败则清除登录状态，跳转到登录页

导出函数：
  - apiGet<T>(url): Promise<T>
  - apiPost<T>(url, body): Promise<T>
  - apiPut<T>(url, body): Promise<T>
  - apiDelete<T>(url): Promise<T>
  - apiUpload<T>(url, formData): Promise<T>  ← 文件上传
  - getApiUrl(): string                       ← 获取 API 基础地址
```

#### 4.2.4 bookStore 双模式改造

**改造策略**：在 `bookStore` 内部增加一个数据源抽象层，根据登录状态选择不同的数据操作方式。

```
改造要点：
  1. 新增内部方法判断是否已登录：
     - 未登录 → 调用现有 IndexedDB 函数（db.ts 中的函数，完全不修改）
     - 已登录 → 调用 api.ts 中的函数

  2. 现有方法改造（保持方法签名不变）：
     - loadBooks()
       - 本地模式：getAllBooks()（不变）
       - 云端模式：apiGet('/api/books')，将结果同步到 state
     - addBook(book)
       - 本地模式：dbAddBook()（不变）
       - 云端模式：apiUpload('/api/books', formData)，同时写入本地 IndexedDB 缓存
     - updateBook(book)
       - 本地模式：dbUpdateBook()（不变）
       - 云端模式：apiPut('/api/books/:id', data)
     - removeBook(id)
       - 本地模式：dbDeleteBook()（不变）
       - 云端模式：apiDelete('/api/books/:id')

  3. 对外接口完全不变：
     - bookStore 的 state 结构不变
     - 所有方法签名不变
     - Library.tsx、Reader.tsx 等消费方无需任何修改

  4. 模式切换：
     - 用户登录时：调用 loadBooks() 从云端重新加载
     - 用户登出时：清空 state，下次 loadBooks() 自动切回本地模式
```

#### 4.2.5 useBookImport 改造

```
改造要点：
  - 已登录时，导入书籍后额外上传文件到服务端
  - 上传使用 FormData（文件 + 书籍元信息 JSON）
  - 上传失败不影响本地导入结果（静默失败，下次同步时重试）
  - 未登录时行为完全不变
```

#### 4.2.6 新增登录/注册页面

**Login.tsx：**
- 用户名 + 密码输入
- 登录按钮 + 跳转注册链接
- 居中卡片式布局，沿用 warm 暖色调
- 登录成功后跳转到 `/`（书架）

**Register.tsx：**
- 用户名 + 邮箱 + 密码 + 确认密码
- 注册按钮 + 跳转登录链接
- 与登录页风格一致
- 注册成功后自动登录并跳转到 `/`

#### 4.2.7 新增路由守卫（`src/components/ProtectedRoute.tsx`）

```
逻辑：
  - 检查 authStore.isAuthenticated
  - 已登录 → 渲染 <Outlet />
  - 未登录 → 重定向到 /login
  - 可选配置：某些路由允许本地模式访问（如书架）
```

#### 4.2.8 App.tsx 路由改造

```typescript
// 改造后的路由结构
<BrowserRouter>
  <Routes>
    {/* 独立页面（不使用 AppLayout） */}
    <Route path="/landing" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />

    {/* 应用主路由 */}
    <Route element={<AppLayout />}>
      <Route path="/" element={<Library />} />
      <Route path="/reader/:bookId" element={<Reader />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/discover" element={<Discover />} />
    </Route>
  </Routes>
</BrowserRouter>
```

> **注意**：现有的 `/`、`/reader/:bookId`、`/settings` 路由保持不变，不添加路由守卫。未登录用户仍可正常使用本地模式。

#### 4.2.9 Sidebar 微调

```
改造内容（在现有结构基础上追加）：
  1. navItems 数组新增一项：
     { icon: Compass, label: '发现', path: '/discover' }

  2. 折叠按钮上方新增用户信息区（仅登录时显示）：
     - 显示用户头像（首字母圆形头像）+ 用户名
     - 登出按钮
     - 折叠时只显示头像图标

  3. 未登录时用户信息区显示「登录」按钮，点击跳转到 /login
```

#### 4.2.10 Vite 代理配置

```typescript
// vite.config.ts 新增 proxy 配置
server: {
  port: 5174,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

### 4.3 数据流示意

```
┌─────────────────────────────────────────────────┐
│                   前端 (React)                    │
│                                                   │
│  ┌──────────┐    ┌──────────────┐                │
│  │ authStore │───→│ bookStore    │                │
│  │ (登录状态) │    │ (判断数据源)  │                │
│  └──────────┘    └──────┬───────┘                │
│                         │                         │
│              ┌──────────┴──────────┐              │
│              ▼                     ▼              │
│     ┌──────────────┐    ┌──────────────┐         │
│     │ 本地模式      │    │ 云端模式      │         │
│     │ (IndexedDB)  │    │ (api.ts)     │         │
│     │ db.ts 不变    │    │ fetch + JWT  │         │
│     └──────────────┘    └──────┬───────┘         │
│                                │                  │
└────────────────────────────────┼──────────────────┘
                                 │ HTTP (proxy /api)
                                 ▼
                    ┌──────────────────────┐
                    │   后端 (Express)      │
                    │                      │
                    │  JWT 中间件验证        │
                    │       ↓              │
                    │  路由处理             │
                    │       ↓              │
                    │  Prisma ORM         │
                    │       ↓              │
                    │  SQLite 数据库       │
                    │                      │
                    │  uploads/ 文件存储    │
                    └──────────────────────┘
```

---

## 五、阶段三：联网下载书籍

### 5.1 页面设计

**Discover.tsx（发现页）：**

```
┌──────────────────────────────────────────┐
│  TopBar（标题：发现书籍）                    │
├──────────────────────────────────────────┤
│                                          │
│  推荐书籍资源（卡片网格）                    │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ 古腾堡 │ │ 好读    │ │ Z-Lib │       │
│  │ 计划   │ │        │ │       │       │
│  └────────┘ └────────┘ └────────┘       │
│                                          │
│  每个卡片包含：                             │
│  - 站点名称 + 简介                         │
│  - 站点 Logo/图标                          │
│  - 「前往下载」按钮（新标签页打开外部链接）     │
│  - 「复制地址」按钮                          │
│                                          │
└──────────────────────────────────────────┘
```

### 5.2 资源数据

资源列表硬编码在前端（静态数据），后续可扩展为从后端获取：

```typescript
const DISCOVER_SOURCES = [
  {
    name: '古腾堡计划',
    description: '超过 70,000 本免费电子书，以公版书籍为主',
    url: 'https://www.gutenberg.org/',
    icon: 'BookOpen',
  },
  // ... 更多资源
];
```

### 5.3 涉及文件

| 操作 | 文件 |
|------|------|
| 新增 | `src/pages/Discover.tsx` |
| 修改 | `src/App.tsx`（增加路由，已在阶段二包含） |
| 修改 | `src/components/Layout/Sidebar.tsx`（增加导航项，已在阶段二包含） |

---

## 六、开发顺序与检查点

### 阶段一：Landing 页面

| 步骤 | 内容 | 检查点 |
|------|------|--------|
| 1 | 新建 `src/pages/Landing.tsx` | 页面可独立访问 |
| 2 | 修改 `src/App.tsx` 增加 `/landing` 路由 | `/landing` 可访问，现有路由不受影响 |
| 3 | 追加 Landing 样式到 `index.css` | 现有样式无变化 |
| 4 | 验证 | `npm run check` 通过，`npm run build` 成功 |

### 阶段二：登录模块

| 步骤 | 内容 | 检查点 |
|------|------|--------|
| 1 | 搭建 server/ 目录，初始化后端项目 | `npm install` 成功 |
| 2 | 编写 Prisma Schema + 初始化数据库 | `npx prisma migrate dev` 成功 |
| 3 | 实现认证路由（注册/登录/刷新） | API 可通过 curl/Postman 测试 |
| 4 | 实现书籍/书签/标注 API | 所有 CRUD 接口可用 |
| 5 | 新增 `src/types/index.ts` 追加类型 | TypeScript 无报错 |
| 6 | 新增 `src/utils/api.ts` | API 工具函数可用 |
| 7 | 新增 `src/stores/authStore.ts` | 登录状态管理可用 |
| 8 | 新增 `src/pages/Login.tsx` + `Register.tsx` | 登录/注册页面可访问 |
| 9 | 新增 `src/components/ProtectedRoute.tsx` | 路由守卫逻辑正确 |
| 10 | 改造 `src/stores/bookStore.ts`（双模式） | 本地模式不受影响 |
| 11 | 改造 `src/hooks/useBookImport.ts` | 本地导入不受影响 |
| 12 | 微调 `src/components/Layout/Sidebar.tsx` | 现有导航不受影响 |
| 13 | 修改 `vite.config.ts` 增加代理 | API 请求可正确代理 |
| 14 | 验证 | 本地模式全流程正常；登录后可通过云端操作 |

### 阶段三：联网下载

| 步骤 | 内容 | 检查点 |
|------|------|--------|
| 1 | 新建 `src/pages/Discover.tsx` | 页面可访问 |
| 2 | 验证 | 所有外部链接可正常打开 |

---

## 七、启动命令

```bash
# 前端（不变）
npm run dev          # Vite 开发服务器 (port 5174)

# 后端（新增）
cd server
npm install          # 安装后端依赖
npx prisma migrate dev --name init   # 初始化数据库
npm run dev          # 启动后端服务 (port 3000)

# 同时开发
# 终端 1: cd server && npm run dev
# 终端 2: npm run dev
```

---

## 八、风险与注意事项

| 风险 | 应对策略 |
|------|----------|
| bookStore 改造引入 bug | 双模式通过条件分支实现，本地模式代码路径完全不变 |
| 后端服务不可用时影响前端 | 前端 API 调用失败时静默降级，不阻塞本地模式使用 |
| SQLite 并发写入 | SQLite 支持 WAL 模式，个人使用场景并发量极低 |
| 文件上传大小限制 | Express 默认限制 1MB，需配置 multer 限制（建议 200MB） |
| JWT token 泄露 | token 存储在 localStorage，XSS 防护由 React 内置处理 |
| 数据库迁移失败 | Prisma migrate 支持回滚，开发阶段可重置重建 |

---

## 九、后续扩展预留（P6 不实现）

- 书籍数据同步冲突解决（本地 vs 云端）
- 阅读偏好云端同步
- WebSocket 实时同步
- 社交功能（书评、分享）
- 移动端适配优化
