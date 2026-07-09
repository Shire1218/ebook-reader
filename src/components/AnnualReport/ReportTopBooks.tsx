import { BookOpen } from 'lucide-react';
import { formatDurationShort } from '@/stores/readingStatsStore';

interface TopBook {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  duration: number;
  progress: number;
  format: string;
}

interface ReportTopBooksProps {
  topBooks: TopBook[];
}

export default function ReportTopBooks({ topBooks }: ReportTopBooksProps) {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-warm-50 px-6 py-12">
      <div className="max-w-3xl w-full">
        <h2 className="text-2xl font-semibold text-warm-800 mb-12 text-center">
          你花最多时间的 5 本书
        </h2>

        {topBooks.length === 0 ? (
          <div className="text-center text-warm-400 py-12">
            暂无阅读记录
          </div>
        ) : (
          <div className="space-y-4">
            {topBooks.map((book, index) => (
              <div
                key={book.bookId}
                className="bg-white rounded-xl p-4 md:p-6 shadow-sm flex items-center gap-4"
              >
                <div className="flex-shrink-0 w-8 text-2xl font-bold text-warm-300 text-center">
                  {index + 1}
                </div>

                <div className="flex-shrink-0 w-12 h-16 md:w-16 md:h-20 rounded overflow-hidden bg-warm-100 flex items-center justify-center">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-6 h-6 text-warm-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-medium text-warm-800 truncate">
                    {book.title}
                  </h3>
                  <p className="text-xs text-warm-400 truncate mt-1">
                    {book.author || '佚名'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-warm-600 font-medium">
                      {formatDurationShort(book.duration)}
                    </span>
                    <span className="text-warm-400">
                      已读 {Math.round(book.progress * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}