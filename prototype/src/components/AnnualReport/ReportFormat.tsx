import { BookOpen } from 'lucide-react';

interface FormatDistribution {
  format: string;
  count: number;
  percentage: number;
}

interface ReportFormatProps {
  formatDistribution: FormatDistribution[];
}

const FORMAT_LABELS: Record<string, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  txt: 'TXT',
  mobi: 'MOBI',
  cbz: 'CBZ',
  cbr: 'CBR',
  unknown: '其他',
};

const FORMAT_COLORS = [
  'bg-warm-400',
  'bg-blue-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-orange-400',
  'bg-pink-400',
];

export default function ReportFormat({ formatDistribution }: ReportFormatProps) {
  const sortedFormats = [...formatDistribution].sort((a, b) => b.count - a.count);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-warm-50 px-6 py-12">
      <div className="max-w-3xl w-full">
        <h2 className="text-2xl font-semibold text-warm-800 mb-12 text-center">
          阅读格式偏好
        </h2>

        {sortedFormats.length === 0 ? (
          <div className="text-center text-warm-400 py-12">
            暂无阅读记录
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
            {/* 饼图模拟 - 使用堆叠条形图 */}
            <div className="flex h-8 rounded-full overflow-hidden mb-8">
              {sortedFormats.map((item, index) => (
                <div
                  key={item.format}
                  className={`${FORMAT_COLORS[index % FORMAT_COLORS.length]} transition-all duration-500`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${FORMAT_LABELS[item.format] || item.format}: ${item.percentage}%`}
                />
              ))}
            </div>

            {/* 图例 */}
            <div className="space-y-4">
              {sortedFormats.map((item, index) => (
                <div key={item.format} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded ${FORMAT_COLORS[index % FORMAT_COLORS.length]}`} />
                    <span className="text-sm text-warm-700">
                      {FORMAT_LABELS[item.format] || item.format}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-warm-500">
                      {item.count} 本
                    </span>
                    <span className="text-sm font-medium text-warm-800 w-12 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 描述 */}
            {sortedFormats.length >= 3 && (
              <p className="text-center text-warm-500 mt-8 text-sm">
                不拘格式，兼容并蓄
              </p>
            )}
            {sortedFormats.length === 1 && sortedFormats[0] && (
              <p className="text-center text-warm-500 mt-8 text-sm">
                专注 {FORMAT_LABELS[sortedFormats[0].format] || sortedFormats[0].format} 格式
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center mt-8">
          <BookOpen className="w-6 h-6 text-warm-300" />
        </div>
      </div>
    </section>
  );
}