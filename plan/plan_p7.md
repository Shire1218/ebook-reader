# P7 - 阅读数据统计与可视化

## 一、阶段目标

为墨卷添加完整的阅读数据统计与可视化功能，包括：

1. **每日/每周/每月阅读时长统计** -- 追踪用户在阅读器中的实际阅读时间，按日、周、月维度聚合展示
2. **阅读热力图** -- 以 GitHub Contribution 风格展示全年每日阅读时长
3. **年度阅读报告** -- 类似豆瓣年度总结，汇总全年阅读数据生成可视化报告页

---

## 二、现状分析

### 2.1 已有基础

| 能力 | 状态 | 说明 |
|------|------|------|
| 阅读进度追踪 | 已实现 | 四种格式均支持进度百分比计算，2 秒防抖保存 |
| 最近阅读时间 | 已实现 | `lastReadTime` 字段，每次保存进度时更新 |
| 本地持久化 | 已实现 | IndexedDB `books` 存储，`lastReadTime` 已建索引 |
| 云端持久化 | 已实现 | SQLite `books` 表含 `last_read_time` 字段 |
| 状态管理 | 已实现 | Zustand `bookStore` 管理书籍数据，支持本地+云端双写 |

### 2.2 缺失部分

| 能力 | 状态 | 说明 |
|------|------|------|
| 阅读时长计时 | 未实现 | 无计时器/会话机制，不知道用户读了多久 |
| 阅读会话记录 | 未实现 | 无 `ReadingSession` 数据模型 |
| 按日聚合统计 | 未实现 | 无每日阅读时长数据 |
| 热力图组件 | 未实现 | 无可视化组件 |
| 年度阅读报告 | 未实现 | 无报告页面和数据聚合逻辑 |

---

## 三、数据模型设计

### 3.1 新增 ReadingSession 模型

新增 `ReadingSession`（阅读会话）表，记录每一次阅读的起止时间和时长。

**Prisma Schema 变更：**

```prisma
model ReadingSession {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  bookId      String   @map("book_id")
  startTime   DateTime @map("start_time")
  endTime     DateTime @map("end_time")
  duration    Int      // 阅读时长，单位：秒
  startPage   String?  @map("start_page")    // 起始位置（页码/CFI/字符偏移）
  endPage     String?  @map("end_page")      // 结束位置
  startChapter String? @map("start_chapter") // 起始章节
  endChapter  String?  @map("end_chapter")   // 结束章节
  date        String   // 会话日期，格式 YYYY-MM-DD，便于按日聚合查询
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])
  book Book @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@index([userId, date])
  @@index([userId, bookId])
  @@map("reading_sessions")
}
```

**User 和 Book 模型关联变更：**

```prisma
// User 模型新增
readingSessions ReadingSession[]

// Book 模型新增
readingSessions ReadingSession[]
```

### 3.2 IndexedDB 本地存储变更

在 `db.ts` 中新增 `readingSessions` 对象存储：

```typescript
// 数据库版本升级至 v10
const DB_VERSION = 10;

// 新增 readingSessions 存储
const sessionStore = db.createObjectStore('readingSessions', { keyPath: 'id' });
sessionStore.createIndex('userId', 'userId', { unique: false });
sessionStore.createIndex('date', 'date', { unique: false });
sessionStore.createIndex('bookId', 'bookId', { unique: false });
sessionStore.createIndex('userId_date', ['userId', 'date'], { unique: false });
```

**ReadingSession 类型定义：**

```typescript
interface ReadingSession {
  id: string;
  userId: string;
  bookId: string;
  startTime: number;      // 时间戳
  endTime: number;        // 时间戳
  duration: number;       // 秒
  startPage?: string;
  endPage?: string;
  startChapter?: string;
  endChapter?: string;
  date: string;           // YYYY-MM-DD
}
```

### 3.3 会话去重与合并策略

为避免产生过多碎片记录，采用以下策略：

