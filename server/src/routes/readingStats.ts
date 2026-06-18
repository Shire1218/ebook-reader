import { Router, Response } from 'express';
import prisma from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 创建阅读会话
router.post('/reading-sessions', async (req: AuthRequest, res: Response) => {
  try {
    const {
      id,
      bookId,
      startTime,
      endTime,
      duration,
      startPage,
      endPage,
      startChapter,
      endChapter,
      date,
    } = req.body;

    // 验证书籍属于当前用户
    const book = await prisma.book.findFirst({
      where: { id: bookId, userId: req.userId },
    });
    if (!book) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    // 检查是否存在相同 ID 的会话（用于更新）
    const existingSession = await prisma.readingSession.findFirst({
      where: { id, userId: req.userId },
    });

    let session;
    if (existingSession) {
      // 更新现有会话
      session = await prisma.readingSession.update({
        where: { id },
        data: {
          endTime: new Date(endTime),
          duration,
          endPage,
          endChapter,
        },
      });
    } else {
      // 创建新会话
      session = await prisma.readingSession.create({
        data: {
          id,
          userId: req.userId!,
          bookId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration,
          startPage: startPage || null,
          endPage: endPage || null,
          startChapter: startChapter || null,
          endChapter: endChapter || null,
          date,
        },
      });
    }

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          bookId: session.bookId,
          startTime: session.startTime.getTime(),
          endTime: session.endTime.getTime(),
          duration: session.duration,
          startPage: session.startPage,
          endPage: session.endPage,
          startChapter: session.startChapter,
          endChapter: session.endChapter,
          date: session.date,
        },
      },
    });
  } catch (error) {
    console.error('Create reading session error:', error);
    res.status(500).json({ success: false, error: '创建阅读会话失败' });
  }
});

// 获取指定日期的阅读统计
router.get('/reading-stats/daily', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      res.status(400).json({ success: false, error: '缺少日期参数' });
      return;
    }

    const sessions = await prisma.readingSession.findMany({
      where: { userId: req.userId, date },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            coverUrl: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const bookCount = new Set(sessions.map((s) => s.bookId)).size;

    res.json({
      success: true,
      data: {
        date,
        totalDuration,
        sessionCount: sessions.length,
        bookCount,
        sessions: sessions.map((s) => ({
          id: s.id,
          bookId: s.bookId,
          bookTitle: s.book.title,
          bookAuthor: s.book.author,
          bookCover: s.book.coverUrl,
          startTime: s.startTime.getTime(),
          endTime: s.endTime.getTime(),
          duration: s.duration,
          startChapter: s.startChapter,
          endChapter: s.endChapter,
        })),
      },
    });
  } catch (error) {
    console.error('Get daily stats error:', error);
    res.status(500).json({ success: false, error: '获取每日统计失败' });
  }
});

// 获取指定周的阅读统计
router.get('/reading-stats/weekly', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate } = req.query;
    if (!startDate || typeof startDate !== 'string') {
      res.status(400).json({ success: false, error: '缺少起始日期参数' });
      return;
    }

    // 计算周结束日期（起始日期 + 6天）
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

    const sessions = await prisma.readingSession.findMany({
      where: {
        userId: req.userId,
        date: {
          gte: startDate,
          lte: endDateStr,
        },
      },
      orderBy: { date: 'asc' },
    });

    // 按日期分组统计
    const dailyStats: Record<string, { duration: number; sessionCount: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyStats[dateStr] = { duration: 0, sessionCount: 0 };
    }

    sessions.forEach((s) => {
      if (dailyStats[s.date]) {
        dailyStats[s.date].duration += s.duration;
        dailyStats[s.date].sessionCount += 1;
      }
    });

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);

    res.json({
      success: true,
      data: {
        startDate,
        endDate: endDateStr,
        totalDuration,
        dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          ...stats,
        })),
      },
    });
  } catch (error) {
    console.error('Get weekly stats error:', error);
    res.status(500).json({ success: false, error: '获取每周统计失败' });
  }
});

