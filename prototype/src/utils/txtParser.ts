// TXT 文件解析器：编码检测、章节分割、分页

export interface TxtChapter {
  title: string;
  content: string;
}

// 章节标题匹配模式
const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千万零\d]+[章节回集卷部篇].*[^\s]/,
  /^Chapter\s+\d+/i,
  /^CHAPTER\s+\d+/,
  /^第\s*\d+\s*[章节回]/,
  /^\d+[\.\s、].*[^\s]/,
];

// 检测文本编码并解码
export function decodeTxtBuffer(buffer: ArrayBuffer): string {
  // 先尝试 UTF-8
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch {
    // UTF-8 失败，尝试 GBK
    try {
      const decoder = new TextDecoder('gbk');
      return decoder.decode(buffer);
    } catch {
      // 最终回退到 UTF-8（容错模式）
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(buffer);
    }
  }
}

// 检查一行是否是章节标题
function isChapterTitle(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  return CHAPTER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// 将文本分割为章节
export function splitIntoChapters(text: string): TxtChapter[] {
  const lines = text.split(/\r?\n/);
  const chapters: TxtChapter[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isChapterTitle(line)) {
      // 保存前一章
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content) {
          chapters.push({
            title: currentTitle || '正文',
            content,
          });
        }
      }
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // 保存最后一章
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content) {
      chapters.push({
        title: currentTitle || '正文',
        content,
      });
    }
  }

  // 如果没有检测到章节，整篇作为一章
  if (chapters.length === 0) {
    chapters.push({
      title: '正文',
      content: text.trim(),
    });
  }

  return chapters;
}

// 将章节内容分页（按字符数估算）
export function paginateChapter(content: string, charsPerPage: number): string[] {
  if (charsPerPage <= 0) charsPerPage = 1500;

  const paragraphs = content.split(/\n+/).filter((p) => p.trim());
  const pages: string[] = [];
  let currentPage: string[] = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    const paraLength = para.length;

    // 如果单段就超过一页，强制按字符分割
    if (paraLength > charsPerPage) {
      // 先保存当前页
      if (currentPage.length > 0) {
        pages.push(currentPage.join('\n\n'));
        currentPage = [];
        currentLength = 0;
      }

      // 按字符数分割长段落
      let remaining = para;
      while (remaining.length > charsPerPage) {
        // 尝试在标点处断行
        let breakPoint = charsPerPage;
        const punctuation = '。！？；…，、';
        for (let i = charsPerPage; i > charsPerPage * 0.7; i--) {
          if (punctuation.includes(remaining[i] ?? '')) {
            breakPoint = i + 1;
            break;
          }
        }
        pages.push(remaining.slice(0, breakPoint));
        remaining = remaining.slice(breakPoint);
      }
      if (remaining) {
        currentPage = [remaining];
        currentLength = remaining.length;
      }
      continue;
    }

    // 如果加上这段会超过一页
    if (currentLength + paraLength + 2 > charsPerPage && currentPage.length > 0) {
      pages.push(currentPage.join('\n\n'));
      currentPage = [para];
      currentLength = paraLength;
    } else {
      currentPage.push(para);
      currentLength += paraLength + 2;
    }
  }

  // 保存最后一页
  if (currentPage.length > 0) {
    pages.push(currentPage.join('\n\n'));
  }

  return pages.length > 0 ? pages : [''];
}

// 段落格式参数
export interface ParagraphFormat {
  alignment?: string;     // 对齐方式
  spacing?: number;       // 段间距 (em)
}

// 将纯文本段落转为带缩进的 HTML
export function textToHtml(text: string, format?: ParagraphFormat): string {
  // 按单个换行符分割，保留空行结构
  const paragraphs = text.split('\n');
  const align = format?.alignment || 'justify';
  const spacing = format?.spacing ?? 0.8;
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      // 空行渲染为带高度的空段落，保持视觉间距
      if (!trimmed) {
        return `<p style="margin:${spacing}em 0;text-align:${align};min-height:1em;">&nbsp;</p>`;
      }
      return `<p style="text-indent:2em;margin:${spacing}em 0;text-align:${align};">${escapeHtml(trimmed)}</p>`;
    })
    .join('');
}

// 高亮信息接口
interface HighlightInfo {
  text: string;
  color: string;
  id: string;
  hasNote?: boolean;
  paragraphIndex?: number;    // 段落索引（精确位置）
  offsetInParagraph?: number; // 在段落中的偏移位置（精确位置）
}

