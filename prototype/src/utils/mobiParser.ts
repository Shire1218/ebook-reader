// MOBI 文件解析器
// MOBI 基于 PalmDOC 格式（PDB），支持 LZ77 压缩

interface MobiResult {
  title: string;
  author: string;
  text: string;
}

// 读取 DataView 的 UTF-8 字符串
function readString(view: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(view.buffer, offset, length);
  // 找到 null 终止符
  let end = length;
  for (let i = 0; i < length; i++) {
    if (bytes[i] === 0) {
      end = i;
      break;
    }
  }
  return new TextDecoder('utf-8').decode(bytes.slice(0, end));
}

// PalmDOC LZ77 解压
function lz77Decompress(input: Uint8Array, maxLength: number): Uint8Array {
  const output: number[] = [];
  let i = 0;

  while (i < input.length && output.length < maxLength) {
    const byte = input[i]!;
    i++;

    if (byte === 0) {
      // 字面量 0x00
      output.push(0);
    } else if (byte <= 8) {
      // 接下来 byte 个字节原样复制
      for (let j = 0; j < byte && i < input.length; j++) {
        output.push(input[i]!);
        i++;
      }
    } else if (byte <= 0x7f) {
      // 字面量字符
      output.push(byte);
    } else if (byte <= 0xbf) {
      // 距离/长度压缩对
      if (i >= input.length) break;
      const next = input[i]!;
      i++;
      const distance = ((byte << 8) | next) & 0x3fff;
      const length = (output.length < 0x3ff ? 3 : 3);
      // 从已输出内容中复制
      const startPos = output.length - distance;
      for (let j = 0; j < length && output.length < maxLength; j++) {
        const idx = startPos + j;
        output.push(idx >= 0 && idx < output.length ? output[idx]! : 0);
      }
    } else {
      // 空格 + 字符
      output.push(0x20); // 空格
      output.push(byte ^ 0x80);
    }
  }

  return new Uint8Array(output);
}

// 解析 MOBI 文件
export function parseMobi(buffer: ArrayBuffer): MobiResult {
  const view = new DataView(buffer);
  const text = new TextDecoder('utf-8');

  // 读取 PDB 头部（78 字节）
  const name = readString(view, 0, 32);
  // 跳过属性类型(2) + 版本(2) + 创建时间(4) + 修改时间(4) + 备份时间(4)
  // + 修改号(4) + 应用信息偏移(4) + 排序信息偏移(4) + 类型(4) + 创建者(4)
  // = 偏移 76 处是记录数量
  const numRecords = view.getUint16(76);

  // 读取记录列表（每条 8 字节：4字节偏移 + 4字节ID/属性）
  const recordOffsets: number[] = [];
  for (let i = 0; i < numRecords; i++) {
    const offset = 78 + i * 8;
    recordOffsets.push(view.getUint32(offset));
  }

  if (recordOffsets.length < 2) {
    return { title: name, author: '未知作者', text: 'MOBI 文件解析失败' };
  }

  // 第一条记录是 PALMDOC 头部
  const palmDocHeaderOffset = recordOffsets[0]!;

  // PALMDOC 头部结构：
  // 0-1: 压缩类型 (0=无, 1=LZ77, 2=HUFF)
  // 2-3: 未使用
  // 4-7: 未压缩文本长度
  // 8-11: 记录数量
  // 12-15: 记录大小（PDB 记录大小，通常 4096）
  // 16-...: MOBI 头部（从偏移 16 开始）
  const compressionType = view.getUint16(palmDocHeaderOffset);
  const uncompressedLength = view.getUint32(palmDocHeaderOffset + 4);
  const recordCount = view.getUint32(palmDocHeaderOffset + 8);
  const recordSize = view.getUint32(palmDocHeaderOffset + 12);

  // 读取 MOBI 头部（从 PALMDOC 头部偏移 +16 开始）
  const mobiHeaderOffset = palmDocHeaderOffset + 16;
  let author = '未知作者';

  // MOBI 头部最小长度检查
  if (mobiHeaderOffset + 232 < buffer.byteLength) {
    // 检查 MOBI 魔数 'MOBI'
    const mobiMagic = readString(view, mobiHeaderOffset, 4);
    if (mobiMagic === 'MOBI') {
      // 头部长度
      // const headerLength = view.getUint32(mobiHeaderOffset + 4);

      // 尝试读取 EXTH 头部偏移
      // EXTH 记录从 MOBI 头部的特定偏移开始
      const exthFlag = view.getUint32(mobiHeaderOffset + 128);
      if (exthFlag & 0x40) {
        // 有 EXTH 数据
        const exthOffset = mobiHeaderOffset + 16 + (view.getUint32(mobiHeaderOffset + 20) || 0);
        if (exthOffset + 12 < buffer.byteLength) {
          const exthMagic = readString(view, exthOffset, 4);
          if (exthMagic === 'EXTH') {
            const exthLength = view.getUint32(exthOffset + 4);
            const exthRecordCount = view.getUint32(exthOffset + 8);
            let pos = exthOffset + 12;

            for (let i = 0; i < exthRecordCount && pos + 8 < exthOffset + exthLength; i++) {
              const recType = view.getUint32(pos);
              const recLength = view.getUint32(pos + 4);
              if (recLength < 8) break;
              const dataLength = recLength - 8;

              // 100 = 作者
              if (recType === 100 && dataLength > 0 && pos + 8 + dataLength <= buffer.byteLength) {
                author = text.decode(new Uint8Array(buffer, pos + 8, dataLength));
              }
              pos += recLength;
            }
          }
        }
      }
    }
  }

  // 提取文本记录（从 recordOffsets[1] 开始，共 recordCount 条）
  const textParts: string[] = [];
  const maxRecords = Math.min(recordCount, recordOffsets.length - 1);

  for (let i = 0; i < maxRecords; i++) {
    const recStart = recordOffsets[i + 1]!;
    const recEnd = i + 2 < recordOffsets.length
      ? recordOffsets[i + 2]!
      : recStart + (recordSize || 4096);
    const recData = new Uint8Array(buffer, recStart, recEnd - recStart);

    if (recData.length === 0) continue;

    let decompressed: Uint8Array;
    if (compressionType === 1) {
      // LZ77 压缩
      decompressed = lz77Decompress(recData, recordSize || 4096);
    } else if (compressionType === 2) {
      // HUFF/CDIC 压缩（简化处理：尝试直接解码）
      decompressed = recData;
    } else {
      // 无压缩
      decompressed = recData;
    }

    try {
      textParts.push(new TextDecoder('utf-8', { fatal: false }).decode(decompressed));
    } catch {
      textParts.push(new TextDecoder('latin1').decode(decompressed));
    }
  }

  let rawText = textParts.join('');

  // 如果文本看起来像 HTML，提取纯文本
  if (rawText.includes('<')) {
    rawText = stripHtmlTags(rawText);
  }

  // 限制文本长度防止内存问题
  const maxLen = uncompressedLength > 0 ? uncompressedLength : rawText.length;
  if (rawText.length > maxLen * 2) {
    rawText = rawText.slice(0, maxLen * 2);
  }

  return {
    title: name || '未知书名',
    author,
    text: rawText.trim(),
  };
}

// 去除 HTML 标签，保留文本内容
function stripHtmlTags(html: string): string {
  // 替换常见块级标签为换行
  let text = html
    .replace(/<\/?(p|div|h[1-6]|br|li|tr|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