- **同一本书、间隔 < 5 分钟** 的会话合并为一条（更新 `endTime` 和 `duration`）
- **切换书籍** 时结束当前会话，开始新会话
- **关闭阅读器/切换页面** 时结束当前会话
- **最小记录阈值**：阅读时长 < 30 秒的会话不记录（避免误触）

---

## 四、功能模块设计

### 4.1 模块一：阅读时长追踪（基础设施）

**涉及文件：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/types/index.ts` | 修改 | 新增 `ReadingSession` 类型 |
| `src/utils/db.ts` | 修改 | 数据库升级至 v10，新增 `readingSessions` 存储 |
| `src/stores/readingStatsStore.ts` | 新建 | 阅读统计状态管理（会话计时、统计数据） |
| `src/hooks/useReadingTimer.ts` | 新建 | 阅读计时 Hook |
| `src/pages/Reader.tsx` | 修改 | 集成阅读计时 Hook |
| `server/prisma/schema.prisma` | 修改 | 新增 `ReadingSession` 模型 |
| `server/prisma/migrations/` | 新增 | 数据库迁移文件 |
| `server/src/routes/readingStats.ts` | 新建 | 阅读统计 API 路由 |
| `server/src/index.ts` | 修改 | 挂载新路由 |

**核心逻辑 -- `useReadingTimer` Hook：**

```
进入阅读器 → 开始计时（记录 startTime）
  ↓
位置变化（翻页/滚动） → 重置空闲计时器
  ↓
空闲超过 3 分钟 → 暂停计时（用户可能离开了）
  ↓
用户操作恢复 → 继续计时
  ↓
离开阅读器（切换页面/关闭） → 结束会话，保存 ReadingSession
```

**关键实现要点：**
- 使用 `useEffect` 在 Reader 组件挂载/卸载时管理会话生命周期
- 通过 `visibilitychange` 事件检测页面可见性变化，页面隐藏时暂停计时
- 通过监听用户交互事件（click、scroll、keydown）检测空闲状态
- 会话结束时自动保存到 IndexedDB，已登录时同步到云端

### 4.2 模块二：每日/每周/每月阅读时长统计

**涉及文件：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/pages/Stats.tsx` | 新建 | 统计页面 |
| `src/components/Stats/DailyStats.tsx` | 新建 | 每日统计卡片 |
| `src/components/Stats/WeeklyChart.tsx` | 新建 | 每周柱状图 |
| `src/components/Stats/MonthlyChart.tsx` | 新建 | 每月柱状图 |
| `src/components/Stats/BookRanking.tsx` | 新建 | 阅读时长书籍排行 |
| `src/components/Stats/StatsSummary.tsx` | 新建 | 统计摘要卡片（总时长、连续天数等） |
| `src/stores/readingStatsStore.ts` | 修改 | 添加数据聚合逻辑 |
| `src/App.tsx` | 修改 | 添加统计页路由 |
| `src/components/Layout/Sidebar.tsx` | 修改 | 侧边栏添加统计入口 |

**统计页面布局设计：**

