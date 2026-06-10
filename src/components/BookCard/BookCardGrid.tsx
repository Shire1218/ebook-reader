import { useNavigate } from 'react-router-dom';
import type { Book } from '@/types';
import { formatTime } from '@/utils/fileParser';
import { BookOpen } from 'lucide-react';
import BookCardActions from './BookCardActions';

interface BookCardGridProps {
  book: Book;
}

export default function BookCardGrid({ book }: BookCardGridProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/reader/${book.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer rounded-xl bg-white border border-warm-200 overflow-hidden
                 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative"
    >
      {/* 封面区域 */}
      <div
        className="aspect-[3/4] flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: book.coverUrl }}
      >
        <BookOpen className="w-12 h-12 text-white/80" />
        {/* 格式标签 */}
        <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-black/30 text-white rounded-md backdrop-blur-sm">
          {book.format.toUpperCase()}
        </span>
        {/* 操作按钮 - 悬停时显示 */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <BookCardActions book={book} />
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-warm-800 line-clamp-1 group-hover:text-warm-400 transition-colors">
          {book.title}
        </h3>
        <p className="text-xs text-warm-300 mt-1 line-clamp-1">{book.author}</p>

        {/* 进度条 */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1 bg-warm-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-warm-400 rounded-full transition-all duration-500"
              style={{ width: `${book.progress}%` }}
            />
          </div>
          <span className="text-xs text-warm-300 tabular-nums">{Math.round(book.progress)}%</span>
        </div>

        {/* 最近阅读时间 */}
        <p className="text-xs text-warm-300 mt-1.5">{formatTime(book.lastReadTime)}</p>
      </div>
    </div>
  );
}
