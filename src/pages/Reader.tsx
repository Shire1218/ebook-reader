import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, List, Settings, Bookmark, BookmarkCheck, X, Highlighter, Trash2, Pencil, Check, Search, Keyboard, PenLine } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { usePreferenceStore } from '@/stores/preferenceStore';
import EpubReader from '@/components/Reader/EpubReader';
import TxtReader from '@/components/Reader/TxtReader';
import PdfReader from '@/components/Reader/PdfReader';
import MobiReader from '@/components/Reader/MobiReader';
import SelectionToolbar from '@/components/Reader/SelectionToolbar';
import ResizablePanel from '@/components/ResizablePanel';
import type { EpubReaderRef } from '@/components/Reader/EpubReader';
import type { TxtReaderRef } from '@/components/Reader/TxtReader';
import type { PdfReaderRef } from '@/components/Reader/PdfReader';
import type { MobiReaderRef } from '@/components/Reader/MobiReader';
import { useKeyboardShortcuts, SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import {
  addBookmark,
  getBookmarks,
  deleteBookmark,
  getHighlights,
  addHighlight,
  deleteHighlight,
  updateHighlight,
  saveBookFile,
  getBookFile,
} from '@/utils/db';
import { decodeTxtBuffer, splitIntoChapters } from '@/utils/txtParser';
import type { Bookmark as BookmarkType, TocItem, Highlight, HighlightColor, TextAlignment } from '@/types';

// 从 contentEditable 的 HTML 中提取文本行，保留空行和换行结构
// 处理 <p>、<div> 等块级元素以及 <br> 标签
function htmlToTextLines(html: string): string[] {
  const div = document.createElement('div');
  div.innerHTML = html;

  // 收集所有块级元素（<p>、<div>）和 <br> 标签
  const lines: string[] = [];
  const blockElements = div.querySelectorAll('p, div');

  if (blockElements.length === 0) {
    // 没有块级元素，直接取文本内容并按换行分割
    const text = div.textContent || '';
    if (text) {
      text.split(/\n/).forEach((line) => lines.push(line));
    }
    return lines;
  }

  blockElements.forEach((el) => {
    // 处理元素内的 <br> 标签，将其视为换行
    const innerHtml = el.innerHTML;
    if (innerHtml.includes('<br')) {
      // 有 <br> 标签，按 <br> 分割
      const parts = innerHtml.split(/<br\s*\/?\s*>/i);
      parts.forEach((part) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = part;
        lines.push(tempDiv.textContent || '');
      });
    } else {
      lines.push(el.textContent || '');
    }
  });

  return lines;
}

// Toast 消息类型
type ToastType = 'success' | 'error';

// 字体列表
const FONT_OPTIONS = [
  { label: '系统默认', value: 'system-ui, sans-serif' },
  { label: '思源宋体', value: '"Noto Serif SC", serif' },
  { label: '等宽字体', value: 'ui-monospace, monospace' },
  { label: '楷体', value: 'KaiTi, "楷体", STKaiti, serif' },
  { label: '仿宋', value: 'FangSong, "仿宋", STFangsong, serif' },
  { label: '黑体', value: 'SimHei, "黑体", "Microsoft YaHei", sans-serif' },
];

// 搜索结果类型
interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  context: string;
  matchIndex: number;      // 全局匹配序号
  matchInChapter: number;  // 章节内匹配序号（用于滚动定位）
}