```
┌─────────────────────────────────────────────────┐
│  阅读统计                                        │
├─────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ 今日      │ │ 本周      │ │ 本月      │ │ 连续阅读  │
│  │ 1h 23m   │ │ 8h 45m   │ │ 32h 10m  │ │ 15 天    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘
├─────────────────────────────────────────────────┤
│  每周阅读时长                          [周/月切换]  │
│  ┌─────────────────────────────────────────────┐│
│  │  █                                           ││
│  │  █   █                       █               ││
│  │  █   █   █           █       █   █           ││
│  │  █   █   █   █       █   █   █   █           ││
│  │  一  二  三  四  五  六  日                    ││
│  └─────────────────────────────────────────────┘│
├─────────────────────────────────────────────────┤
│  阅读时长排行（本月）                              │
│  ┌─────────────────────────────────────────────┐│
│  │  1. 《深入理解计算机系统》    ████████  12h 30m ││
│  │  2. 《设计模式》              █████     8h 15m  ││
│  │  3. 《人类简史》              ███       5h 00m  ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

**数据聚合逻辑（在 Store 中实现）：**

- `getDailyStats(date)` -- 获取指定日期的阅读总时长、会话数、涉及书籍
- `getWeeklyStats(startDate)` -- 获取指定周（7 天）的每日阅读时长数组
- `getMonthlyStats(year, month)` -- 获取指定月的每日阅读时长数组
- `getBookRanking(period)` -- 获取指定时间段内的书籍阅读时长排行
- `getStreakDays()` -- 计算连续阅读天数

**图表实现：**
- 使用纯 CSS/SVG 实现柱状图，不引入第三方图表库（保持项目轻量）
- 柱状图支持 hover 显示具体数值
- 响应式布局，适配不同屏幕宽度

### 4.3 模块三：阅读热力图

**涉及文件：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/components/Stats/ReadingHeatmap.tsx` | 新建 | 热力图组件 |
| `src/components/Stats/HeatmapLegend.tsx` | 新建 | 热力图图例 |
| `src/pages/Stats.tsx` | 修改 | 集成热力图组件 |

**热力图设计：**

```
     一月        二月        三月       ...
  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
一│   │   │   │   │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
二│   │   │   │   │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
三│   │   │   │ ■ │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
四│   │   │   │   │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
五│   │   │   │   │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
六│   │   │   │   │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
日│   │   │   │   │   │   │   │   │   │   │
  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
                              少 ◻ ◼ ◼ ◼ ■ 多

  色阶（与项目暖色调主题一致）：
  0 分钟     : #f5f0e8（暖灰白）
  1-30 分钟  : #fde8c8（浅橙）
  30-60 分钟 : #f9b87c（中橙）
  60-120 分钟: #e88a4a（深橙）
  120+ 分钟  : #c45e24（重橙）
```

**热力图实现要点：**
- 展示当前年份（1 月 1 日 ~ 12 月 31 日）的每日阅读数据
- 每个方块为 12x12px，间距 3px
- 按周（列）排列，每列 7 行（周一到周日）
- 月份标签显示在顶部
- hover 方块显示：日期 + 阅读时长 + 阅读的书籍
- 底部图例说明色阶含义
- 支持年份切换（查看历史年份数据）
- 使用 CSS Grid 布局

### 4.4 模块四：年度阅读报告

