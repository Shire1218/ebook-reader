import { useMemo } from 'react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface MonthlyData {
  month: number;
  duration: number;
  bookCount: number;
}

interface ReportMonthlyProps {
  monthly: MonthlyData[];
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function ReportMonthly({ monthly }: ReportMonthlyProps) {
  const maxDuration = useMemo(
    () => Math.max(...monthly.map((m) => m.duration), 1),
    [monthly]
  );

  const peakMonth = useMemo(() => {
    return monthly.reduce((max, m) => (m.duration > max.duration ? m : max), monthly[0] || { month: 0, duration: 0, bookCount: 0 });
  }, [monthly]);

  const emptyMonthCount = useMemo(
    () => monthly.filter((m) => m.duration === 0).length,
    [monthly]
  );

  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-warm-100 px-6 py-12">
      <div className="max-w-3xl w-full">
        <h2 className="text-2xl font-semibold text-warm-800 mb-12 text-center">
          月度阅读趋势
        </h2>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="h-64 flex items-end gap-2">
            {monthly.map((m) => {
              const height = maxDuration > 0 ? (m.duration / maxDuration) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex-1 flex items-end relative">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-warm-400 to-warm-300 transition-all duration-500 relative"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-warm-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                        {formatDurationShort(m.duration)}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] md:text-xs text-warm-400">
                    {MONTH_NAMES[m.month - 1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {peakMonth && peakMonth.duration > 0 && (
          <p className="text-center text-warm-500 mt-8">
            你在 <span className="text-warm-700 font-semibold">{MONTH_NAMES[peakMonth.month - 1]}</span> 读得最多，共计 {formatDurationShort(peakMonth.duration)}
          </p>
        )}
        {emptyMonthCount > 0 && (
          <p className="text-center text-warm-400 text-sm mt-2">
            有 {emptyMonthCount} 个月你一本书也没翻开
          </p>
        )}
      </div>
    </section>
  );
}