import { useState } from 'react';
import { ExternalLink, Copy, Check, BookOpen, Globe, FileText, Library } from 'lucide-react';
import TopBar from '@/components/Layout/TopBar';

interface DiscoverSource {
  name: string;
  description: string;
  url: string;
  icon: typeof BookOpen;
  tags: string[];
}

const DISCOVER_SOURCES: DiscoverSource[] = [
  {
    name: '古腾堡计划',
    description: '超过 70,000 本免费电子书，以公版经典文学为主，支持 EPUB 和 Kindle 格式',
    url: 'https://www.gutenberg.org/',
    icon: BookOpen,
    tags: ['EPUB', '公版书籍', '英文'],
  },
  {
    name: '好读',
    description: '繁体中文电子书库，以武侠、言情、经典文学为主，提供 TXT 和 PDB 格式',
    url: 'http://www.haodoo.net/',
    icon: FileText,
    tags: ['TXT', '中文', '繁体'],
  },
  {
    name: 'Z-Library',
    description: '全球最大的数字图书馆之一，拥有超过千万本电子书和学术文献',
    url: 'https://z-lib.gs/',
    icon: Library,
    tags: ['EPUB', 'PDF', '多语言'],
  },
  {
    name: 'Project MUSE',
    description: '提供人文社科领域的高质量学术电子书和期刊，部分开放获取',
    url: 'https://muse.jhu.edu/',
    icon: Globe,
    tags: ['PDF', '学术', '英文'],
  },
  {
    name: '书格',
    description: '自由开放的在线古籍图书馆，提供高清古籍 PDF 下载',
    url: 'https://www.shuge.org/',
    icon: BookOpen,
    tags: ['PDF', '古籍', '中文'],
  },
  {
    name: 'Open Library',
    description: 'Internet Archive 旗下的开放图书馆项目，可借阅数百万本电子书',
    url: 'https://openlibrary.org/',
    icon: Library,
    tags: ['EPUB', 'PDF', '多语言'],
  },
];

export default function Discover() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-warm-50 theme-transition">
      <TopBar title="发现书籍" showImport={false} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center px-4 py-3 rounded-xl bg-warm-100 border border-warm-200 my-4">
            <p className="text-sm text-warm-600 leading-relaxed">
              以下是推荐的电子书资源站点，点击「前往下载」可在新标签页中打开，下载后将文件拖入书架即可导入。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DISCOVER_SOURCES.map((source) => {
              const Icon = source.icon;
              return (
                <div
                  key={source.name}
                  className="bg-white rounded-xl border border-warm-200 p-5 hover:border-warm-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-warm-400/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-warm-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-warm-800">{source.name}</h3>
                      <p className="text-sm text-warm-500 mt-1 leading-relaxed">{source.description}</p>
                    </div>
                  </div>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {source.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-xs bg-warm-100 text-warm-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-lg bg-warm-400 text-white text-sm font-medium hover:bg-warm-500 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      前往下载
                    </a>
                    <button
                      onClick={() => handleCopy(source.url)}
                      className="px-3 py-2 rounded-lg border border-warm-200 text-warm-600 text-sm hover:bg-warm-100 transition-colors flex items-center gap-1.5"
                    >
                      {copiedUrl === source.url ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          复制链接
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
