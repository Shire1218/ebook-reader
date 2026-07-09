import { useMemo } from 'react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface DailyStat {
  date: string;
  duration: number;
  sessionCount: number;
}

interface WeeklyChartProps {
  data: DailyStat[];
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const maxDuration = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d.duration), 1);
  }, [data]);

  const totalDuration = useMemo(() => {
    return data.reduce((sum, d) => sum + d.duration, 0);
  }, [data]);

  // 获取星期几的标签
  const getWeekdayLabel = (dateStr: string, index: number) => {
    return WEEKDAYS[index] || '';
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-warm-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-warm-800">本周阅读时长</h3>
        <span className="text-sm text-warm-400">
          总计 {formatDurationShort(totalDuration)}
        </span>
      </div>

      <div className="h-48 flex items-end gap-2">
        {data.map((day, index) => {
          const height = maxDuration > 0 ? (day.duration / maxDuration) * 100 : 0;
          const isToday = index === data.length - 1;

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              {/* 柱状图 */}
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 relative ${
                    day.duration > 0
                      ? isToday
                        ? 'bg-warm-400'
                        : 'bg-warm-300 hover:bg-warm-400'
                      : 'bg-warm-100'
                  }`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                >
                  {/* Tooltip */}
                  {day.duration > 0 && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-warm-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {formatDurationShort(day.duration)}
                    </div>
                  )}
                </div>
              </div>

              {/* 星期标签 */}
              <span className={`text-xs ${isToday ? 'text-warm-600 font-medium' : 'text-warm-400'}`}>
                {getWeekdayLabel(day.date, index)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
