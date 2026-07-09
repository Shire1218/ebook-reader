import { formatDurationShort } from '@/stores/readingStatsStore';

interface ReportOverviewProps {
  totalBooks: number;
  totalDuration: number;
  totalDays: number;
  totalSessions: number;
}

export default function ReportOverview({ totalBooks, totalDuration, totalDays, totalSessions }: ReportOverviewProps) {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-warm-50 px-6">
      <div className="text-center max-w-lg">
        <h2 className="text-2xl font-semibold text-warm-800 mb-12">
          这一年，你一共阅读了
        </h2>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-warm-600 mb-2">
              {totalBooks}
            </div>
            <div className="text-sm text-warm-400">本书</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-warm-600 mb-2">
              {formatDurationShort(totalDuration)}
            </div>
            <div className="text-sm text-warm-400">阅读时长</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-warm-600 mb-2">
              {totalDays}
            </div>
            <div className="text-sm text-warm-400">阅读天数</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-warm-600 mb-2">
              {totalSessions}
            </div>
            <div className="text-sm text-warm-400">次阅读</div>
          </div>
        </div>

        <p className="text-sm text-warm-400">
          相当于读完了 {(totalBooks / 7).toFixed(1)} 个书架的书
        </p>
      </div>
    </section>
  );
}