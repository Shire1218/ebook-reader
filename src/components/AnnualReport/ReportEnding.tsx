import { useNavigate } from 'react-router-dom';

interface ReportEndingProps {
  readingPersona: string;
  year: number;
}

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  博览者: '涉猎广泛，快速浏览',
  深耕者: '深度阅读，专注投入',
  夜猫子: '夜深人静时最爱读书',
  晨读者: '清晨时光，书卷相伴',
  坚持者: '日日不辍，持之以恒',
  阅读者: '享受阅读的乐趣',
};

export default function ReportEnding({ readingPersona, year }: ReportEndingProps) {
  const navigate = useNavigate();

  const handleBackToShelf = () => {
    navigate('/');
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center snap-start bg-gradient-to-b from-warm-200 to-warm-100 px-6 py-12">
      <div className="max-w-lg text-center">
        <h2 className="text-2xl font-semibold text-warm-800 mb-8">
          你的阅读人格
        </h2>

        <div className="bg-white/80 backdrop-blur rounded-3xl p-8 md:p-12 shadow-sm mb-12">
          <div className="text-5xl md:text-6xl font-bold text-warm-600 mb-4">
            「{readingPersona}」
          </div>
          <p className="text-warm-500 text-lg">
            {PERSONA_DESCRIPTIONS[readingPersona] || PERSONA_DESCRIPTIONS.阅读者}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-warm-500 text-sm">
            {year} 年，感谢你的陪伴
          </p>
          <p className="text-warm-400 text-xs">
            愿新的一年，继续与书为伴
          </p>
        </div>

        <button
          onClick={handleBackToShelf}
          className="mt-12 px-8 py-3 bg-warm-600 text-white rounded-full hover:bg-warm-700 transition-colors"
        >
          返回书架
        </button>
      </div>
    </section>
  );
}