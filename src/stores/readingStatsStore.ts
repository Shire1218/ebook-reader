import { create } from 'zustand';
import type { ReadingSession, Book } from '@/types';
import {
  addReadingSession,
  updateReadingSession,
  getReadingSessionsByDate,
  getReadingSessionsByDateRange,
  getAllReadingSessions,
  getReadingSessionsByBook,
  getAllBooks,
} from '@/utils/db';
import { apiPost, apiGet } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';

// 当前活跃会话
interface ActiveSession {
  id: string;
  bookId: string;
  userId: string;
  startTime: number;
  startPage?: string;
  startChapter?: string;
  date: string;
}

// 每日统计
interface DailyStat {
  date: string;
  duration: number;
  sessionCount: number;
}

// 书籍排行项
interface BookRankingItem {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  duration: number;
  progress: number;
}

// 热力图数据
interface HeatmapDay {
  date: string;
  duration: number;
  bookCount: number;
  books: { bookId: string; title: string }[];
}

interface ReadingStatsState {
  // 当前活跃会话
  activeSession: ActiveSession | null;
  // 累计阅读时长（当前会话，秒）
  currentSessionDuration: number;
  // 今日阅读时长（秒）
  todayDuration: number;
  // 本周阅读时长（秒）
  weekDuration: number;
  // 本月阅读时长（秒）
  monthDuration: number;
  // 连续阅读天数
  streakDays: number;
  // 本周每日统计
  weeklyStats: DailyStat[];
  // 本月每日统计
  monthlyStats: DailyStat[];
  // 书籍排行
  bookRanking: BookRankingItem[];
  // 热力图数据
  heatmapData: HeatmapDay[];
  // 当前年份
  currentYear: number;

  // 操作
  startSession: (bookId: string, userId: string, startPage?: string, startChapter?: string) => void;
  updateSession: (currentPage?: string, currentChapter?: string) => void;
  endSession: () => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  loadTodayStats: (userId: string) => Promise<void>;
  loadWeekStats: (userId: string) => Promise<void>;
  loadMonthStats: (userId: string) => Promise<void>;
  // 新增方法
  getDailyStats: (userId: string, date: string) => Promise<{ duration: number; sessionCount: number; bookCount: number }>;
  getWeeklyStats: (userId: string, startDate: string) => Promise<DailyStat[]>;
  getMonthlyStats: (userId: string, year: number, month: number) => Promise<DailyStat[]>;
  getBookRanking: (userId: string, period: 'week' | 'month' | 'year') => Promise<BookRankingItem[]>;
  getStreakDays: (userId: string) => Promise<number>;
  getHeatmapData: (userId: string, year: number) => Promise<HeatmapDay[]>;
  setCurrentYear: (year: number) => void;
}

function isCloudMode(): boolean {
  return useAuthStore.getState().isAuthenticated;
}

function getUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

// 获取日期字符串 YYYY-MM-DD
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 获取本周起始日期（周一）
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return getDateString(monday.getTime());
}

// 获取本月起始日期
function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// 获取今天日期
function getToday(): string {
  return getDateString(Date.now());
}

