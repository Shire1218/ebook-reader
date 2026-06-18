import { Clock, Calendar, BookOpen, Flame } from 'lucide-react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface StatsSummaryProps {
  todayDuration: number;
  weekDuration: number;
  monthDuration: number;
  streakDays: number;
}

export default function StatsSummary({
  todayDuration,
  weekDuration,
  monthDuration,
  streakDays,
}: StatsSummaryProps) {
  const stats = [
    {
      label: '今日阅读',
      value: formatDurationShort(todayDuration),
      icon: Clock,
      color: 'text-warm-400',
      bgColor: 'bg-warm-400/10',
    },
    {
      label: '本周阅读',
      value: formatDurationShort(weekDuration),
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: '本月阅读',
      value: formatDurationShort(monthDuration),
      icon: BookOpen,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: '连续阅读',
      value: `${streakDays} 天`,
      icon: Flame,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl p-4 border border-warm-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-warm-400">{stat.label}</p>
              <p className="text-lg font-semibold text-warm-800">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
