import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReadingStatsStore, AnnualReportData } from '@/stores/readingStatsStore';
import { useAuthStore } from '@/stores/authStore';
import ReportCover from '@/components/AnnualReport/ReportCover';
import ReportOverview from '@/components/AnnualReport/ReportOverview';
import ReportMonthly from '@/components/AnnualReport/ReportMonthly';
import ReportTopBooks from '@/components/AnnualReport/ReportTopBooks';
import ReportStreak from '@/components/AnnualReport/ReportStreak';
import ReportFormat from '@/components/AnnualReport/ReportFormat';
import ReportEnding from '@/components/AnnualReport/ReportEnding';

export default function AnnualReport() {
  const { year: yearParam } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id) || 'local_user';
  const getAnnualReport = useReadingStatsStore((state) => state.getAnnualReport);

  const [reportData, setReportData] = useState<AnnualReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const userName = useAuthStore((state) => state.user?.username || '');

  useEffect(() => {
    const loadReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAnnualReport(userId, year);
        setReportData(data);
      } catch (err) {
        setError('加载年度报告失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [userId, year, getAnnualReport]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-warm-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-warm-500">正在生成你的年度报告...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-100">
        <div className="text-center">
          <p className="text-warm-600 mb-4">{error || '加载失败'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-warm-600 text-white rounded-full hover:bg-warm-700 transition-colors"
          >
            返回书架
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto snap-y snap-mandatory">
      {/* 第 1 页 - 封面 */}
      <ReportCover year={year} userName={userName} />

      {/* 第 2 页 - 年度概览 */}
      <ReportOverview
        totalBooks={reportData.overview.totalBooks}
        totalDuration={reportData.overview.totalDuration}
        totalDays={reportData.overview.totalDays}
        totalSessions={reportData.overview.totalSessions}
      />

      {/* 第 3 页 - 月度趋势 */}
      <ReportMonthly monthly={reportData.monthly} />

      {/* 第 4 页 - TOP 书籍 */}
      <ReportTopBooks topBooks={reportData.topBooks} />

      {/* 第 5 页 - 阅读习惯 */}
      <ReportStreak
        longestStreak={reportData.habits.longestStreak}
        lateNightCount={reportData.habits.lateNightCount}
        earlyMorningCount={reportData.habits.earlyMorningCount}
        favoriteWeekday={reportData.habits.favoriteWeekday}
        favoriteHour={reportData.habits.favoriteHour}
      />

      {/* 第 6 页 - 格式分布 */}
      <ReportFormat formatDistribution={reportData.habits.formatDistribution} />

      {/* 第 7 页 - 结尾 */}
      <ReportEnding readingPersona={reportData.readingPersona} year={year} />
    </div>
  );
}