// 获取指定月的阅读统计
router.get('/reading-stats/monthly', async (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      res.status(400).json({ success: false, error: '缺少年份或月份参数' });
      return;
    }

    const yearNum = parseInt(year as string, 10);
    const monthNum = parseInt(month as string, 10);

    // 计算月起始和结束日期
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

    const sessions = await prisma.readingSession.findMany({
      where: {
        userId: req.userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // 按日期分组统计
    const dailyStats: Record<string, { duration: number; sessionCount: number }> = {};
    for (let i = 1; i <= lastDay; i++) {
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dailyStats[dateStr] = { duration: 0, sessionCount: 0 };
    }

    sessions.forEach((s) => {
      if (dailyStats[s.date]) {
        dailyStats[s.date].duration += s.duration;
        dailyStats[s.date].sessionCount += 1;
      }
    });

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const bookCount = new Set(sessions.map((s) => s.bookId)).size;

    res.json({
      success: true,
      data: {
        year: yearNum,
        month: monthNum,
        totalDuration,
        bookCount,
        dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          ...stats,
        })),
      },
    });
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ success: false, error: '获取每月统计失败' });
  }
});

// 获取热力图数据
router.get('/reading-stats/heatmap', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    if (!year) {
      res.status(400).json({ success: false, error: '缺少年份参数' });
      return;
    }

    const yearNum = parseInt(year as string, 10);
    const startDate = `${yearNum}-01-01`;
    const endDate = `${yearNum}-12-31`;

    const sessions = await prisma.readingSession.findMany({
      where: {
        userId: req.userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // 按日期分组
    const dailyData: Record<string, {
      duration: number;
      bookCount: number;
      books: { bookId: string; title: string }[];
    }> = {};

    sessions.forEach((s) => {
      if (!dailyData[s.date]) {
        dailyData[s.date] = { duration: 0, bookCount: 0, books: [] };
      }
      dailyData[s.date].duration += s.duration;
      if (!dailyData[s.date].books.find((b) => b.bookId === s.bookId)) {
        dailyData[s.date].books.push({ bookId: s.bookId, title: s.book.title });
        dailyData[s.date].bookCount = dailyData[s.date].books.length;
      }
    });

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalDays = Object.keys(dailyData).length;

    res.json({
      success: true,
      data: {
        year: yearNum,
        days: Object.entries(dailyData).map(([date, data]) => ({
          date,
          duration: data.duration,
          bookCount: data.bookCount,
          books: data.books,
        })),
        totalDuration,
        totalDays,
      },
    });
  } catch (error) {
    console.error('Get heatmap data error:', error);
    res.status(500).json({ success: false, error: '获取热力图数据失败' });
  }
});

// 获取年度报告数据
router.get('/reading-stats/annual', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    if (!year) {
      res.status(400).json({ success: false, error: '缺少年份参数' });
      return;
    }

    const yearNum = parseInt(year as string, 10);
    const startDate = `${yearNum}-01-01`;
    const endDate = `${yearNum}-12-31`;

    const sessions = await prisma.readingSession.findMany({
      where: {
        userId: req.userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            coverUrl: true,
            format: true,
            progress: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // 年度概览
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalSessions = sessions.length;
    const bookIds = new Set(sessions.map((s) => s.bookId));
    const totalBooks = bookIds.size;
    const totalDays = new Set(sessions.map((s) => s.date)).size;

    // 月度统计
    const monthlyStats: Record<number, { duration: number; bookCount: number }> = {};
    for (let i = 1; i <= 12; i++) {
      monthlyStats[i] = { duration: 0, bookCount: 0 };
    }

    sessions.forEach((s) => {
      const month = parseInt(s.date.split('-')[1], 10);
      monthlyStats[month].duration += s.duration;
    });

    // 计算每月阅读书籍数
    const monthBooks: Record<number, Set<string>> = {};
    sessions.forEach((s) => {
      const month = parseInt(s.date.split('-')[1], 10);
      if (!monthBooks[month]) monthBooks[month] = new Set();
      monthBooks[month].add(s.bookId);
    });

    Object.keys(monthBooks).forEach((m) => {
      monthlyStats[parseInt(m, 10)].bookCount = monthBooks[parseInt(m, 10)].size;
    });

    // 书籍阅读时长排行
    const bookDurations: Record<string, {
      bookId: string;
      title: string;
      author: string;
      coverUrl: string;
      duration: number;
      progress: number;
      format: string;
    }> = {};

    sessions.forEach((s) => {
      if (!bookDurations[s.bookId]) {
        bookDurations[s.bookId] = {
          bookId: s.bookId,
          title: s.book.title,
          author: s.book.author,
          coverUrl: s.book.coverUrl,
          duration: 0,
          progress: s.book.progress,
          format: s.book.format,
        };
      }
      bookDurations[s.bookId].duration += s.duration;
    });

    const topBooks = Object.values(bookDurations)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // 阅读习惯统计
    const lateNightSessions = sessions.filter((s) => {
      const hour = s.startTime.getHours();
      return hour >= 22 || hour < 2;
    }).length;

    const earlyMorningSessions = sessions.filter((s) => {
      const hour = s.startTime.getHours();
      return hour >= 6 && hour < 9;
    }).length;

    // 格式分布
    const formatDistribution: Record<string, { count: number; percentage: number }> = {};
    let totalFormatCount = 0;
    sessions.forEach((s) => {
      const format = s.book.format;
      if (!formatDistribution[format]) {
        formatDistribution[format] = { count: 0, percentage: 0 };
      }
      formatDistribution[format].count += 1;
      totalFormatCount += 1;
    });

    Object.keys(formatDistribution).forEach((f) => {
      formatDistribution[f].percentage = Math.round((formatDistribution[f].count / totalFormatCount) * 100);
    });

    // 最常阅读的星期几
    const weekdayCounts: Record<number, number> = {};
    sessions.forEach((s) => {
      const weekday = s.startTime.getDay();
      weekdayCounts[weekday] = (weekdayCounts[weekday] || 0) + 1;
    });
    const favoriteWeekday = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // 最常阅读的小时
    const hourCounts: Record<number, number> = {};
    sessions.forEach((s) => {
      const hour = s.startTime.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const favoriteHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // 计算连续阅读天数
    const readingDates = new Set(sessions.map((s) => s.date)).toArray().sort();
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

    // 计算阅读人格
    const avgDurationPerBook = totalBooks > 0 ? totalDuration / totalBooks : 0;
    const lateNightRatio = totalSessions > 0 ? lateNightSessions / totalSessions : 0;
    const earlyMorningRatio = totalSessions > 0 ? earlyMorningSessions / totalSessions : 0;

    let readingPersona = '阅读者';
    if (totalBooks > 30 && avgDurationPerBook < 5 * 60 * 60) {
      readingPersona = '博览者';
    } else if (avgDurationPerBook > 15 * 60 * 60) {
      readingPersona = '深耕者';
    } else if (lateNightRatio > 0.5) {
      readingPersona = '夜猫子';
    } else if (earlyMorningRatio > 0.4) {
      readingPersona = '晨读者';
    } else if (longestStreak > 30) {
      readingPersona = '坚持者';
    }

    res.json({
      success: true,
      data: {
        year: yearNum,
        overview: {
          totalBooks,
          totalDuration,
          totalDays,
          totalSessions,
        },
        monthly: Object.entries(monthlyStats).map(([month, stats]) => ({
          month: parseInt(month, 10),
          duration: stats.duration,
          bookCount: stats.bookCount,
        })),
        topBooks,
        habits: {
          longestStreak,
          lateNightCount: lateNightSessions,
          earlyMorningCount: earlyMorningSessions,
          formatDistribution: Object.entries(formatDistribution).map(([format, data]) => ({
            format,
            ...data,
          })),
          favoriteWeekday: favoriteWeekday ? parseInt(favoriteWeekday, 10) : null,
          favoriteHour: favoriteHour ? parseInt(favoriteHour, 10) : null,
        },
        readingPersona,
      },
    });
  } catch (error) {
    console.error('Get annual stats error:', error);
    res.status(500).json({ success: false, error: '获取年度报告数据失败' });
  }
});

export default router;