// 将纯文本段落转为带高亮的 HTML
export function textToHtmlWithHighlights(text: string, highlights: HighlightInfo[], format?: ParagraphFormat): string {
  // 按单个换行符分割，保留空行结构
  const paragraphs = text.split('\n');
  const align = format?.alignment || 'justify';
  const spacing = format?.spacing ?? 0.8;

  return paragraphs
    .map((paragraph, paraIdx) => {
      const trimmed = paragraph.trim();
      // 空行渲染为带高度的空段落
      if (!trimmed) {
        return `<p style="margin:${spacing}em 0;text-align:${align};min-height:1em;">&nbsp;</p>`;
      }
      // 找到当前段落中的高亮位置
      const segments = findHighlightSegments(trimmed, highlights, paraIdx);

      const contentHtml = segments
        .map((seg) => {
          if (seg.highlight) {
            const noteClass = seg.highlight.hasNote ? ' highlight-note' : '';
            return `<span class="highlight-mark${noteClass}" data-highlight-id="${seg.highlight.id}" style="background-color: ${seg.highlight.color}; padding: 2px 0; cursor: pointer; border-radius: 2px;">${escapeHtml(seg.text)}</span>`;
          }
          return escapeHtml(seg.text);
        })
        .join('');

      return `<p style="text-indent:2em;margin:${spacing}em 0;text-align:${align};">${contentHtml}</p>`;
    })
    .join('');
}

// 从 HTML 提取纯文本（用于编辑保存）
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const paragraphs: string[] = [];
  div.querySelectorAll('p').forEach((p) => {
    const text = p.textContent?.trim() || '';
    if (text) paragraphs.push(text);
  });
  return paragraphs.join('\n');
}

// 在文本中查找高亮位置并分割为片段
function findHighlightSegments(
  text: string,
  highlights: HighlightInfo[],
  currentParagraphIndex: number
): { text: string; highlight: HighlightInfo | null }[] {
  // 收集所有高亮在当前文本中的位置
  const ranges: { start: number; end: number; highlight: HighlightInfo }[] = [];

  for (const hl of highlights) {
    // 如果有精确位置信息，只在指定位置匹配
    if (hl.paragraphIndex !== undefined && hl.offsetInParagraph !== undefined) {
      // 只匹配对应段落
      if (hl.paragraphIndex !== currentParagraphIndex) continue;

      const offset = hl.offsetInParagraph;
      // 验证该位置的文本是否与高亮文本匹配
      const substr = text.substring(offset, offset + hl.text.length);
      if (substr === hl.text) {
        ranges.push({ start: offset, end: offset + hl.text.length, highlight: hl });
      }
      continue;
    }

    // 兼容旧数据：没有位置信息时，匹配所有出现
    let searchStart = 0;
    while (searchStart < text.length) {
      const index = text.indexOf(hl.text, searchStart);
      if (index === -1) break;

      // 检查是否与已有范围重叠
      const overlaps = ranges.some(
        (r) => (index >= r.start && index < r.end) || (index + hl.text.length > r.start && index + hl.text.length <= r.end)
      );

      if (!overlaps) {
        ranges.push({ start: index, end: index + hl.text.length, highlight: hl });
      }
      searchStart = index + 1;
    }
  }

  // 如果没有高亮，直接返回整段文本
  if (ranges.length === 0) {
    return [{ text, highlight: null }];
  }

  // 按起始位置排序
  ranges.sort((a, b) => a.start - b.start);

  // 分割文本
  const segments: { text: string; highlight: HighlightInfo | null }[] = [];
  let pos = 0;

  for (const range of ranges) {
    if (range.start > pos) {
      segments.push({ text: text.slice(pos, range.start), highlight: null });
    }
    segments.push({ text: text.slice(range.start, range.end), highlight: range.highlight });
    pos = range.end;
  }

  if (pos < text.length) {
    segments.push({ text: text.slice(pos), highlight: null });
  }

  return segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 将纯文本段落转为带搜索关键词高亮的 HTML
export function textToHtmlWithSearch(text: string, query: string, format?: ParagraphFormat): string {
  if (!query.trim()) return textToHtml(text, format);
  // 按单个换行符分割，保留空行结构
  const paragraphs = text.split('\n');
  // 先对搜索词做 HTML 转义，再转义正则特殊字符
  const escapedHtml = escapeHtml(query);
  const escapedRegex = escapedHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedRegex})`, 'gi');
  const align = format?.alignment || 'justify';
  const spacing = format?.spacing ?? 0.8;

  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      // 空行渲染为带高度的空段落
      if (!trimmed) {
        return `<p style="margin:${spacing}em 0;text-align:${align};min-height:1em;">&nbsp;</p>`;
      }
      const contentHtml = escapeHtml(p.trim()).replace(
        regex,
        '<mark class="search-match">$1</mark>'
      );
      return `<p style="text-indent:2em;margin:${spacing}em 0;text-align:${align};">${contentHtml}</p>`;
    })
    .join('');
}
