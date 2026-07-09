import { useNavigate } from 'react-router-dom';
import type { Book } from '@/types';
import { formatFileSize, formatTime } from '@/utils/fileParser';
import { BookOpen } from 'lucide-react';
import BookCardActions from './BookCardActions';

interface BookCardListProps {
  book: Book;
}

export default function BookCardList({ book }: BookCardListProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/reader/${book.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-warm-200
                 cursor-pointer hover:shadow-md hover:border-warm-300 transition-all duration-200"
    >
      {/* 封面缩略图 */}
      <div
        className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: book.coverUrl }}
      >
        <BookOpen className="w-5 h-5 text-white/80" />
      </div>

      {/* 书籍信息 */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm text-warm-800 line-clamp-1 group-hover:text-warm-400 transition-colors">
          {book.title}
        </h3>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-warm-300">{book.author}</span>
          <span className="text-xs text-warm-200">|</span>
          <span className="text-xs text-warm-300">{formatFileSize(book.fileSize)}</span>
          <span className="text-xs text-warm-200">|</span>
          <span className="text-xs px-1.5 py-0.5 bg-warm-100 text-warm-600 rounded">
            {book.format.toUpperCase()}
          </span>
        </div>
      </div>

      {/* 右侧进度和时间 */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="w-24">
          <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-warm-400 rounded-full transition-all duration-500"
              style={{ width: `${book.progress}%` }}
            />
          </div>
          <span className="text-xs text-warm-300 mt-0.5 block text-right tabular-nums">
            {Math.round(book.progress)}%
          </span>
        </div>
        <span className="text-xs text-warm-300 w-20 text-right">{formatTime(book.lastReadTime)}</span>
        {/* 操作按钮 - 悬停时显示 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <BookCardActions book={book} />
        </div>
      </div>
    </div>
  );
}