**涉及文件：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/pages/AnnualReport.tsx` | 新建 | 年度报告页面（全屏沉浸式） |
| `src/components/AnnualReport/ReportCover.tsx` | 新建 | 报告封面 |
| `src/components/AnnualReport/ReportOverview.tsx` | 新建 | 年度概览（总时长、总书籍、总天数） |
| `src/components/AnnualReport/ReportMonthly.tsx` | 新建 | 月度阅读趋势 |
| `src/components/AnnualReport/ReportTopBooks.tsx` | 新建 | 年度最爱书籍 TOP 5 |
| `src/components/AnnualReport/ReportStreak.tsx` | 新建 | 连续阅读记录 |
| `src/components/AnnualReport/ReportFormat.tsx` | 新建 | 阅读格式偏好分布 |
| `src/components/AnnualReport/ReportEnding.tsx` | 新建 | 报告结尾（阅读人格标签） |
| `src/App.tsx` | 修改 | 添加年度报告路由 |

**年度报告页面设计（全屏沉浸式，上下滚动翻页）：**

```
╔═══════════════════════════════════════════════╗
║  第 1 页 - 封面                                ║
║                                               ║
║           墨卷 · 2026 阅读报告                  ║
║                                               ║
║           「你的阅读旅程」                       ║
║                                               ║
║              [ 向下滚动开始 ]                    ║
╠═══════════════════════════════════════════════╣
║  第 2 页 - 年度概览                             ║
║                                               ║
║   这一年，你一共阅读了                           ║
║                                               ║
║      📚 23 本书    ⏱ 186 小时    📅 245 天     ║
║                                               ║
║   相当于读完了 3.2 个书架的书                     ║
╠═══════════════════════════════════════════════╣
║  第 3 页 - 月度趋势                             ║
║                                               ║
║   [月度阅读时长折线图/柱状图]                     ║
║                                               ║
║   你在 3 月读得最多，共计 28 小时                 ║
║   有 2 个月你一本书也没翻开                       ║
╠═══════════════════════════════════════════════╣
║  第 4 页 - 年度最爱                             ║
║                                               ║
║   你花最多时间的 5 本书：                        ║
║   1.《xxx》  32h  --  读完了 85%               ║
║   2.《xxx》  28h  --  读完了 100%              ║
║   ...                                         ║
╠═══════════════════════════════════════════════╣
║  第 5 页 - 阅读习惯                             ║
║                                               ║
║   你最长的连续阅读记录：15 天                     ║
║   你最晚的一次阅读：凌晨 2:34                    ║
║   你最常阅读的格式：EPUB（68%）                  ║
║   你一共做了 156 条标注                         ║
╠═══════════════════════════════════════════════╣
║  第 6 页 - 结尾                                ║
║                                               ║
║   你的阅读人格：「深耕者」                        ║
║   "你偏爱深度阅读，常常在同一本书上投入大量时间"    ║
║                                               ║
║              [ 返回书架 ]                       ║
╚═══════════════════════════════════════════════╝
```

**阅读人格计算规则：**

| 人格 | 条件 | 描述 |
|------|------|------|
| 博览者 | 阅读书籍 > 30 本，平均每本时长 < 5h | 涉猎广泛，快速浏览 |
| 深耕者 | 平均单本阅读时长 > 15h | 深度阅读，专注投入 |
| 夜猫子 | 22:00 后阅读占比 > 50% | 夜深人静时最爱读书 |
| 晨读者 | 6:00-9:00 阅读占比 > 40% | 清晨时光，书卷相伴 |
| 坚持者 | 连续阅读天数 > 30 天 | 日日不辍，持之以恒 |
| 周末战士 | 周末阅读时长占比 > 70% | 工作日忙碌，周末充电 |
| 杂食家 | 阅读格式 >= 3 种且分布较均匀 | 不拘格式，兼容并蓄 |

---

## 五、后端 API 设计

### 5.1 新增路由文件：`server/src/routes/readingStats.ts`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reading-sessions` | 创建/更新阅读会话 |
| GET | `/api/reading-stats/daily?date=YYYY-MM-DD` | 获取指定日期的阅读统计 |
| GET | `/api/reading-stats/weekly?startDate=YYYY-MM-DD` | 获取指定周的每日统计 |
| GET | `/api/reading-stats/monthly?year=YYYY&month=M` | 获取指定月的每日统计 |
| GET | `/api/reading-stats/annual?year=YYYY` | 获取年度报告所需的全部聚合数据 |
| GET | `/api/reading-stats/heatmap?year=YYYY` | 获取指定年份的热力图数据 |

### 5.2 年度报告聚合 API 响应结构

```typescript
interface AnnualReportData {
  year: number;
  overview: {
    totalBooks: number;         // 阅读书籍数
    totalDuration: number;      // 总阅读时长（秒）
    totalDays: number;          // 有阅读记录的天数
    totalSessions: number;      // 总阅读会话数
  };
  monthly: {
    month: number;
    duration: number;           // 当月阅读时长（秒）
    bookCount: number;          // 当月阅读书籍数
  }[];
  topBooks: {
    bookId: string;
    title: string;
    author: string;
    coverUrl: string;
    duration: number;           // 阅读时长（秒）
    progress: number;           // 阅读进度
    format: string;
  }[];                          // TOP 5
  habits: {
    longestStreak: number;      // 最长连续阅读天数
    lateNightCount: number;     // 深夜阅读次数（22:00 后）
    earlyMorningCount: number;  // 清晨阅读次数（6:00-9:00）
    formatDistribution: {       // 格式分布
      format: string;
      count: number;
      percentage: number;
    }[];
    totalHighlights: number;    // 标注总数
    totalBookmarks: number;     // 书签总数
    favoriteWeekday: number;    // 最常阅读的星期几（0-6）
    favoriteHour: number;       // 最常阅读的小时（0-23）
  };
  readingPersona: string;       // 阅读人格标签
}
```

