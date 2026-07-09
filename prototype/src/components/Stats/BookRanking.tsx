import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface BookRankingItem {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  duration: number;
  progress: number;
}

interface BookRankingProps {
  data: BookRankingItem[];
}

const PERIODS = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '本年' },
];

export default function BookRanking({ data }: BookRankingProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  const maxDuration = data.length > 0 ? Math.max(...data.map((d) => d.duration), 1) : 1;

  return (
    <div className="bg-white rounded-xl p-6 border border-warm-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-warm-800">阅读时长排行</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value as 'week' | 'month' | 'year')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                period === p.value
                  ? 'bg-warm-400 text-white'
                  : 'bg-warm-100 text-warm-400 hover:bg-warm-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-warm-400">
          <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无阅读记录</p>
          <p className="text-xs mt-1">开始阅读书籍来查看排行</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((book, index) => {
            const barWidth = maxDuration > 0 ? (book.duration / maxDuration) * 100 : 0;

            return (
              <div
                key={book.bookId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-warm-50 transition-colors"
              >
                {/* 排名 */}
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                    index < 3
                      ? 'bg-warm-400 text-white'
                      : 'bg-warm-100 text-warm-400'
                  }`}
                >
                  {index + 1}
                </span>

                {/* 书籍信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-warm-800 truncate">
                      {book.title}
                    </p>
                    <span className="text-xs text-warm-400 whitespace-nowrap">
                      {formatDurationShort(book.duration)}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warm-400 rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* 进度百分比 */}
                <span className="text-xs text-warm-400 w-10 text-right">
                  {Math.round(book.progress)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
