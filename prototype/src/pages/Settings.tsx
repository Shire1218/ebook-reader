import { RotateCcw, Keyboard } from 'lucide-react';
import { usePreferenceStore } from '@/stores/preferenceStore';

export default function Settings() {
  const {
    fontFamily, fontSize, lineHeight, theme, brightness, textAlignment, paragraphSpacing,
    setFontFamily, setFontSize, setLineHeight, setTheme, setBrightness, setTextAlignment, setParagraphSpacing,
    resetPreferences,
  } = usePreferenceStore();

  // 主题背景映射（用于预览）
  const themePreview: Record<string, { bg: string; text: string }> = {
    light: { bg: '#FAF8F5', text: '#2C2420' },
    dark: { bg: '#1A1A1A', text: '#D4D4D4' },
    sepia: { bg: '#F5F0EA', text: '#2C2420' },
    green: { bg: '#E8F0E4', text: '#333333' },
  };

  const preview = themePreview[theme] ?? themePreview.light!;

  return (
    <div className="flex-1 overflow-auto">
      {/* 标题栏 */}
      <div className="h-16 flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid var(--theme-border)' }}
      >
        <h1 className="font-serif text-xl font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
          设置
        </h1>
        <button
          onClick={resetPreferences}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all"
          style={{
            color: 'var(--theme-text-tertiary)',
            border: '1px solid var(--theme-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--theme-accent)';
            e.currentTarget.style.color = 'var(--theme-text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--theme-border)';
            e.currentTarget.style.color = 'var(--theme-text-tertiary)';
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>恢复默认</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* 预览区域 */}
        <div
          className="rounded-xl p-8 border border-warm-200"
          style={{ backgroundColor: preview.bg, color: preview.text }}
        >
          <h3 className="font-serif text-lg mb-3">预览效果</h3>
          <p style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily, textAlign: textAlignment, margin: `${paragraphSpacing}em 0` }}>
            这是一段预览文字。书卷多情似故人，晨昏忧乐每相亲。
          </p>
          <p style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily, textAlign: textAlignment, margin: `${paragraphSpacing}em 0` }}>
            眼前直下三千字，胸次全无一点尘。
          </p>
        </div>

        {/* 字体设置 */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium pb-2"
            style={{ color: 'var(--theme-text-primary)', borderBottom: '1px solid var(--theme-border)' }}
          >
            字体设置
          </h2>

          <div>
            <label className="text-xs mb-2 block" style={{ color: 'var(--theme-text-tertiary)' }}>
              字体族
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '系统默认', value: 'system-ui, sans-serif' },
                { label: '思源宋体', value: '"Noto Serif SC", serif' },
                { label: '等宽字体', value: 'ui-monospace, monospace' },
                { label: '楷体', value: 'KaiTi, "楷体", STKaiti, serif' },
                { label: '仿宋', value: 'FangSong, "仿宋", STFangsong, serif' },
                { label: '黑体', value: 'SimHei, "黑体", "Microsoft YaHei", sans-serif' },
              ].map((font) => (
                <button
                  key={font.value}
                  onClick={() => setFontFamily(font.value)}
                  className="px-4 py-3 text-sm rounded-xl border transition-all"
                  style={{
                    fontFamily: font.value,
                    borderColor: fontFamily === font.value ? 'var(--theme-accent)' : 'var(--theme-border)',
                    backgroundColor: fontFamily === font.value ? 'var(--theme-bg-secondary)' : 'transparent',
                    color: fontFamily === font.value ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
                  }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 flex items-center justify-between"
              style={{ color: 'var(--theme-text-tertiary)' }}
            >
              <span>字号</span>
              <span className="tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{fontSize}px</span>
            </label>
            <input
              type="range"
              min={12}
              max={48}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--theme-accent)' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
              <span>12px</span>
              <span>48px</span>
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 flex items-center justify-between"
              style={{ color: 'var(--theme-text-tertiary)' }}
            >
              <span>行距</span>
              <span className="tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{lineHeight.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--theme-accent)' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
              <span>1.0</span>
              <span>3.0</span>
            </div>
          </div>
        </section>

        {/* 段落格式 */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium pb-2"
            style={{ color: 'var(--theme-text-primary)', borderBottom: '1px solid var(--theme-border)' }}
          >
            段落格式
          </h2>

          <div>
            <label className="text-xs mb-2 flex items-center justify-between"
              style={{ color: 'var(--theme-text-tertiary)' }}
            >
              <span>段间距</span>
              <span className="tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{paragraphSpacing.toFixed(1)}em</span>
            </label>
            <input
              type="range"
              min={0}
              max={3.0}
              step={0.1}
              value={paragraphSpacing}
              onChange={(e) => setParagraphSpacing(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--theme-accent)' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
              <span>紧凑</span>
              <span>宽松</span>
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 block" style={{ color: 'var(--theme-text-tertiary)' }}>
              文本对齐
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '左对齐', value: 'left' as const },
                { label: '居中', value: 'center' as const },
                { label: '右对齐', value: 'right' as const },
                { label: '两端对齐', value: 'justify' as const },
              ].map((align) => (
                <button
                  key={align.value}
                  onClick={() => setTextAlignment(align.value)}
                  className="px-4 py-3 text-sm rounded-xl border transition-all"
                  style={{
                    borderColor: textAlignment === align.value ? 'var(--theme-accent)' : 'var(--theme-border)',
                    backgroundColor: textAlignment === align.value ? 'var(--theme-bg-secondary)' : 'transparent',
                    color: textAlignment === align.value ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
                  }}
                >
                  {align.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 主题设置 */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium pb-2"
            style={{ color: 'var(--theme-text-primary)', borderBottom: '1px solid var(--theme-border)' }}
          >
            主题
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '白天', value: 'light' as const, bg: '#FAF8F5', text: '#2C2420' },
              { label: '夜间', value: 'dark' as const, bg: '#1A1A1A', text: '#D4D4D4' },
              { label: '护眼', value: 'green' as const, bg: '#E8F0E4', text: '#333333' },
              { label: '牛皮纸', value: 'sepia' as const, bg: '#F5F0EA', text: '#2C2420' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className="p-4 rounded-xl border-2 transition-all"
                style={{
                  backgroundColor: t.bg,
                  borderColor: theme === t.value ? 'var(--theme-accent)' : 'var(--theme-border)',
                  boxShadow: theme === t.value ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <div className="w-full h-12 rounded-lg mb-2" style={{ backgroundColor: t.bg, border: `1px solid ${t.text}20` }} />
                <span className="text-xs" style={{ color: t.text }}>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 亮度 */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium pb-2"
            style={{ color: 'var(--theme-text-primary)', borderBottom: '1px solid var(--theme-border)' }}
          >
            亮度
          </h2>
          <div>
            <label className="text-xs mb-2 flex items-center justify-between"
              style={{ color: 'var(--theme-text-tertiary)' }}
            >
              <span>屏幕亮度</span>
              <span className="tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{brightness}%</span>
            </label>
            <input
              type="range"
              min={20}
              max={100}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--theme-accent)' }}
            />
          </div>
        </section>

        {/* 快捷键帮助 */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium pb-2 flex items-center gap-2"
            style={{ color: 'var(--theme-text-primary)', borderBottom: '1px solid var(--theme-border)' }}
          >
            <Keyboard className="w-4 h-4" />
            快捷键
          </h2>
          <div className="space-y-4">
            {/* 通用快捷键 */}
            <div>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                通用
              </h3>
              <div className="space-y-1.5">
                {[
                  { keys: ['←'], desc: '上一页 / 上一章' },
                  { keys: ['→'], desc: '下一页 / 下一章' },
                  { keys: ['PageUp'], desc: '向上翻屏' },
                  { keys: ['PageDown'], desc: '向下翻屏' },
                  { keys: ['T'], desc: '切换目录面板' },
                  { keys: ['B'], desc: '添加/切换书签' },
                  { keys: ['N'], desc: '切换标注笔记面板' },
                  { keys: ['S'], desc: '切换设置面板' },
                  { keys: ['Ctrl', 'F'], desc: '全文搜索' },
                  { keys: ['Esc'], desc: '关闭当前面板' },
                  { keys: ['?'], desc: '显示快捷键帮助' },
                ].map((item) => (
                  <div key={item.keys[0]} className="flex items-center justify-between py-1.5">
                    <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd key={k} className="px-2 py-0.5 text-xs font-mono rounded"
                          style={{
                            backgroundColor: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border)',
                            color: 'var(--theme-text-secondary)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* PDF 格式专属 */}
            <div>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                PDF 格式
              </h3>
              <div className="space-y-1.5">
                {[
                  { keys: ['Alt', '='], desc: '放大' },
                  { keys: ['Alt', '-'], desc: '缩小' },
                  { keys: ['Alt', '0'], desc: '重置缩放' },
                  { keys: ['Alt', '滚轮'], desc: '自由缩放' },
                ].map((item) => (
                  <div key={item.keys.join('-')} className="flex items-center justify-between py-1.5">
                    <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd key={k} className="px-2 py-0.5 text-xs font-mono rounded"
                          style={{
                            backgroundColor: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border)',
                            color: 'var(--theme-text-secondary)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* TXT 格式专属 */}
            <div>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                TXT 格式
              </h3>
              <div className="space-y-1.5">
                {[
                  { keys: ['↑'], desc: '向上滚动' },
                  { keys: ['↓'], desc: '向下滚动' },
                ].map((item) => (
                  <div key={item.keys[0]} className="flex items-center justify-between py-1.5">
                    <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd key={k} className="px-2 py-0.5 text-xs font-mono rounded"
                          style={{
                            backgroundColor: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border)',
                            color: 'var(--theme-text-secondary)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 关于 */}
        <section className="space-y-3 pb-8">
          <h2 className="text-sm font-medium pb-2"
            style={{ color: 'var(--theme-text-primary)', borderBottom: '1px solid var(--theme-border)' }}
          >
            关于
          </h2>
          <div className="space-y-2 text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
            <div className="flex justify-between">
              <span>应用名称</span>
              <span style={{ color: 'var(--theme-text-secondary)' }}>墨卷电子书阅读器</span>
            </div>
            <div className="flex justify-between">
              <span>版本</span>
              <span style={{ color: 'var(--theme-text-secondary)' }}>v0.5.0 (P5)</span>
            </div>
            <div className="flex justify-between">
              <span>技术栈</span>
              <span style={{ color: 'var(--theme-text-secondary)' }}>React + TypeScript + TailwindCSS</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