### 5.3 热力图 API 响应结构

```typescript
interface HeatmapData {
  year: number;
  days: {
    date: string;          // YYYY-MM-DD
    duration: number;      // 阅读时长（秒）
    bookCount: number;     // 当天阅读的书籍数
    books: {               // 当天阅读的书籍列表
      bookId: string;
      title: string;
    }[];
  }[];
  totalDuration: number;
  totalDays: number;
}
```

---

## 六、前端路由与导航变更

### 6.1 新增路由

```typescript
// App.tsx 新增
<Route path="/stats" element={<Stats />} />
<Route path="/annual-report/:year" element={<AnnualReport />} />
```

### 6.2 侧边栏入口

在 `Sidebar.tsx` 中添加「阅读统计」入口，图标使用 `BarChart3`（来自 lucide-react）。

### 6.3 年度报告入口

- 在统计页面顶部放置「查看年度报告」入口卡片
- 每年年末/年初在书架页面显示提示横幅

---

## 七、开发任务拆分

### 阶段 7.1：数据基础设施（阅读时长追踪）

| 序号 | 任务 | 涉及文件 | 优先级 |
|------|------|---------|--------|
| 7.1.1 | 新增 `ReadingSession` 类型定义 | `src/types/index.ts` | P0 |
| 7.1.2 | IndexedDB 升级至 v10，新增 `readingSessions` 存储 | `src/utils/db.ts` | P0 |
| 7.1.3 | Prisma Schema 新增 `ReadingSession` 模型并执行迁移 | `server/prisma/schema.prisma` | P0 |
| 7.1.4 | 新建 `readingStatsStore`（会话管理 + 数据聚合） | `src/stores/readingStatsStore.ts` | P0 |
| 7.1.5 | 实现 `useReadingTimer` Hook（计时 + 空闲检测 + 会话管理） | `src/hooks/useReadingTimer.ts` | P0 |
| 7.1.6 | Reader 页面集成阅读计时 | `src/pages/Reader.tsx` | P0 |
| 7.1.7 | 后端新增阅读会话 CRUD 路由 | `server/src/routes/readingStats.ts` | P0 |
| 7.1.8 | 后端挂载路由 | `server/src/index.ts` | P0 |

### 阶段 7.2：统计页面与热力图

| 序号 | 任务 | 涉及文件 | 优先级 |
|------|------|---------|--------|
| 7.2.1 | 后端实现每日/每周/每月统计 API | `server/src/routes/readingStats.ts` | P0 |
| 7.2.2 | 后端实现热力图数据 API | `server/src/routes/readingStats.ts` | P0 |
| 7.2.3 | Store 中添加统计数据聚合方法 | `src/stores/readingStatsStore.ts` | P0 |
| 7.2.4 | 实现统计摘要卡片组件 | `src/components/Stats/StatsSummary.tsx` | P1 |
| 7.2.5 | 实现每周/每月柱状图组件 | `src/components/Stats/WeeklyChart.tsx`、`MonthlyChart.tsx` | P1 |
| 7.2.6 | 实现书籍阅读时长排行组件 | `src/components/Stats/BookRanking.tsx` | P1 |
| 7.2.7 | 实现热力图组件 | `src/components/Stats/ReadingHeatmap.tsx` | P1 |
| 7.2.8 | 组装统计页面 | `src/pages/Stats.tsx` | P1 |
| 7.2.9 | 添加路由和侧边栏入口 | `src/App.tsx`、`src/components/Layout/Sidebar.tsx` | P1 |

### 阶段 7.3：年度阅读报告

