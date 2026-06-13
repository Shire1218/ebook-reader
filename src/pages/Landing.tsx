import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  BookOpen,
  BookText,
  FileText,
  Palette,
  Bookmark,
  BarChart3,
  Highlighter,
  Search,
  Keyboard,
  Monitor,
  ArrowRight,
  Globe,
} from 'lucide-react';

const features = [
  {
    icon: BookText,
    title: '多格式支持',
    description: '支持 EPUB、PDF、TXT、MOBI 四种主流电子书格式，一站式管理你的书库',
  },
  {
    icon: Palette,
    title: '主题切换',
    description: '白天、夜间、护眼、牛皮纸四种主题，保护你的双眼，适配不同阅读场景',
  },
  {
    icon: Bookmark,
    title: '书签与标注',
    description: '多色高亮标注、批注笔记，让阅读更有深度，知识不再流失',
  },
  {
    icon: BarChart3,
    title: '进度管理',
    description: '自动记录阅读进度，支持断点续读，随时回到上次阅读的位置',
  },
  {
    icon: Highlighter,
    title: '全文搜索',
    description: '书籍内容全文检索，快速定位关键信息，阅读效率倍增',
  },
  {
    icon: Keyboard,
    title: '快捷键操作',
    description: '方向键翻页、空格跳转，键盘党的阅读利器',
  },
  {
    icon: Search,
    title: '智能分类',
    description: '书籍分类管理、多维度排序筛选，轻松管理数百本书籍',
  },
  {
    icon: Monitor,
    title: '响应式设计',
    description: '适配桌面、平板等多种屏幕尺寸，随时随地享受阅读',
  },
];

const formats = [
  { name: 'EPUB', description: '主流电子书格式', icon: BookOpen },
  { name: 'PDF', description: '文档与教材', icon: FileText },
  { name: 'TXT', description: '纯文本小说', icon: BookText },
  { name: 'MOBI', description: 'Kindle 格式', icon: Globe },
];

export default function Landing() {
  const navigate = useNavigate();

  // Landing 页面需要滚动，临时覆盖 #root 的 overflow: hidden
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.style.overflow = 'auto';
    }
    return () => {
      if (root) {
        root.style.overflow = '';
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-warm-50 text-warm-800">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-warm-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif text-xl font-semibold text-warm-800">墨卷</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-warm-600 hover:text-warm-800 transition-colors"
            >
              登录
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm px-4 py-2 rounded-lg bg-warm-400 text-white hover:bg-warm-500 transition-colors"
            >
              免费注册
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-warm-900 mb-6 leading-tight">
            墨卷
          </h1>
          <p className="text-xl md:text-2xl text-warm-600 mb-4 font-serif">
            你的浏览器电子书阅读器
          </p>
          <p className="text-base text-warm-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            支持 EPUB、PDF、TXT、MOBI 多种格式，提供舒适的阅读体验和完整的书籍管理功能。
            无需安装，打开浏览器即可阅读。
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 rounded-xl bg-warm-400 text-white text-base font-medium hover:bg-warm-500 transition-all shadow-lg shadow-warm-400/20 hover:shadow-warm-400/30 flex items-center gap-2"
            >
              开始使用
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-3 rounded-xl border border-warm-300 text-warm-700 text-base font-medium hover:bg-warm-100 transition-all"
            >
              了解更多
            </button>
          </div>
        </div>
      </section>

      {/* 格式支持 */}
      <section className="py-16 px-6 bg-warm-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-serif font-semibold text-warm-800 mb-10">
            支持的书籍格式
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {formats.map((fmt) => {
              const Icon = fmt.icon;
              return (
                <div
                  key={fmt.name}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-warm-50 border border-warm-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-warm-400/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-warm-500" />
                  </div>
                  <span className="text-lg font-semibold text-warm-800">{fmt.name}</span>
                  <span className="text-sm text-warm-500">{fmt.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-2xl font-serif font-semibold text-warm-800 mb-4">
            功能特性
          </h2>
          <p className="text-center text-warm-500 mb-12 max-w-xl mx-auto">
            为阅读爱好者打造的全方位阅读体验
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl bg-warm-50 border border-warm-200 hover:border-warm-300 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-warm-400/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-warm-500" />
                  </div>
                  <h3 className="text-base font-semibold text-warm-800 mb-2">{feature.title}</h3>
                  <p className="text-sm text-warm-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-warm-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-serif font-bold text-warm-800 mb-4">
            开始你的阅读之旅
          </h2>
          <p className="text-warm-500 mb-8">
            无需安装任何软件，打开浏览器即可使用。导入你的电子书，即刻享受阅读。
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-10 py-3.5 rounded-xl bg-warm-400 text-white text-base font-medium hover:bg-warm-500 transition-all shadow-lg shadow-warm-400/20"
          >
            立即体验
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-warm-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-warm-400" />
            <span className="text-sm text-warm-500">墨卷 — 浏览器电子书阅读器</span>
          </div>
          <p className="text-sm text-warm-400">
            &copy; {new Date().getFullYear()} 墨卷. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
