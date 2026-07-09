import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface DailyStat {
  date: string;
  duration: number;
  sessionCount: number;
}

interface MonthlyChartProps {
  data: DailyStat[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

export default function MonthlyChart({ data, year, month, onMonthChange }: MonthlyChartProps) {
  const [viewMode, setViewMode] = useState<'bar' | 'line'>('bar');

  const maxDuration = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d.duration), 1);
  }, [data]);

  const totalDuration = useMemo(() => {
    return data.reduce((sum, d) => sum + d.duration, 0);
  }, [data]);

  const activeDays = useMemo(() => {
    return data.filter((d) => d.duration > 0).length;
  }, [data]);

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 不能选择未来月份
    if (year === currentYear && month === currentMonth) return;

    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  // 生成 SVG 折线路径
  const linePath = useMemo(() => {
    if (data.length === 0) return '';
    const width = 100;
    const height = 100;
    const xStep = width / (data.length - 1 || 1);

    return data
      .map((d, i) => {
        const x = i * xStep;
        const y = maxDuration > 0 ? height - (d.duration / maxDuration) * height : height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [data, maxDuration]);

  return (
    <div className="bg-white rounded-xl p-6 border border-warm-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-warm-800">每月阅读趋势</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-warm-100 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-warm-400" />
            </button>
            <span className="text-sm text-warm-600 min-w-[80px] text-center">
              {year}年{MONTH_NAMES[month - 1]}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-warm-100 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-warm-400" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-warm-400">
            活跃 {activeDays} 天 · 总计 {formatDurationShort(totalDuration)}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('bar')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'bar'
                  ? 'bg-warm-400 text-white'
                  : 'bg-warm-100 text-warm-400 hover:bg-warm-200'
              }`}
            >
              柱状
            </button>
            <button
              onClick={() => setViewMode('line')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'line'
                  ? 'bg-warm-400 text-white'
                  : 'bg-warm-100 text-warm-400 hover:bg-warm-200'
              }`}
            >
              折线
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'bar' ? (
        <div className="h-48 flex items-end gap-1">
          {data.map((day) => {
            const height = maxDuration > 0 ? (day.duration / maxDuration) * 100 : 0;
            const dateParts = day.date.split('-');
            const dayNum = dateParts.length >= 3 ? parseInt(dateParts[2] || '0', 10) : 0;
            const isWeekend = dayNum % 7 === 0 || dayNum % 7 === 6;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t transition-all duration-300 relative ${
                      day.duration > 0
                        ? isWeekend
                          ? 'bg-warm-300 hover:bg-warm-400'
                          : 'bg-warm-400 hover:bg-warm-500'
                        : 'bg-warm-100'
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  >
                    {day.duration > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-warm-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        {formatDurationShort(day.duration)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-48 relative">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* 网格线 */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#E8DFD4"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            ))}
            {/* 折线 */}
            <path
              d={linePath}
              fill="none"
              stroke="#D4A574"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 数据点 */}
            {data.map((d, i) => {
              if (d.duration === 0) return null;
              const x = (i / (data.length - 1 || 1)) * 100;
              const y = maxDuration > 0 ? 100 - (d.duration / maxDuration) * 100 : 100;
              return (
                <circle
                  key={d.date}
                  cx={x}
                  cy={y}
                  r="1.5"
                  fill="#D4A574"
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