// 格式化时长为可读字符串
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${remainingMinutes}分钟`;
}

// 格式化时长为短字符串（如 1h 23m）
export function formatDurationShort(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

export const useReadingStatsStore = create<ReadingStatsState>((set, get) => ({
  activeSession: null,
  currentSessionDuration: 0,
  todayDuration: 0,
  weekDuration: 0,
  monthDuration: 0,
  streakDays: 0,
  weeklyStats: [],
  monthlyStats: [],
  bookRanking: [],
  heatmapData: [],
  currentYear: new Date().getFullYear(),

  // 开始新会话
  startSession: (bookId: string, userId: string, startPage?: string, startChapter?: string) => {
    const now = Date.now();
    const session: ActiveSession = {
      id: `${userId}_${bookId}_${now}`,
      bookId,
      userId,
      startTime: now,
      startPage,
      startChapter,
      date: getDateString(now),
    };
    set({ activeSession: session, currentSessionDuration: 0 });
  },

  // 更新会话（位置变化）
  updateSession: (currentPage?: string, currentChapter?: string) => {
    const { activeSession } = get();
    if (!activeSession) return;
    // 位置变化时更新，但保持会话活跃
    // 实际的位置信息会在 endSession 时保存
  },

  // 结束会话并保存
  endSession: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    const now = Date.now();
    const duration = Math.floor((now - activeSession.startTime) / 1000);

    // 最小记录阈值：30秒
    if (duration < 30) {
      set({ activeSession: null, currentSessionDuration: 0 });
      return;
    }

    const session: ReadingSession = {
      id: activeSession.id,
      userId: activeSession.userId,
      bookId: activeSession.bookId,
      startTime: activeSession.startTime,
      endTime: now,
      duration,
      startPage: activeSession.startPage,
      endPage: undefined,
      startChapter: activeSession.startChapter,
      endChapter: undefined,
      date: activeSession.date,
    };

    // 保存到本地
    await addReadingSession(session);

    // 同步到云端
    if (isCloudMode()) {
      try {
        await apiPost('/api/reading-sessions', session);
      } catch {
        // 云端失败不阻塞本地
      }
    }

    set({ activeSession: null, currentSessionDuration: 0 });
  },

  // 暂停会话（用户空闲）
  pauseSession: () => {
    const { activeSession } = get();
    if (!activeSession) return;
  },

  // 恢复会话
  resumeSession: () => {
    // 恢复计时
  },

  // 加载今日统计
  loadTodayStats: async (userId: string) => {
    const today = getToday();

    if (isCloudMode()) {
      try {
        const result = await apiGet<{ totalDuration: number }>(`/api/reading-stats/daily?date=${today}`);
        set({ todayDuration: result.totalDuration });
        return;
      } catch {
        // 云端失败回退到本地
      }
    }

    const sessions = await getReadingSessionsByDate(userId, today);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    set({ todayDuration: totalDuration });
  },

  // 加载本周统计
  loadWeekStats: async (userId: string) => {
    const weekStart = getWeekStart();
    const today = getToday();

    if (isCloudMode()) {
      try {
        const result = await apiGet<{ totalDuration: number; dailyStats: DailyStat[] }>(`/api/reading-stats/weekly?startDate=${weekStart}`);
        set({ weekDuration: result.totalDuration, weeklyStats: result.dailyStats });
        return;
      } catch {
        // 云端失败回退到本地
      }
    }

    const sessions = await getReadingSessionsByDateRange(userId, weekStart, today);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    set({ weekDuration: totalDuration });
  },

  // 加载本月统计
  loadMonthStats: async (userId: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = getMonthStart();
    const today = getToday();

    if (isCloudMode()) {
      try {
        const result = await apiGet<{ totalDuration: number; dailyStats: DailyStat[] }>(`/api/reading-stats/monthly?year=${year}&month=${month}`);
        set({ monthDuration: result.totalDuration, monthlyStats: result.dailyStats });
        return;
      } catch {
        // 云端失败回退到本地
      }
    }

    const sessions = await getReadingSessionsByDateRange(userId, monthStart, today);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    set({ monthDuration: totalDuration });
  },

  // 获取指定日期的统计
  getDailyStats: async (userId: string, date: string) => {
    if (isCloudMode()) {
      try {
        const result = await apiGet<{ totalDuration: number; sessionCount: number; bookCount: number }>(`/api/reading-stats/daily?date=${date}`);
        return {
          duration: result.totalDuration,
          sessionCount: result.sessionCount,
          bookCount: result.bookCount,
        };
      } catch {
        // 云端失败回退到本地
      }
    }

    const sessions = await getReadingSessionsByDate(userId, date);
    const duration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const bookCount = new Set(sessions.map((s) => s.bookId)).size;
    return { duration, sessionCount: sessions.length, bookCount };
  },

  // 获取指定周的每日统计
  getWeeklyStats: async (userId: string, startDate: string) => {
    if (isCloudMode()) {
      try {
        const result = await apiGet<{ dailyStats: DailyStat[] }>(`/api/reading-stats/weekly?startDate=${startDate}`);
        return result.dailyStats;
      } catch {
        // 云端失败回退到本地
      }
    }

    // 本地计算
    const start = new Date(startDate);
    const dailyStats: DailyStat[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = getDateString(d.getTime());
      const sessions = await getReadingSessionsByDate(userId, dateStr);
      dailyStats.push({
        date: dateStr,
        duration: sessions.reduce((sum, s) => sum + s.duration, 0),
        sessionCount: sessions.length,
      });
    }

    return dailyStats;
  },

  // 获取指定月的每日统计
  getMonthlyStats: async (userId: string, year: number, month: number) => {
    if (isCloudMode()) {
      try {
        const result = await apiGet<{ dailyStats: DailyStat[] }>(`/api/reading-stats/monthly?year=${year}&month=${month}`);
        return result.dailyStats;
      } catch {
        // 云端失败回退到本地
      }
    }

    // 本地计算
    const lastDay = new Date(year, month, 0).getDate();
    const dailyStats: DailyStat[] = [];

    for (let i = 1; i <= lastDay; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const sessions = await getReadingSessionsByDate(userId, dateStr);
      dailyStats.push({
        date: dateStr,
        duration: sessions.reduce((sum, s) => sum + s.duration, 0),
        sessionCount: sessions.length,
      });
    }

    return dailyStats;
  },

  // 获取书籍阅读时长排行
  getBookRanking: async (userId: string, period: 'week' | 'month' | 'year') => {
    // 计算日期范围
    const now = new Date();
    let startDate: string;

    if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      startDate = getDateString(monday.getTime());
    } else if (period === 'month') {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      startDate = `${now.getFullYear()}-01-01`;
    }

    const endDate = getToday();
    const sessions = await getReadingSessionsByDateRange(userId, startDate, endDate);

    // 获取本地书籍数据
    const books = await getAllBooks();
    const bookMap = new Map<string, Book>();
    books.forEach((book) => bookMap.set(book.id, book));

    // 按书籍分组统计
    const rankingMap = new Map<string, BookRankingItem>();

    sessions.forEach((session) => {
      const book = bookMap.get(session.bookId);
      if (!rankingMap.has(session.bookId)) {
        rankingMap.set(session.bookId, {
          bookId: session.bookId,
          title: book?.title || '未知书籍',
          author: book?.author || '',
          coverUrl: book?.coverUrl || '',
          duration: 0,
          progress: book?.progress || 0,
        });
      }
      const item = rankingMap.get(session.bookId)!;
      item.duration += session.duration;
    });

    // 排序并取前10
    const ranking = Array.from(rankingMap.values())
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    set({ bookRanking: ranking });
    return ranking;
  },

  // 计算连续阅读天数
  getStreakDays: async (userId: string) => {
    const sessions = await getAllReadingSessions(userId);
    const readingDates = Array.from(new Set(sessions.map((s) => s.date))).sort();

    if (readingDates.length === 0) {
      set({ streakDays: 0 });
      return 0;
    }

    let longestStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    readingDates.forEach((dateStr) => {
      const date = new Date(dateStr);
      if (prevDate) {
        const diffDays = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      prevDate = date;
    });

    set({ streakDays: longestStreak });
    return longestStreak;
  },

  // 获取热力图数据
  getHeatmapData: async (userId: string, year: number) => {
    if (isCloudMode()) {
      try {
        const result = await apiGet<{ days: HeatmapDay[] }>(`/api/reading-stats/heatmap?year=${year}`);
        set({ heatmapData: result.days });
        return result.days;
      } catch {
        // 云端失败回退到本地
      }
    }

    // 本地计算
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const sessions = await getReadingSessionsByDateRange(userId, startDate, endDate);

    // 按日期分组
    const dailyData = new Map<string, HeatmapDay>();

    sessions.forEach((session) => {
      if (!dailyData.has(session.date)) {
        dailyData.set(session.date, {
          date: session.date,
          duration: 0,
          bookCount: 0,
          books: [],
        });
      }
      const day = dailyData.get(session.date)!;
      day.duration += session.duration;
      if (!day.books.find((b) => b.bookId === session.bookId)) {
        day.books.push({ bookId: session.bookId, title: '未知书籍' });
        day.bookCount = day.books.length;
      }
    });

    const heatmapData = Array.from(dailyData.values()).sort((a, b) => a.date.localeCompare(b.date));
    set({ heatmapData });
    return heatmapData;
  },

  // 设置当前年份
  setCurrentYear: (year: number) => {
    set({ currentYear: year });
  },
}));

// 导出辅助函数
export { getDateString, getWeekStart, getMonthStart, getToday };