export default function Reader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const books = useBookStore((s) => s.books);
  const updateBook = useBookStore((s) => s.updateBook);
  const loadBooks = useBookStore((s) => s.loadBooks);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 保存最新的位置和进度，防止组件卸载时丢失
  const pendingLocationRef = useRef<string>('');
  const pendingProgressRef = useRef<number>(0);

  // Toast 提示状态
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 高亮详情弹窗状态
  const [highlightPopover, setHighlightPopover] = useState<{
    highlight: Highlight;
    position: { x: number; y: number };
  } | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // 进度条拖拽状态
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [displayProgress, setDisplayProgress] = useState<number | null>(null);

  // 全文搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false);
  const editedChaptersRef = useRef<Record<number, string>>({});  // 跟踪编辑后的章节内容
  const lastEditChapterRef = useRef<number>(-1);  // 上次编辑的章节索引

  // 阅读器 ref
  const epubReaderRef = useRef<EpubReaderRef>(null);
  const txtReaderRef = useRef<TxtReaderRef>(null);
  const pdfReaderRef = useRef<PdfReaderRef>(null);
  const mobiReaderRef = useRef<MobiReaderRef>(null);

  const { fontSize, lineHeight, fontFamily, theme } = usePreferenceStore();
  const setFontSize = usePreferenceStore((s) => s.setFontSize);
  const setLineHeight = usePreferenceStore((s) => s.setLineHeight);
  const setFontFamily = usePreferenceStore((s) => s.setFontFamily);
  const setTheme = usePreferenceStore((s) => s.setTheme);
  const textAlignment = usePreferenceStore((s) => s.textAlignment);
  const paragraphSpacing = usePreferenceStore((s) => s.paragraphSpacing);
  const setTextAlignment = usePreferenceStore((s) => s.setTextAlignment);
  const setParagraphSpacing = usePreferenceStore((s) => s.setParagraphSpacing);

  const book = books.find((b) => b.id === bookId);
  const bookRef = useRef(book);
  bookRef.current = book;

  const [progress, setProgress] = useState(book?.progress ?? 0);
  const [currentLocation, setCurrentLocation] = useState(book?.currentLocation ?? '');
  const [currentChapterName, setCurrentChapterName] = useState(book?.currentChapter || '');

  // 主题背景映射
  const themeBg: Record<string, string> = {
    light: 'bg-warm-50 text-warm-800',
    dark: 'bg-night-bg text-night-text',
    sepia: 'bg-warm-100 text-warm-800',
    green: 'bg-eye-bg text-eye-text',
  };

  // 高亮颜色映射
  const highlightColorMap: Record<HighlightColor, { bg: string; border: string }> = {
    yellow: { bg: '#FEF3C7', border: '#F59E0B' },
    green: { bg: '#D1FAE5', border: '#10B981' },
    blue: { bg: '#DBEAFE', border: '#3B82F6' },
    pink: { bg: '#FCE7F3', border: '#EC4899' },
    purple: { bg: '#EDE9FE', border: '#8B5CF6' },
  };

  // 显示 Toast 提示
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // 关闭所有面板
  const closeAllPanels = useCallback(() => {
    setShowSettings(false);
    setShowToc(false);
    setShowBookmarks(false);
    setShowNotes(false);
    setShowSearch(false);
  }, []);

  // 快捷键系统
  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts({
    onToggleToc: () => {
      setShowToc((v) => !v);
      setShowSettings(false);
      setShowBookmarks(false);
      setShowNotes(false);
      setShowSearch(false);
    },
    onToggleBookmarks: () => {
      setShowBookmarks((v) => !v);
      setShowToc(false);
      setShowSettings(false);
      setShowNotes(false);
      setShowSearch(false);
    },
    onToggleNotes: () => {
      setShowNotes((v) => !v);
      setShowToc(false);
      setShowSettings(false);
      setShowBookmarks(false);
      setShowSearch(false);
    },
    onToggleSettings: () => {
      setShowSettings((v) => !v);
      setShowToc(false);
      setShowBookmarks(false);
      setShowNotes(false);
      setShowSearch(false);
    },
    onToggleSearch: () => {
      setShowSearch((v) => !v);
      setShowToc(false);
      setShowSettings(false);
      setShowBookmarks(false);
      setShowNotes(false);
    },
    onCloseAllPanels: closeAllPanels,
  });

  // 如果书籍数据未加载（如直接通过 URL 访问），自动加载
  useEffect(() => {
    if (books.length === 0) {
      loadBooks();
    }
  }, [books.length, loadBooks]);

  // 加载书签
  useEffect(() => {
    if (bookId) {
      getBookmarks(bookId).then(setBookmarks);
    }
  }, [bookId]);

  // 加载高亮
  useEffect(() => {
    if (bookId) {
      getHighlights(bookId)
        .then(setHighlights)
        .catch((err) => {
          console.error('加载标注失败:', err);
          showToast('加载标注失败', 'error');
        });
    }
  }, [bookId, showToast]);

  // 搜索面板打开时自动聚焦
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  // 选中文本工具栏状态
  const [selectionToolbar, setSelectionToolbar] = useState<{
    text: string;
    position: { x: number; y: number };
    cfiRange?: string;
    paragraphIndex?: number;
    offsetInParagraph?: number;
  } | null>(null);

  // 处理文本选择（弹出工具栏）
  const handleTextSelected = useCallback(
    (selection: { text: string; cfiRange?: string; position: { x: number; y: number }; paragraphIndex?: number; offsetInParagraph?: number }) => {
      setSelectionToolbar({
        text: selection.text,
        position: selection.position,
        cfiRange: selection.cfiRange,
        paragraphIndex: selection.paragraphIndex,
        offsetInParagraph: selection.offsetInParagraph,
      });
    },
    []
  );

  // 处理高亮（直接选颜色高亮）
  const handleHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!book || !selectionToolbar) return;
      const highlight: Highlight = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        bookId: book.id,
        location: selectionToolbar.cfiRange || currentLocation,
        text: selectionToolbar.text,
        color,
        chapter: currentChapterName || `进度 ${Math.round(progress)}%`,
        createdAt: Date.now(),
        paragraphIndex: selectionToolbar.paragraphIndex,
        offsetInParagraph: selectionToolbar.offsetInParagraph,
      };
      try {
        await addHighlight(highlight);
        setHighlights((prev) => [highlight, ...prev]);
        setSelectionToolbar(null);
        showToast('高亮已添加');
      } catch (err) {
        console.error('添加高亮失败:', err);
        showToast('添加高亮失败，请刷新页面重试', 'error');
      }
    },
    [book, selectionToolbar, currentLocation, currentChapterName, progress, showToast]
  );

  // 处理添加批注
  const handleAddNote = useCallback(
    async (color: HighlightColor, note: string) => {
      if (!book || !selectionToolbar) return;
      const highlight: Highlight = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        bookId: book.id,
        location: selectionToolbar.cfiRange || currentLocation,
        text: selectionToolbar.text,
        color,
        note,
        chapter: currentChapterName || `进度 ${Math.round(progress)}%`,
        createdAt: Date.now(),
        paragraphIndex: selectionToolbar.paragraphIndex,
        offsetInParagraph: selectionToolbar.offsetInParagraph,
      };
      try {
        await addHighlight(highlight);
        setHighlights((prev) => [highlight, ...prev]);
        setSelectionToolbar(null);
        showToast('批注已添加');
      } catch (err) {
        console.error('添加批注失败:', err);
        showToast('添加批注失败，请刷新页面重试', 'error');
        throw err;
      }
    },
    [book, selectionToolbar, currentLocation, currentChapterName, progress, showToast]
  );

  // 处理高亮点击
  const handleHighlightClick = useCallback((highlight: Highlight, position?: { x: number; y: number }) => {
    if (!position) return;
    const popoverWidth = 300;
    const popoverHeight = 280;
    let x = position.x - popoverWidth / 2;
    let y = position.y + 8;
    if (x + popoverWidth > window.innerWidth - 16) x = window.innerWidth - popoverWidth - 16;
    if (x < 16) x = 16;
    if (y + popoverHeight > window.innerHeight - 16) y = position.y - popoverHeight - 8;
    if (y < 16) y = 16;
    setHighlightPopover({ highlight, position: { x, y } });
    setEditingNote(false);
    setEditNoteText(highlight.note || '');
  }, []);

  // 关闭高亮弹窗
  const handleClosePopover = useCallback(() => {
    setHighlightPopover(null);
    setEditingNote(false);
  }, []);

  // 保存编辑的批注
  const handleSaveNote = useCallback(async () => {
    if (!highlightPopover) return;
    const updated = { ...highlightPopover.highlight, note: editNoteText.trim() || undefined };
    try {
      await updateHighlight(updated);
      setHighlights((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      setHighlightPopover({ ...highlightPopover, highlight: updated });
      setEditingNote(false);
      showToast('批注已更新');
    } catch (err) {
      console.error('更新批注失败:', err);
      showToast('更新批注失败', 'error');
    }
  }, [highlightPopover, editNoteText, showToast]);

  // 删除标注
  const handleDeleteFromPopover = useCallback(async () => {
    if (!highlightPopover) return;
    try {
      await deleteHighlight(highlightPopover.highlight.id);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightPopover.highlight.id));
      setHighlightPopover(null);
      setEditingNote(false);
      showToast('标注已删除');
    } catch (err) {
      console.error('删除标注失败:', err);
      showToast('删除标注失败', 'error');
    }
  }, [highlightPopover, showToast]);

  // 从标注面板删除
  const handleDeleteHighlight = useCallback(async (id: string) => {
    try {
      await deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      showToast('标注已删除');
    } catch (err) {
      console.error('删除标注失败:', err);
      showToast('删除标注失败', 'error');
    }
  }, [showToast]);

  // 保存编辑 - 将编辑内容写回原始文件
  const handleSaveEdit = useCallback(async () => {
    if (!book) return;

    try {
      // 保存当前章节的编辑内容
      if (txtReaderRef.current?.isDirty()) {
        const currentHtml = txtReaderRef.current.getEditedContent();
        const lines = htmlToTextLines(currentHtml);
        const chapterIdx = txtReaderRef.current.getCurrentChapterIndex();
        editedChaptersRef.current[chapterIdx] = lines.join('\n');
      }

      // 如果没有编辑任何章节，提示用户
      if (Object.keys(editedChaptersRef.current).length === 0) {
        showToast('没有修改任何内容', 'error');
        return;
      }

      // 读取原始文件
      const fileData = await getBookFile(book.id);
      if (!fileData) {
        showToast('无法读取原始文件', 'error');
        return;
      }

      // 解码原始文件
      const originalText = decodeTxtBuffer(fileData);
      const chapters = splitIntoChapters(originalText);

      // 重建完整文件
      let fullText = '';
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]!;
        // 添加章节标题（如果不是"正文"）
        if (chapter.title !== '正文') {
          if (fullText) fullText += '\n';
          fullText += chapter.title + '\n';
        } else if (i > 0) {
          fullText += '\n';
        }
        // 使用编辑后的内容或原始内容（用 in 判断，避免空字符串被 || 误判为 falsy）
        const content = i in editedChaptersRef.current ? editedChaptersRef.current[i]! : chapter.content;
        fullText += content;
      }

      // 编码并保存
      const encoder = new TextEncoder();
      const newData = encoder.encode(fullText).buffer;
      await saveBookFile(book.id, newData);

      // 清理编辑状态
      editedChaptersRef.current = {};
      lastEditChapterRef.current = -1;
      setIsEditMode(false);
      showToast('文件已保存');
    } catch (err) {
      console.error('保存失败:', err);
      showToast('保存失败', 'error');
    }
  }, [book, showToast]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    if (txtReaderRef.current?.isDirty()) {
      if (!confirm('有未保存的修改，确定要放弃吗？')) {
        return;
      }
    }
    txtReaderRef.current?.reloadChapter();
    editedChaptersRef.current = {};
    lastEditChapterRef.current = -1;
    setIsEditMode(false);
  }, []);

  // 格式化命令处理
  const handleFormatCommand = useCallback((command: string, value?: string) => {
    if (command === 'bold') {
      document.execCommand('bold');
    } else if (command === 'italic') {
      document.execCommand('italic');
    } else if (command === 'underline') {
      document.execCommand('underline');
    } else if (command === 'delete') {
      document.execCommand('delete');
    } else if (command === 'insertText' && value) {
      document.execCommand('insertText', false, value);
    }
  }, []);

  // 段落对齐变化处理 - 仅对选中的段落生效
  const handleParagraphAlign = useCallback((alignment: TextAlignment) => {
    // 使用 execCommand 仅对选中的段落生效
    const commandMap: Record<TextAlignment, string> = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull',
    };
    document.execCommand(commandMap[alignment]);
  }, []);

  // 点击标注记录定位
  const handleHighlightNavigate = useCallback((highlight: Highlight) => {
    if (book?.format === 'epub') {
      epubReaderRef.current?.goToLocation(highlight.location);
    } else if (book?.format === 'txt') {
      try {
        const loc = JSON.parse(highlight.location);
        if (typeof loc.chapter === 'number') {
          txtReaderRef.current?.goToChapter(loc.chapter);
          setTimeout(() => {
            txtReaderRef.current?.scrollToHighlight(highlight.id);
          }, 100);
        }
      } catch {
        // 解析失败忽略
      }
    } else if (book?.format === 'pdf') {
      try {
        const loc = JSON.parse(highlight.location);
        if (typeof loc.page === 'number') {
          pdfReaderRef.current?.goToPage(loc.page);
        }
      } catch {
        // 解析失败忽略
      }
    } else if (book?.format === 'mobi') {
      try {
        const loc = JSON.parse(highlight.location);
        if (typeof loc.chapter === 'number') {
          mobiReaderRef.current?.goToChapter(loc.chapter);
          setTimeout(() => {
            mobiReaderRef.current?.scrollToHighlight(highlight.id);
          }, 100);
        }
      } catch {
        // 解析失败忽略
      }
    }
  }, [book?.format]);

  // 点击弹窗外部关闭
  useEffect(() => {
    if (!highlightPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClosePopover();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [highlightPopover, handleClosePopover]);

  // 检查当前是否已收藏
  useEffect(() => {
    if (currentLocation && bookmarks.length > 0) {
      const bookmarked = bookmarks.some((b) => b.location === currentLocation);
      setIsBookmarked(bookmarked);
    } else {
      setIsBookmarked(false);
    }
  }, [currentLocation, bookmarks]);

  // 位置变化回调 - 防抖保存进度
  const handleLocationChange = useCallback(
    (location: string, newProgress: number, chapterName?: string) => {
      setCurrentLocation(location);
      setProgress(newProgress);
      if (chapterName) {
        setCurrentChapterName(chapterName);
      }

      pendingLocationRef.current = location;
      pendingProgressRef.current = newProgress;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const latestBook = bookRef.current;
        if (latestBook) {
          updateBook({
            ...latestBook,
            currentLocation: pendingLocationRef.current,
            progress: pendingProgressRef.current,
            lastReadTime: Date.now(),
          });
        }
      }, 2000);
    },
    [updateBook]
  );

  // 包装 handleLocationChange，在章节切换时保存编辑内容
  const wrappedHandleLocationChange = useCallback(
    (location: string, newProgress: number, chapterName?: string) => {
      // 如果处于编辑模式，检查是否切换了章节
      if (isEditMode && txtReaderRef.current) {
        const currentIdx = txtReaderRef.current.getCurrentChapterIndex();
        if (lastEditChapterRef.current >= 0 && lastEditChapterRef.current !== currentIdx) {
          // 章节切换了，保存上一章的编辑内容
          if (txtReaderRef.current.isDirty()) {
            const html = txtReaderRef.current.getEditedContent();
            const lines = htmlToTextLines(html);
            editedChaptersRef.current[lastEditChapterRef.current] = lines.join('\n');
          }
        }
        lastEditChapterRef.current = currentIdx;
      }

      // 调用原始的 handleLocationChange
      handleLocationChange(location, newProgress, chapterName);
    },
    [isEditMode, handleLocationChange]
  );

  // 组件卸载时立即刷新保存进度
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const latestBook = bookRef.current;
      if (latestBook && pendingLocationRef.current) {
        updateBook({
          ...latestBook,
          currentLocation: pendingLocationRef.current,
          progress: pendingProgressRef.current,
          lastReadTime: Date.now(),
        });
      }
    };
  }, [updateBook]);

  // 目录加载回调
  const handleTocLoaded = useCallback((tocItems: { label: string; href: string }[]) => {
    const items: TocItem[] = tocItems.map((item, idx) => ({
      id: `toc-${idx}`,
      label: item.label,
      href: item.href,
    }));
    setToc(items);
  }, []);

  // 目录点击跳转
  const handleTocClick = useCallback(
    (item: TocItem) => {
      if (book?.format === 'epub') {
        epubReaderRef.current?.goToChapter(item.href);
      } else if (book?.format === 'txt') {
        const match = item.href.match(/chapter-(\d+)/);
        if (match) {
          const index = parseInt(match[1]!, 10);
          txtReaderRef.current?.goToChapter(index);
        }
      } else if (book?.format === 'pdf') {
        const match = item.href.match(/page-(\d+)/);
        if (match) {
          const page = parseInt(match[1]!, 10);
          pdfReaderRef.current?.goToPage(page);
        }
      } else if (book?.format === 'mobi') {
        const match = item.href.match(/chapter-(\d+)/);
        if (match) {
          const index = parseInt(match[1]!, 10);
          mobiReaderRef.current?.goToChapter(index);
        }
      }
      setShowToc(false);
    },
    [book?.format]
  );

  // 进度条拖拽开始
  const handleProgressMouseDown = useCallback(() => {
    setIsDraggingProgress(true);
    setDisplayProgress(progress);
  }, [progress]);

  // 进度条拖拽中
  const handleProgressInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isDraggingProgress) {
        setDisplayProgress(Number(e.target.value));
      }
    },
    [isDraggingProgress]
  );

  // 进度条拖拽结束 - 执行跳转
  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newProgress = Number(e.target.value);
      setProgress(newProgress);
      setDisplayProgress(null);
      setIsDraggingProgress(false);

      // 根据格式执行跳转
      if (book?.format === 'txt' && txtReaderRef.current) {
        // TXT: 根据进度计算目标章节
        // 通过触发阅读器内部的章节跳转
        const event = new CustomEvent('reader-seek', { detail: { progress: newProgress } });
        window.dispatchEvent(event);
      } else if (book?.format === 'pdf' && pdfReaderRef.current) {
        // PDF: 通过事件通知跳转
        const event = new CustomEvent('reader-seek', { detail: { progress: newProgress } });
        window.dispatchEvent(event);
      } else if (book?.format === 'mobi' && mobiReaderRef.current) {
        const event = new CustomEvent('reader-seek', { detail: { progress: newProgress } });
        window.dispatchEvent(event);
      }
    },
    [book?.format]
  );

  // 添加/删除书签
  const handleToggleBookmark = useCallback(async () => {
    if (!book || !currentLocation) return;

    if (isBookmarked) {
      const bookmark = bookmarks.find((b) => b.location === currentLocation);
      if (bookmark) {
        await deleteBookmark(bookmark.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
      }
    } else {
      const newBookmark: BookmarkType = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        bookId: book.id,
        location: currentLocation,
        chapter: book.currentChapter || `进度 ${Math.round(progress)}%`,
        progress,
        createdAt: Date.now(),
      };
      await addBookmark(newBookmark);
      setBookmarks((prev) => [newBookmark, ...prev]);
    }
  }, [book, currentLocation, isBookmarked, bookmarks, progress]);

  // 点击书签跳转
  const handleBookmarkClick = useCallback(
    (bookmark: BookmarkType) => {
      if (book?.format === 'epub') {
        epubReaderRef.current?.goToLocation(bookmark.location);
      } else if (book?.format === 'txt') {
        txtReaderRef.current?.goToLocation(bookmark.location);
      } else if (book?.format === 'pdf') {
        try {
          const loc = JSON.parse(bookmark.location);
          if (typeof loc.page === 'number') {
            pdfReaderRef.current?.goToPage(loc.page);
          }
        } catch {
          // 解析失败忽略
        }
      } else if (book?.format === 'mobi') {
        mobiReaderRef.current?.goToLocation(bookmark.location);
      }
      setShowBookmarks(false);
    },
    [book?.format]
  );

  // 删除书签
  const handleDeleteBookmark = useCallback(async (id: string) => {
    await deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // 全文搜索 - 基于章节文本直接搜索，不跳转页面
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !book) return;
    setIsSearching(true);
    setSearchResults([]);
    setActiveSearchIdx(-1);

    try {
      const query = searchQuery.toLowerCase();
      const results: SearchResult[] = [];

      // 获取章节文本：TXT/MOBI 通过 ref，EPUB/PDF 通过目录
      let chaptersText: string[] = [];
      if ((book.format === 'txt' && txtReaderRef.current) || (book.format === 'mobi' && mobiReaderRef.current)) {
        chaptersText = book.format === 'txt'
          ? txtReaderRef.current!.getChaptersText()
          : mobiReaderRef.current!.getChaptersText();
      }

      // 逐章搜索
      for (let i = 0; i < toc.length; i++) {
        const item = toc[i]!;
        let text = '';

        if (chaptersText.length > i) {
          text = chaptersText[i] || '';
        }

        if (!text) continue;

        const lowerText = text.toLowerCase();
        let startIdx = 0;
        let matchInChapter = 0;
        while (startIdx < lowerText.length) {
          const matchIdx = lowerText.indexOf(query, startIdx);
          if (matchIdx === -1) break;

          // 提取上下文
          const ctxStart = Math.max(0, matchIdx - 30);
          const ctxEnd = Math.min(text.length, matchIdx + query.length + 30);
          const context = (ctxStart > 0 ? '...' : '') +
            text.slice(ctxStart, matchIdx) +
            '【' + text.slice(matchIdx, matchIdx + query.length) + '】' +
            text.slice(matchIdx + query.length, ctxEnd) +
            (ctxEnd < text.length ? '...' : '');

          results.push({
            chapterIndex: i,
            chapterTitle: item.label,
            context,
            matchIndex: results.length,
            matchInChapter,
          });
          matchInChapter++;
          startIdx = matchIdx + 1;

          if (results.length >= 100) break;
        }

        if (results.length >= 100) break;
      }

      setSearchResults(results);
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, book, toc]);

  // 搜索结果点击跳转 - 不关闭搜索面板
  const handleSearchResultClick = useCallback(
    (result: SearchResult, idx: number) => {
      setActiveSearchIdx(idx);

      // 跳转到对应章节
      if (book?.format === 'txt') {
        txtReaderRef.current?.goToChapter(result.chapterIndex);
        // 等待渲染后滚动到匹配位置
        setTimeout(() => {
          txtReaderRef.current?.scrollToSearchMatch(result.matchInChapter);
        }, 150);
      } else if (book?.format === 'mobi') {
        mobiReaderRef.current?.goToChapter(result.chapterIndex);
        setTimeout(() => {
          mobiReaderRef.current?.scrollToSearchMatch(result.matchInChapter);
        }, 150);
      } else if (book?.format === 'epub') {
        const item = toc[result.chapterIndex];
        if (item) {
          epubReaderRef.current?.goToChapter(item.href);
          setTimeout(() => {
            epubReaderRef.current?.scrollToSearchMatch(result.matchInChapter);
          }, 300);
        }
      } else if (book?.format === 'pdf') {
        const item = toc[result.chapterIndex];
        if (item) {
          const match = item.href.match(/page-(\d+)/);
          if (match) {
            pdfReaderRef.current?.goToPage(parseInt(match[1]!, 10));
            setTimeout(() => {
              pdfReaderRef.current?.scrollToSearchMatch(result.matchInChapter);
            }, 300);
          }
        }
      }
    },
    [book?.format, toc]
  );

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center bg-warm-50">
        <div className="text-center">
          <p className="text-warm-400 mb-4">未找到该书籍</p>
          <button
            onClick={() => navigate('/')}
            className="text-warm-400 hover:text-warm-600 underline text-sm"
          >
            返回书架
          </button>
        </div>
      </div>
    );
  }

  const currentProgress = isDraggingProgress ? displayProgress ?? progress : progress;

  return (
    <div className={`flex-1 flex flex-col h-full theme-transition ${themeBg[theme] || themeBg.light}`}>
      {/* 顶部工具栏 */}
      <header className="h-14 flex items-center justify-between px-4 bg-black/5 backdrop-blur-sm border-b border-black/5 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>书架</span>
        </button>

        <h1 className="font-serif text-sm font-medium truncate max-w-xs">{book.title}</h1>

        <div className="flex items-center gap-1">
          {/* 编辑模式按钮（仅 TXT 格式） */}
          {book.format === 'txt' && (
            <button
              onClick={() => {
                if (isEditMode) {
                  handleCancelEdit();
                } else {
                  setIsEditMode(true);
                  lastEditChapterRef.current = txtReaderRef.current?.getCurrentChapterIndex() ?? -1;
                }
                closeAllPanels();
              }}
              className={`p-2 rounded-lg transition-colors ${isEditMode ? 'bg-amber-400/20 text-amber-600' : 'hover:bg-black/5'}`}
              title={isEditMode ? '退出编辑' : '编辑模式'}
            >
              <PenLine className="w-4 h-4" />
            </button>
          )}

          {/* 搜索按钮 */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setShowToc(false);
              setShowSettings(false);
              setShowBookmarks(false);
              setShowNotes(false);
            }}
            className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-black/10' : 'hover:bg-black/5'}`}
            title="全文搜索 (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 标注笔记按钮 */}
          <button
            onClick={() => {
              setShowNotes(!showNotes);
              setShowToc(false);
              setShowSettings(false);
              setShowBookmarks(false);
              setShowSearch(false);
            }}
            className={`p-2 rounded-lg transition-colors relative ${showNotes ? 'bg-black/10' : 'hover:bg-black/5'}`}
            title="标注笔记 (N)"
          >
            <Highlighter className="w-4 h-4" />
            {highlights.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-warm-400 text-white text-[10px] rounded-full flex items-center justify-center">
                {highlights.length > 9 ? '9+' : highlights.length}
              </span>
            )}
          </button>

          {/* 书签按钮 */}
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-lg transition-colors ${
              isBookmarked ? 'text-warm-400 bg-warm-400/10' : 'hover:bg-black/5'
            }`}
            title="添加/取消书签 (B)"
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>

          {/* 书签列表按钮 */}
          {bookmarks.length > 0 && (
            <button
              onClick={() => {
                setShowBookmarks(!showBookmarks);
                setShowToc(false);
                setShowSettings(false);
                setShowNotes(false);
                setShowSearch(false);
              }}
              className={`p-2 rounded-lg transition-colors ${showBookmarks ? 'bg-black/10' : 'hover:bg-black/5'}`}
              title="书签列表"
            >
              <span className="text-xs">{bookmarks.length}</span>
            </button>
          )}

          {/* 目录按钮 */}
          {toc.length > 0 && (
            <button
              onClick={() => {
                setShowToc(!showToc);
                setShowSettings(false);
                setShowBookmarks(false);
                setShowNotes(false);
                setShowSearch(false);
              }}
              className={`p-2 rounded-lg transition-colors ${showToc ? 'bg-black/10' : 'hover:bg-black/5'}`}
              title="目录 (T)"
            >
              <List className="w-4 h-4" />
            </button>
          )}

          {/* 设置按钮 */}
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowToc(false);
              setShowBookmarks(false);
              setShowNotes(false);
              setShowSearch(false);
            }}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-black/10' : 'hover:bg-black/5'}`}
            title="设置 (S)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* 快捷键帮助按钮 */}
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={`p-2 rounded-lg transition-colors ${showShortcuts ? 'bg-black/10' : 'hover:bg-black/5'}`}
            title="快捷键帮助 (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 搜索面板 */}
        {showSearch && (
          <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={500}>
            <aside className="h-full border-r border-black/5 bg-black/5 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium opacity-70">全文搜索</h3>
                <button onClick={() => setShowSearch(false)} className="p-1 hover:opacity-70">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                    if (e.key === 'Escape') setShowSearch(false);
                  }}
                  placeholder="输入搜索关键词..."
                  className="flex-1 px-3 py-2 text-sm bg-white/50 border border-black/10 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-warm-400/30"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-3 py-2 text-sm bg-warm-400 text-white rounded-lg hover:bg-warm-500
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  搜索
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-warm-200 border-t-warm-400 rounded-full animate-spin" />
                    <span className="ml-2 text-xs text-warm-400">搜索中...</span>
                  </div>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-warm-400 mb-2">
                      找到 {searchResults.length} 个结果
                    </p>
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg cursor-pointer transition-colors ${
                          activeSearchIdx === idx
                            ? 'bg-warm-400/15 ring-1 ring-warm-400/30'
                            : 'hover:bg-black/5'
                        }`}
                        onClick={() => handleSearchResultClick(result, idx)}
                      >
                        <p className="text-xs font-medium opacity-60 mb-1">{result.chapterTitle}</p>
                        <p className="text-xs opacity-80 leading-relaxed break-all">{result.context}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!isSearching && searchQuery && searchResults.length === 0 && (
                  <p className="text-xs text-warm-400 text-center py-8">未找到匹配结果</p>
                )}
              </div>
            </aside>
          </ResizablePanel>
        )}

        {/* 书签列表面板 */}
        {showBookmarks && (
          <ResizablePanel defaultWidth={256} minWidth={200} maxWidth={400}>
            <aside className="h-full border-r border-black/5 bg-black/5 p-4 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium opacity-70">书签</h3>
                <button onClick={() => setShowBookmarks(false)} className="p-1 hover:opacity-70">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 cursor-pointer group"
                    onClick={() => handleBookmarkClick(bookmark)}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-warm-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{bookmark.chapter}</p>
                      <p className="text-xs opacity-50">{Math.round(bookmark.progress)}%</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBookmark(bookmark.id);
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </ResizablePanel>
        )}

        {/* 标注笔记面板 */}
        {showNotes && (
          <ResizablePanel defaultWidth={288} minWidth={240} maxWidth={500}>
            <aside className="h-full border-r border-black/5 bg-black/5 p-4 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium opacity-70">标注笔记</h3>
                <button onClick={() => setShowNotes(false)} className="p-1 hover:opacity-70">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {highlights.length === 0 ? (
                <div className="text-center py-8">
                  <Highlighter className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs opacity-50">暂无标注</p>
                  <p className="text-xs opacity-40 mt-1">选中文本即可添加标注</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {highlights.map((highlight) => {
                    const colors = highlightColorMap[highlight.color];
                    return (
                      <div
                        key={highlight.id}
                        className="p-3 rounded-lg bg-white/50 border border-black/5 group cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleHighlightNavigate(highlight)}
                      >
                        <div
                          className="text-xs mb-2 p-2 rounded"
                          style={{ backgroundColor: colors.bg }}
                        >
                          "{highlight.text}"
                        </div>
                        {highlight.note && (
                          <div className="text-xs text-warm-600 mb-2 pl-2 border-l-2 border-warm-300">
                            {highlight.note}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs opacity-50">
                          <span className="truncate">{highlight.chapter}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHighlight(highlight.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                            title="删除标注"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          </ResizablePanel>
        )}

        {/* 目录面板 */}
        {showToc && (
          <ResizablePanel defaultWidth={256} minWidth={200} maxWidth={400}>
            <aside className="h-full border-r border-black/5 bg-black/5 p-4 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium opacity-70">目录</h3>
                <button onClick={() => setShowToc(false)} className="p-1 hover:opacity-70">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <nav className="space-y-0.5">
                {toc.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTocClick(item)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/5 transition-colors truncate"
                    title={item.label}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>
          </ResizablePanel>
        )}

        {/* 阅读内容区 */}
        <div className="flex-1 min-h-0 flex flex-col">
          {book.format === 'epub' ? (
            <EpubReader
              ref={epubReaderRef}
              book={book}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
              searchQuery={showSearch ? searchQuery : ''}
            />
          ) : book.format === 'pdf' ? (
            <PdfReader
              ref={pdfReaderRef}
              book={book}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
              searchQuery={showSearch ? searchQuery : ''}
            />
          ) : book.format === 'mobi' ? (
            <MobiReader
              ref={mobiReaderRef}
              book={book}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              theme={theme}
              onLocationChange={handleLocationChange}
              onTocLoaded={handleTocLoaded}
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
              searchQuery={showSearch ? searchQuery : ''}
            />
          ) : (
            <TxtReader
              ref={txtReaderRef}
              book={book}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              theme={theme}
              onLocationChange={wrappedHandleLocationChange}
              onTocLoaded={handleTocLoaded}
              highlights={highlights}
              onTextSelected={handleTextSelected}
              onHighlightClick={handleHighlightClick}
              searchQuery={showSearch ? searchQuery : ''}
              isEditMode={isEditMode}
              textAlignment={textAlignment}
              paragraphSpacing={paragraphSpacing}
            />
          )}
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <aside className="w-72 border-l border-black/5 bg-black/5 p-5 overflow-auto flex-shrink-0 animate-slide-in-right">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium opacity-70">阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 字体选择 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 block">字体</label>
              <div className="grid grid-cols-2 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => setFontFamily(font.value)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                      fontFamily === font.value
                        ? 'border-warm-400 bg-warm-400/10'
                        : 'border-black/10 hover:border-black/20'
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 字号 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 flex items-center justify-between">
                <span>字号</span>
                <span className="tabular-nums">{fontSize}px</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs">A</span>
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 accent-warm-400"
                />
                <span className="text-lg">A</span>
              </div>
            </div>

            {/* 行距 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 flex items-center justify-between">
                <span>行距</span>
                <span className="tabular-nums">{lineHeight.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="w-full accent-warm-400"
              />
            </div>

            {/* 段落间距 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 flex items-center justify-between">
                <span>段间距</span>
                <span className="tabular-nums">{paragraphSpacing.toFixed(1)}em</span>
              </label>
              <input
                type="range"
                min={0}
                max={3.0}
                step={0.1}
                value={paragraphSpacing}
                onChange={(e) => setParagraphSpacing(Number(e.target.value))}
                className="w-full accent-warm-400"
              />
            </div>

            {/* 文本对齐 */}
            <div className="mb-5">
              <label className="text-xs opacity-50 mb-2 block">文本对齐</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '左对齐', value: 'left' as const },
                  { label: '居中', value: 'center' as const },
                  { label: '右对齐', value: 'right' as const },
                  { label: '两端', value: 'justify' as const },
                ].map((align) => (
                  <button
                    key={align.value}
                    onClick={() => setTextAlignment(align.value)}
                    className={`px-2 py-2 text-xs rounded-lg border transition-all ${
                      textAlignment === align.value
                        ? 'border-warm-400 bg-warm-400/10'
                        : 'border-black/10 hover:border-black/20'
                    }`}
                  >
                    {align.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 主题 */}
            <div>
              <label className="text-xs opacity-50 mb-2 block">主题</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '白色', value: 'light' as const, bg: '#FAF8F5', border: '#E8DFD4' },
                  { label: '夜间', value: 'dark' as const, bg: '#1A1A1A', border: '#3A3A3A' },
                  { label: '护眼', value: 'green' as const, bg: '#E8F0E4', border: '#C8D8C4' },
                  { label: '牛皮', value: 'sepia' as const, bg: '#F5F0EA', border: '#D4C5B3' },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                      theme === t.value ? 'ring-2 ring-warm-400' : ''
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border"
                      style={{ backgroundColor: t.bg, borderColor: t.border }}
                    />
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* 底部进度栏 */}
      <footer className="h-12 flex items-center px-6 bg-black/5 border-t border-black/5 flex-shrink-0">
        {isEditMode ? (
          // 编辑模式：显示保存/取消按钮
          <div className="flex items-center gap-3 flex-1 justify-center">
            <span className="text-xs text-amber-600">编辑模式</span>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-1.5 text-xs text-warm-600 bg-white/50 hover:bg-white/80 border border-black/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-1.5 text-xs text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
            >
              保存修改
            </button>
          </div>
        ) : (
          // 正常模式：显示进度条
          <div className="flex items-center gap-4 flex-1">
            <span className="text-xs opacity-50 tabular-nums w-12">{Math.round(currentProgress)}%</span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={100}
                value={currentProgress}
                onMouseDown={handleProgressMouseDown}
                onInput={handleProgressInput}
                onChange={handleProgressChange}
                className="flex-1 accent-warm-400 cursor-pointer"
              />
            </div>
            <span className="text-xs opacity-50 tabular-nums w-12 text-right">
              {currentChapterName ? currentChapterName.slice(0, 8) : ''}
            </span>
          </div>
        )}
      </footer>

      {/* 选中文本工具栏 */}
      <SelectionToolbar
        visible={selectionToolbar !== null}
        selectedText={selectionToolbar?.text || ''}
        initialPosition={selectionToolbar?.position}
        onHighlight={handleHighlight}
        onAddNote={handleAddNote}
        onClose={() => setSelectionToolbar(null)}
        isEditMode={isEditMode}
        onFormatCommand={isEditMode ? handleFormatCommand : undefined}
        onParagraphAlign={isEditMode ? handleParagraphAlign : undefined}
      />

      {/* 高亮详情弹窗 */}
      {highlightPopover && (
        <div
          ref={popoverRef}
          className="note-popover fixed z-50 bg-white rounded-xl shadow-2xl border border-black/10 w-72 overflow-hidden"
          style={{
            left: `${highlightPopover.position.x}px`,
            top: `${highlightPopover.position.y}px`,
          }}
        >
          <div
            className="h-1"
            style={{ backgroundColor: highlightColorMap[highlightPopover.highlight.color].border }}
          />
          <div className="p-4 space-y-3">
            <div
              className="text-sm text-warm-700 rounded-lg p-3 max-h-20 overflow-auto leading-relaxed border-l-3"
              style={{
                backgroundColor: highlightColorMap[highlightPopover.highlight.color].bg,
                borderLeftColor: highlightColorMap[highlightPopover.highlight.color].border,
              }}
            >
              "{highlightPopover.highlight.text}"
            </div>

            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                  placeholder="输入批注内容..."
                  className="w-full text-sm border border-black/10 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-warm-400/50"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingNote(false);
                      setEditNoteText(highlightPopover.highlight.note || '');
                    }}
                    className="flex-1 px-2 py-1.5 text-xs text-warm-500 hover:bg-black/5 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="flex-1 px-2 py-1.5 text-xs text-white bg-warm-400 hover:bg-warm-500 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    保存
                  </button>
                </div>
              </div>
            ) : highlightPopover.highlight.note ? (
              <div className="text-sm text-warm-600 pl-3 border-l-2 border-warm-300 leading-relaxed">
                {highlightPopover.highlight.note}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1 border-t border-black/5">
              <span className="text-xs text-warm-400 truncate mr-2">
                {highlightPopover.highlight.chapter}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingNote(true);
                    setEditNoteText(highlightPopover.highlight.note || '');
                  }}
                  className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                  title={highlightPopover.highlight.note ? '编辑批注' : '添加批注'}
                >
                  <Pencil className="w-3.5 h-3.5 text-warm-400" />
                </button>
                <button
                  onClick={handleDeleteFromPopover}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除标注"
                >
                  <Trash2 className="w-3.5 h-3.5 text-warm-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 快捷键帮助弹窗 */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl border border-black/10 w-[480px] max-h-[80vh] overflow-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-warm-400" />
                <h3 className="font-medium text-warm-800">快捷键</h3>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="p-1 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* 阅读器快捷键 */}
              <div>
                <h4 className="text-xs font-medium text-warm-600 mb-3">阅读器</h4>
                <div className="space-y-2">
                  {SHORTCUTS.filter((s) => s.category === 'reader').map((shortcut, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1">
                      <span className="text-sm text-warm-500">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.ctrl && <kbd className="px-1.5 py-0.5 text-xs font-mono bg-warm-100 border border-warm-200 rounded text-warm-600">Ctrl</kbd>}
                        {shortcut.shift && <kbd className="px-1.5 py-0.5 text-xs font-mono bg-warm-100 border border-warm-200 rounded text-warm-600">Shift</kbd>}
                        {shortcut.alt && <kbd className="px-1.5 py-0.5 text-xs font-mono bg-warm-100 border border-warm-200 rounded text-warm-600">Alt</kbd>}
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-warm-100 border border-warm-200 rounded text-warm-600">
                          {shortcut.key === ' ' ? 'Space' : shortcut.key}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 通用快捷键 */}
              <div>
                <h4 className="text-xs font-medium text-warm-600 mb-3">通用</h4>
                <div className="space-y-2">
                  {SHORTCUTS.filter((s) => s.category === 'general').map((shortcut, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1">
                      <span className="text-sm text-warm-500">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.shift && <kbd className="px-1.5 py-0.5 text-xs font-mono bg-warm-100 border border-warm-200 rounded text-warm-600">Shift</kbd>}
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-warm-100 border border-warm-200 rounded text-warm-600">
                          {shortcut.key}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg text-sm text-white transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
