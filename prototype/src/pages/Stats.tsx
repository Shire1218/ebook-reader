import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Calendar } from 'lucide-react';
import { useReadingStatsStore, getWeekStart, getMonthStart, getToday } from '@/stores/readingStatsStore';
import { useAuthStore } from '@/stores/authStore';
import StatsSummary from '@/components/Stats/StatsSummary';
import WeeklyChart from '@/components/Stats/WeeklyChart';
import MonthlyChart from '@/components/Stats/MonthlyChart';
import BookRanking from '@/components/Stats/BookRanking';
import ReadingHeatmap from '@/components/Stats/ReadingHeatmap';

// 每日统计类型
interface DailyStat {
  date: string;
  duration: number;
  sessionCount: number;
}

// 书籍排行项类型
interface BookRankingItem {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  duration: number;
  progress: number;
}

// 热力图数据类型
interface HeatmapDay {
  date: string;
  duration: number;
  bookCount: number;
  books: { bookId: string; title: string }[];
}

export default function Stats() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || 'local_user';

  const {
    todayDuration,
    weekDuration,
    monthDuration,
    streakDays,
    weeklyStats,
    monthlyStats,
    bookRanking,
    heatmapData,
    currentYear,
    loadTodayStats,
    loadWeekStats,
    loadMonthStats,
    getWeeklyStats,
    getMonthlyStats,
    getBookRanking,
    getStreakDays,
    getHeatmapData,
    setCurrentYear,
  } = useReadingStatsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<DailyStat[]>([]);
  const [monthlyData, setMonthlyData] = useState<DailyStat[]>([]);
  const [rankingData, setRankingData] = useState<BookRankingItem[]>([]);
  const [heatmapYearData, setHeatmapYearData] = useState<HeatmapDay[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentMonthYear, setCurrentMonthYear] = useState(new Date().getFullYear());

  // 加载所有统计数据
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        // 加载基础统计
        await Promise.all([
          loadTodayStats(userId),
          loadWeekStats(userId),
          loadMonthStats(userId),
          getStreakDays(userId),
        ]);

        // 加载周数据
        const weekStart = getWeekStart();
        const weekStats = await getWeeklyStats(userId, weekStart);
        setWeeklyData(weekStats);

        // 加载月数据
        const now = new Date();
        const monthStats = await getMonthlyStats(userId, now.getFullYear(), now.getMonth() + 1);
        setMonthlyData(monthStats);

        // 加载书籍排行
        const ranking = await getBookRanking(userId, 'month');
        setRankingData(ranking);

        // 加载热力图数据
        const heatmap = await getHeatmapData(userId, currentYear);
        setHeatmapYearData(heatmap);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [userId, currentYear]);

  // 处理月份切换
  const handleMonthChange = useCallback(async (year: number, month: number) => {
    setCurrentMonthYear(year);
    setCurrentMonth(month);
    const stats = await getMonthlyStats(userId, year, month);
    setMonthlyData(stats);
  }, [userId, getMonthlyStats]);

  // 处理年份切换
  const handleYearChange = useCallback(async (year: number) => {
    setCurrentYear(year);
    const heatmap = await getHeatmapData(userId, year);
    setHeatmapYearData(heatmap);
  }, [userId, setCurrentYear, getHeatmapData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-warm-50">
        <div className="flex items-center gap-3 text-warm-400">
          <div className="w-5 h-5 border-2 border-warm-200 border-t-warm-400 rounded-full animate-spin" />
          <span>加载统计数据...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-warm-50 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-warm-400" />
          <h1 className="text-2xl font-medium text-warm-800">阅读统计</h1>
        </div>

        {/* 统计摘要卡片 */}
        <StatsSummary
          todayDuration={todayDuration}
          weekDuration={weekDuration}
          monthDuration={monthDuration}
          streakDays={streakDays}
        />

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 每周柱状图 */}
          <WeeklyChart data={weeklyData} />

          {/* 每月趋势图 */}
          <MonthlyChart
            data={monthlyData}
            year={currentMonthYear}
            month={currentMonth}
            onMonthChange={handleMonthChange}
          />
        </div>

        {/* 书籍排行 */}
        <BookRanking data={rankingData} />

        {/* 热力图 */}
        <ReadingHeatmap
          data={heatmapYearData}
          year={currentYear}
          onYearChange={handleYearChange}
        />

        {/* 年度报告入口 */}
        <div className="bg-gradient-to-r from-warm-400 to-warm-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">{currentYear} 年度阅读报告</h3>
              <p className="text-sm text-white/80">
                查看你这一年的阅读旅程，发现你的阅读习惯
              </p>
            </div>
            <button
              className="px-4 py-2 bg-white text-warm-500 rounded-lg font-medium hover:bg-warm-50 transition-colors"
              onClick={() => navigate(`/annual-report/${currentYear}`)}
            >
              <Calendar className="w-4 h-4 inline-block mr-2" />
              查看报告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