| 序号 | 任务 | 涉及文件 | 优先级 |
|------|------|---------|--------|
| 7.3.1 | 后端实现年度报告聚合 API | `server/src/routes/readingStats.ts` | P1 |
| 7.3.2 | 实现报告封面组件 | `src/components/AnnualReport/ReportCover.tsx` | P2 |
| 7.3.3 | 实现年度概览组件 | `src/components/AnnualReport/ReportOverview.tsx` | P2 |
| 7.3.4 | 实现月度趋势组件 | `src/components/AnnualReport/ReportMonthly.tsx` | P2 |
| 7.3.5 | 实现 TOP 书籍组件 | `src/components/AnnualReport/ReportTopBooks.tsx` | P2 |
| 7.3.6 | 实现阅读习惯组件 | `src/components/AnnualReport/ReportStreak.tsx` | P2 |
| 7.3.7 | 实现格式分布组件 | `src/components/AnnualReport/ReportFormat.tsx` | P2 |
| 7.3.8 | 实现报告结尾（阅读人格）组件 | `src/components/AnnualReport/ReportEnding.tsx` | P2 |
| 7.3.9 | 组装年度报告页面（全屏滚动） | `src/pages/AnnualReport.tsx` | P2 |
| 7.3.10 | 添加路由 | `src/App.tsx` | P2 |

### 阶段 7.4：数据导出与优化（可选）

| 序号 | 任务 | 涉及文件 | 优先级 |
|------|------|---------|--------|
| 7.4.1 | 实现数据导出工具函数 | `src/utils/exportStats.ts` | P2 |
| 7.4.2 | 实现数据导出组件 | `src/components/Stats/DataExport.tsx` | P2 |
| 7.4.3 | 集成导出功能到统计页面 | `src/pages/Stats.tsx` | P2 |
| 7.4.4 | 编写单元测试 | `src/hooks/__tests__/useReadingTimer.test.ts` | P2 |
| 7.4.5 | 性能测试与优化 | - | P3 |

---

## 八、技术要点与注意事项

### 8.1 计时精度与性能

- 使用 `Date.now()` 而非 `setInterval` 累加，避免计时漂移
- 计时器使用 `useRef` 存储，避免不必要的重渲染
- 空闲检测采用事件委托，在 `document` 上监听 `mousemove`/`keydown`/`click`，加 500ms 节流

### 8.2 数据库迁移兼容

- IndexedDB 升级使用 `onupgradeneeded`，从 v9 升级到 v10
- 需处理旧数据兼容：升级时 `readingSessions` 存储不存在，直接创建即可
- 云端 Prisma 迁移使用 `npx prisma migrate dev` 生成迁移文件

### 8.3 数据同步

- 阅读会话的同步策略与书签/标注一致：本地优先，已登录时同步到云端
- 同步时以 `id` 为主键，使用 upsert 避免重复
- 年度报告等聚合数据可从本地 IndexedDB 直接计算，无需依赖云端 API

### 8.4 样式与主题

- 统计页面和热力图需适配现有的 4 套主题（白天/夜间/护眼/牛皮纸）
- 热力图色阶使用暖色系，与项目整体设计风格一致
- 年度报告页面使用全屏沉浸式设计，背景色跟随主题

### 8.5 图表实现

- 不引入第三方图表库，使用纯 CSS + SVG 实现
- 柱状图使用 `div` + `height` 百分比
- 折线图使用 SVG `<polyline>`
- 保持项目依赖精简

### 8.6 年度报告的滚动体验

- 使用 CSS `scroll-snap-type: y mandatory` 实现全屏翻页滚动
- 每一页占满视口高度（`100vh`）
- 页面切换可加入淡入动画（CSS `@keyframes`）

---

## 九、补充功能

### 9.1 数据导出功能（P2）

允许用户导出自己的阅读数据，增强数据可迁移性和用户信任。

