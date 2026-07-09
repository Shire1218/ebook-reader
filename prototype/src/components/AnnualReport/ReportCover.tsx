import { ChevronDown } from 'lucide-react';

interface ReportCoverProps {
  year: number;
  userName: string;
}

export default function ReportCover({ year, userName }: ReportCoverProps) {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-gradient-to-b from-warm-100 to-warm-200">
      <div className="text-center px-6">
        <div className="mb-8">
          <span className="text-sm text-warm-400 tracking-widest">墨卷</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-warm-800 mb-4">
          {year} 阅读报告
        </h1>
        <p className="text-lg text-warm-500 mb-2">
          「你的阅读旅程」
        </p>
        {userName && (
          <p className="text-sm text-warm-400">
            —— {userName}
          </p>
        )}
      </div>

      <div className="absolute bottom-8 animate-bounce">
        <ChevronDown className="w-6 h-6 text-warm-400" />
      </div>
    </section>
  );
}