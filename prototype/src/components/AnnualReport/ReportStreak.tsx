import { Flame, Moon, Sun, Calendar } from 'lucide-react';

interface ReportStreakProps {
  longestStreak: number;
  lateNightCount: number;
  earlyMorningCount: number;
  favoriteWeekday: number | null;
  favoriteHour: number | null;
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function ReportStreak({
  longestStreak,
  lateNightCount,
  earlyMorningCount,
  favoriteWeekday,
  favoriteHour,
}: ReportStreakProps) {
  const getFavoriteTimeDescription = (hour: number | null) => {
    if (hour === null) return '';
    if (hour >= 6 && hour < 9) return '清晨';
    if (hour >= 9 && hour < 12) return '上午';
    if (hour >= 12 && hour < 14) return '中午';
    if (hour >= 14 && hour < 18) return '下午';
    if (hour >= 18 && hour < 22) return '晚上';
    return '深夜';
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-warm-100 px-6 py-12">
      <div className="max-w-3xl w-full">
        <h2 className="text-2xl font-semibold text-warm-800 mb-12 text-center">
          你的阅读习惯
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 最长连续阅读 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-sm text-warm-500">最长连续阅读</span>
            </div>
            <div className="text-4xl font-bold text-warm-800 mb-2">
              {longestStreak} <span className="text-lg text-warm-500">天</span>
            </div>
            <p className="text-xs text-warm-400">
              {longestStreak > 30 ? '日日不辍，持之以恒' : '继续保持，养成习惯'}
            </p>
          </div>

          {/* 深夜阅读 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Moon className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-sm text-warm-500">深夜阅读</span>
            </div>
            <div className="text-4xl font-bold text-warm-800 mb-2">
              {lateNightCount} <span className="text-lg text-warm-500">次</span>
            </div>
            <p className="text-xs text-warm-400">
              {lateNightCount > 50 ? '夜深人静时最爱读书' : '偶尔享受夜晚的宁静'}
            </p>
          </div>

          {/* 清晨阅读 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Sun className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-sm text-warm-500">清晨阅读</span>
            </div>
            <div className="text-4xl font-bold text-warm-800 mb-2">
              {earlyMorningCount} <span className="text-lg text-warm-500">次</span>
            </div>
            <p className="text-xs text-warm-400">
              {earlyMorningCount > 50 ? '清晨时光，书卷相伴' : '偶尔享受清晨的宁静'}
            </p>
          </div>

          {/* 最爱阅读时间 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-sm text-warm-500">最爱阅读时间</span>
            </div>
            <div className="text-2xl font-bold text-warm-800 mb-2">
              {favoriteWeekday !== null ? WEEKDAY_NAMES[favoriteWeekday] : '--'}
              {favoriteHour !== null && (
                <span className="text-lg text-warm-500 ml-2">
                  {getFavoriteTimeDescription(favoriteHour)}
                </span>
              )}
            </div>
            <p className="text-xs text-warm-400">
              {favoriteHour !== null ? `${favoriteHour}:00 - ${favoriteHour + 1}:00` : '暂无数据'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}