**导出格式：**
- JSON：完整的原始数据，包含所有阅读会话记录
- CSV：便于在 Excel 中分析的表格数据
- Markdown：生成阅读报告文档

**涉及文件：**
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/components/Stats/DataExport.tsx` | 新建 | 数据导出组件 |
| `src/utils/exportStats.ts` | 新建 | 数据导出工具函数 |
| `src/pages/Stats.tsx` | 修改 | 集成导出按钮 |

**导出内容：**
- 阅读会话记录（起止时间、时长、书籍、章节）
- 每日/每周/每月聚合统计
- 年度汇总数据

### 9.2 测试策略

**单元测试：**
- `useReadingTimer` Hook 的计时逻辑测试
- 数据聚合函数（getDailyStats, getWeeklyStats 等）的测试
- 阅读人格计算规则的测试

**集成测试：**
- 阅读会话的创建、更新、合并流程测试
- 本地存储与云端同步的一致性测试

**手动测试要点：**
- 长时间阅读（>1小时）的计时准确性
- 页面切换/浏览器最小化后的会话处理
- 跨天阅读（23:50开始，00:10结束）的日期归属

### 9.3 性能预估与优化

**数据量预估：**
- 单次阅读会话平均时长：30分钟
- 每日平均阅读次数：2次
- 年均会话数：约 730 条
- 单条会话数据大小：约 200 字节
- 年均数据总量：约 150 KB（可忽略）

**优化策略：**
- 阅读会话数据按年份分片存储
- 统计页面使用虚拟滚动（如需要）
- 热力图数据按需加载（仅加载可视区域）

---

## 十、文件变更汇总

### 新建文件（21 个）

| 文件路径 | 说明 |
|---------|------|
| `src/stores/readingStatsStore.ts` | 阅读统计状态管理 |
| `src/hooks/useReadingTimer.ts` | 阅读计时 Hook |
| `src/pages/Stats.tsx` | 统计页面 |
| `src/pages/AnnualReport.tsx` | 年度报告页面 |
| `src/components/Stats/StatsSummary.tsx` | 统计摘要卡片 |
| `src/components/Stats/DailyStats.tsx` | 每日统计卡片 |
| `src/components/Stats/WeeklyChart.tsx` | 每周柱状图 |
| `src/components/Stats/MonthlyChart.tsx` | 每月柱状图 |
| `src/components/Stats/BookRanking.tsx` | 书籍排行 |
| `src/components/Stats/ReadingHeatmap.tsx` | 热力图 |
| `src/components/Stats/HeatmapLegend.tsx` | 热力图图例 |
| `src/components/Stats/DataExport.tsx` | 数据导出组件 |
| `src/utils/exportStats.ts` | 数据导出工具函数 |
| `src/components/AnnualReport/ReportCover.tsx` | 报告封面 |
| `src/components/AnnualReport/ReportOverview.tsx` | 年度概览 |
| `src/components/AnnualReport/ReportMonthly.tsx` | 月度趋势 |
| `src/components/AnnualReport/ReportTopBooks.tsx` | TOP 书籍 |
| `src/components/AnnualReport/ReportStreak.tsx` | 阅读习惯 |
| `src/components/AnnualReport/ReportFormat.tsx` | 格式分布 |
| `src/components/AnnualReport/ReportEnding.tsx` | 报告结尾 |
| `server/src/routes/readingStats.ts` | 后端统计路由 |

### 修改文件（8 个）

| 文件路径 | 变更内容 |
|---------|---------|
| `src/types/index.ts` | 新增 `ReadingSession` 类型 |
| `src/utils/db.ts` | 数据库升级 v10，新增存储 |
| `src/pages/Reader.tsx` | 集成阅读计时 |
| `src/App.tsx` | 新增路由 |
| `src/components/Layout/Sidebar.tsx` | 侧边栏添加入口 |
| `server/prisma/schema.prisma` | 新增模型和关联 |
| `server/src/index.ts` | 挂载新路由 |
| `tailwind.config.js` | 可能新增热力图色阶变量 |
