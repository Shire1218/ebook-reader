import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface HeatmapDay {
  date: string;
  duration: number;
  bookCount: number;
  books: { bookId: string; title: string }[];
}

interface ReadingHeatmapProps {
  data: HeatmapDay[];
  year: number;
  onYearChange: (year: number) => void;
}

// 热力图色阶（与项目暖色调主题一致）
const HEATMAP_COLORS = [
  { min: 0, max: 0, color: '#f5f0e8', label: '0' },           // 暖灰白
  { min: 1, max: 30 * 60, color: '#fde8c8', label: '1-30分' },   // 浅橙
  { min: 30 * 60, max: 60 * 60, color: '#f9b87c', label: '30-60分' }, // 中橙
  { min: 60 * 60, max: 120 * 60, color: '#e88a4a', label: '1-2小时' }, // 深橙
  { min: 120 * 60, max: Infinity, color: '#c45e24', label: '2小时+' }, // 重橙
];

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export default function ReadingHeatmap({ data, year, onYearChange }: ReadingHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // 按日期索引数据
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    data.forEach((day) => map.set(day.date, day));
    return map;
  }, [data]);

  // 获取颜色
  const getColor = (duration: number): string => {
    for (const level of HEATMAP_COLORS) {
      if (duration >= level.min && duration <= level.max) {
        return level.color;
      }
    }
    return HEATMAP_COLORS[0].color;
  };

  // 生成全年数据
  const yearData = useMemo(() => {
    const weeks: { date: string; duration: number }[][] = [];
    let currentWeek: { date: string; duration: number }[] = [];

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // 调整到第一个周一
    const firstDay = startDate.getDay();
    const daysToSubtract = firstDay === 0 ? 6 : firstDay - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayData = dataMap.get(dateStr);
      const duration = dayData?.duration || 0;

      currentWeek.push({ date: dateStr, duration });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 补全最后一周
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', duration: 0 });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [dataMap, year]);

  // 计算月份标签位置
  const monthLabels = useMemo(() => {
    const labels: { month: string; colIndex: number }[] = [];
    let currentMonth = -1;

    yearData.forEach((week, weekIndex) => {
      week.forEach((day) => {
        if (day.date) {
          const month = parseInt(day.date.split('-')[1], 10) - 1;
          if (month !== currentMonth) {
            labels.push({ month: MONTHS[month], colIndex: weekIndex });
            currentMonth = month;
          }
        }
      });
    });

    return labels;
  }, [yearData]);

  const handlePrevYear = () => onYearChange(year - 1);
  const handleNextYear = () => {
    const currentYear = new Date().getFullYear();
    if (year < currentYear) {
      onYearChange(year + 1);
    }
  };

  const handleMouseEnter = (day: { date: string; duration: number }, e: React.MouseEvent) => {
    if (!day.date) return;
    const dayData = dataMap.get(day.date);
    if (dayData) {
      setHoveredDay(dayData);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  const totalDuration = data.reduce((sum, d) => sum + d.duration, 0);
  const totalDays = data.length;

  return (
    <div className="bg-white rounded-xl p-6 border border-warm-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-warm-800">阅读热力图</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevYear}
              className="p-1 hover:bg-warm-100 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-warm-400" />
            </button>
            <span className="text-sm text-warm-600 min-w-[60px] text-center">
              {year}年
            </span>
            <button
              onClick={handleNextYear}
              className="p-1 hover:bg-warm-100 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-warm-400" />
            </button>
          </div>
        </div>
        <span className="text-sm text-warm-400">
          {totalDays} 天 · {formatDurationShort(totalDuration)}
        </span>
      </div>

      {/* 热力图 */}
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* 月份标签 */}
          <div className="flex mb-1 ml-6">
            {monthLabels.map((label, index) => (
              <div
                key={index}
                className="text-xs text-warm-400 whitespace-nowrap"
                style={{
                  width: `${(yearData.length / 12) * 15}px`,
                  marginLeft: index === 0 ? 0 : '10px',
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {/* 星期标签 */}
            <div className="flex flex-col gap-1 mr-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-[10px] text-warm-400 w-4 h-3 flex items-center justify-center">
                  {day}
                </div>
              ))}
            </div>

            {/* 热力图网格 */}
            <div className="flex gap-1">
              {yearData.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-warm-400"
                      style={{ backgroundColor: getColor(day.duration) }}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-4 mt-4">
        <span className="text-xs text-warm-400">少</span>
        <div className="flex gap-1">
          {HEATMAP_COLORS.map((level) => (
            <div
              key={level.label}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: level.color }}
              title={level.label}
            />
          ))}
        </div>
        <span className="text-xs text-warm-400">多</span>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="fixed z-50 bg-warm-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y - 40,
          }}
        >
          <div className="font-medium">{hoveredDay.date}</div>
          <div>阅读 {formatDurationShort(hoveredDay.duration)}</div>
          <div className="text-warm-300">
            {hoveredDay.bookCount} 本书
          </div>
        </div>
      )}
    </div>
  );
}
