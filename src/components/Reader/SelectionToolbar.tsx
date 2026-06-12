import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquarePlus, X, GripVertical, Copy, Scissors, Clipboard, Trash2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import type { HighlightColor, TextAlignment } from '@/types';

interface SelectionToolbarProps {
  visible: boolean;
  selectedText: string;
  initialPosition?: { x: number; y: number };
  onHighlight: (color: HighlightColor) => void;
  onAddNote: (color: HighlightColor, note: string) => Promise<void>;
  onClose: () => void;
  // 编辑模式相关
  isEditMode?: boolean;
  onFormatCommand?: (command: string, value?: string) => void;
  onParagraphAlign?: (alignment: TextAlignment) => void;
}

// 高亮颜色选项
const colorOptions: { value: HighlightColor; label: string; bg: string; border: string }[] = [
  { value: 'yellow', label: '黄色', bg: '#FEF3C7', border: '#F59E0B' },
  { value: 'green', label: '绿色', bg: '#D1FAE5', border: '#10B981' },
  { value: 'blue', label: '蓝色', bg: '#DBEAFE', border: '#3B82F6' },
  { value: 'pink', label: '粉色', bg: '#FCE7F3', border: '#EC4899' },
  { value: 'purple', label: '紫色', bg: '#EDE9FE', border: '#8B5CF6' },
];

// 工具栏尺寸限制
const MIN_WIDTH = 240;
const MIN_HEIGHT = 160;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 700;
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 500;

export default function SelectionToolbar({
  visible,
  selectedText,
  initialPosition,
  onHighlight,
  onAddNote,
  onClose,
  isEditMode = false,
  onFormatCommand,
  onParagraphAlign,
}: SelectionToolbarProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  // 动态检测当前选中段落的对齐方式
  const [currentAlignment, setCurrentAlignment] = useState<TextAlignment>('left');
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // 拖拽状态
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasInitializedRef = useRef(false);

  // 跟踪批注输入是否打开（用于 mousedown 处理）
  const showNoteInputRef = useRef(false);
  useEffect(() => {
    showNoteInputRef.current = showNoteInput;
  }, [showNoteInput]);

  // 防止面板 mousedown 导致 contentEditable 失焦和选区丢失
  const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
    // 允许输入框正常获取焦点
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
    // 批注输入打开时不阻止，允许点击其他区域关闭输入
    if (showNoteInputRef.current) return;
    e.preventDefault();
  }, []);

  // 缩放状态
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0, y: 0, width: 0, height: 0,
  });

  // 初始化位置
  useEffect(() => {
    if (visible && initialPosition && !hasInitializedRef.current) {
      const { width, height } = panelSize;
      let x = initialPosition.x + 20;
      let y = initialPosition.y - 50;

      if (x + width > window.innerWidth) x = initialPosition.x - width - 20;
      if (y + height > window.innerHeight) y = window.innerHeight - height - 20;
      if (y < 20) y = 20;
      if (x < 20) x = 20;

      setPosition({ x, y });
      hasInitializedRef.current = true;
    }
    if (!visible) {
      hasInitializedRef.current = false;
    }
  }, [visible, initialPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // 拖拽标题栏
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const x = Math.max(0, Math.min(window.innerWidth - panelSize.width, newX));
      const y = Math.max(0, Math.min(window.innerHeight - panelSize.height, newY));
      setPosition({ x, y });
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, panelSize.width, panelSize.height]);

  // 缩放拖拽
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const { x: startX, y: startY, width: startW, height: startH } = resizeStartRef.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (e.clientX - startX)));
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + (e.clientY - startY)));
      setPanelSize({ width: newWidth, height: newHeight });
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      width: panelSize.width, height: panelSize.height,
    };
    setIsResizing(true);
  }, [panelSize]);

  // 自动聚焦
  useEffect(() => {
    if (showNoteInput && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [showNoteInput]);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setShowNoteInput(false);
      setNote('');
      setPanelSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
      // 检测当前选中段落的对齐方式
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node: Node | null = range.startContainer;
        // 向上查找 p 元素
        while (node && node.nodeName !== 'P') {
          node = node.parentNode;
        }
        if (node && node.nodeName === 'P') {
          const align = (node as HTMLElement).style.textAlign || 
                        window.getComputedStyle(node as HTMLElement).textAlign;
          // 将 CSS 对齐值映射为 TextAlignment
          const alignMap: Record<string, TextAlignment> = {
            'left': 'left',
            'start': 'left',
            'center': 'center',
            'right': 'right',
            'end': 'right',
            'justify': 'justify',
          };
          setCurrentAlignment(alignMap[align] || 'left');
        }
      }
    }
  }, [visible, selectedText]);

  // 在光标位置插入文本
  const insertAtCursor = useCallback((text: string) => {
    const textarea = noteInputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = note.substring(0, start);
    const selected = note.substring(start, end);
    const after = note.substring(end);
    const newValue = before + text + selected + after;
    setNote(newValue);
    requestAnimationFrame(() => {
      const newPos = start + text.length + selected.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    });
  }, [note]);

  // 编辑模式操作
  const handleCopy = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText).catch(() => {
        // 回退方案
        const textarea = document.createElement('textarea');
        textarea.value = selectedText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      });
      onClose();
    }
  }, [selectedText, onClose]);

  const handleCut = useCallback(() => {
    if (selectedText && onFormatCommand) {
      navigator.clipboard.writeText(selectedText).catch(() => {});
      onFormatCommand('delete');
      onClose();
    }
  }, [selectedText, onFormatCommand, onClose]);

  const handlePaste = useCallback(async () => {
    if (onFormatCommand) {
      try {
        const text = await navigator.clipboard.readText();
        onFormatCommand('insertText', text);
      } catch {
        // 剪贴板权限不足，忽略
      }
      onClose();
    }
  }, [onFormatCommand, onClose]);

  const handleDelete = useCallback(() => {
    if (onFormatCommand) {
      onFormatCommand('delete');
      onClose();
    }
  }, [onFormatCommand, onClose]);

  // 格式化操作
  const handleBold = useCallback(() => {
    onFormatCommand?.('bold');
    onClose();
  }, [onFormatCommand, onClose]);

  const handleItalic = useCallback(() => {
    onFormatCommand?.('italic');
    onClose();
  }, [onFormatCommand, onClose]);

  const handleUnderline = useCallback(() => {
    onFormatCommand?.('underline');
    onClose();
  }, [onFormatCommand, onClose]);

  // 段落对齐操作
  const handleAlign = useCallback((alignment: TextAlignment) => {
    onParagraphAlign?.(alignment);
    onClose();
  }, [onParagraphAlign, onClose]);

  // 批注模式下的格式按钮
  const formatActions = [
    { icon: '↵', action: () => insertAtCursor('\n'), title: '插入换行' },
    { icon: '⇥', action: () => insertAtCursor('\u3000\u3000'), title: '插入首行缩进' },
    { icon: '—', action: () => insertAtCursor('\n———————\n'), title: '插入分隔线' },
    { icon: '•', action: () => insertAtCursor('\n• '), title: '插入列表项' },
    { icon: '1.', action: () => insertAtCursor('\n1. '), title: '插入序号列表' },
  ];

  if (!visible || !position) return null;

  const handleConfirmNote = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAddNote(selectedColor, note.trim());
      setNote('');
      setShowNoteInput(false);
    } catch (error) {
      console.error('批注提交失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelNote = () => {
    setNote('');
    setShowNoteInput(false);
  };

  // 对齐方式选项
  const alignOptions: { value: TextAlignment; icon: typeof AlignLeft; label: string }[] = [
    { value: 'left', icon: AlignLeft, label: '左对齐' },
    { value: 'center', icon: AlignCenter, label: '居中' },
    { value: 'right', icon: AlignRight, label: '右对齐' },
    { value: 'justify', icon: AlignJustify, label: '两端对齐' },
  ];

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-black/10 overflow-hidden select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${panelSize.width}px`,
        height: `${panelSize.height}px`,
        minWidth: `${MIN_WIDTH}px`,
        minHeight: `${MIN_HEIGHT}px`,
        maxWidth: `${MAX_WIDTH}px`,
        maxHeight: `${MAX_HEIGHT}px`,
      }}
      onMouseDown={handlePanelMouseDown}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-warm-50 border-b border-black/5 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-warm-400" />
          <span className="text-sm font-medium text-warm-600">
            {isEditMode ? '编辑工具' : '标注选中文本'}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded transition-colors">
          <X className="w-4 h-4 text-warm-400" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="overflow-auto" style={{ height: `calc(100% - 48px - 16px)` }}>
        {/* 选中文本预览 */}
        <div className="px-4 py-3 border-b border-black/5">
          <div className="text-sm text-warm-600 bg-warm-50/50 rounded-lg p-3 max-h-24 overflow-auto leading-relaxed">
            {selectedText.length > 150 ? selectedText.slice(0, 150) + '...' : selectedText}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 编辑模式工具栏 */}
          {isEditMode && (
            <>
              {/* 文本操作：复制、剪切、粘贴、删除 */}
              <div>
                <label className="text-xs text-warm-400 mb-1.5 block">文本操作</label>
                <div className="flex items-center gap-1 p-1.5 bg-warm-50 rounded-lg border border-black/5">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-warm-600 hover:bg-white hover:shadow-sm rounded transition-all"
                    title="复制"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制</span>
                  </button>
                  <button
                    onClick={handleCut}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-warm-600 hover:bg-white hover:shadow-sm rounded transition-all"
                    title="剪切"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>剪切</span>
                  </button>
                  <button
                    onClick={handlePaste}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-warm-600 hover:bg-white hover:shadow-sm rounded transition-all"
                    title="粘贴"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>粘贴</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-500 hover:bg-white hover:shadow-sm rounded transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除</span>
                  </button>
                </div>
              </div>

              {/* 文本格式化：加粗、斜体、下划线 */}
              <div>
                <label className="text-xs text-warm-400 mb-1.5 block">文本格式</label>
                <div className="flex items-center gap-1 p-1.5 bg-warm-50 rounded-lg border border-black/5">
                  <button
                    onClick={handleBold}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-warm-600 hover:bg-white hover:shadow-sm rounded transition-all font-bold"
                    title="加粗 (Ctrl+B)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                    <span>加粗</span>
                  </button>
                  <button
                    onClick={handleItalic}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-warm-600 hover:bg-white hover:shadow-sm rounded transition-all italic"
                    title="斜体 (Ctrl+I)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                    <span>斜体</span>
                  </button>
                  <button
                    onClick={handleUnderline}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-warm-600 hover:bg-white hover:shadow-sm rounded transition-all underline"
                    title="下划线 (Ctrl+U)"
                  >
                    <Underline className="w-3.5 h-3.5" />
                    <span>下划线</span>
                  </button>
                </div>
              </div>

              {/* 段落对齐 */}
              <div>
                <label className="text-xs text-warm-400 mb-1.5 block">段落对齐</label>
                <div className="flex items-center gap-1 p-1.5 bg-warm-50 rounded-lg border border-black/5">
                  {alignOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAlign(opt.value)}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-all ${
                          currentAlignment === opt.value
                            ? 'bg-white shadow-sm text-warm-700'
                            : 'text-warm-500 hover:bg-white hover:shadow-sm'
                        }`}
                        title={opt.label}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 非编辑模式或编辑模式下都显示高亮功能 */}
          {!isEditMode && (
            <>
              {/* 统一工具栏：高亮颜色 + 批注入口 + 格式操作 */}
              <div className="flex items-center gap-1 p-1.5 bg-warm-50 rounded-lg border border-black/5 flex-wrap">
                {/* 高亮颜色按钮 */}
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      if (showNoteInput) {
                        setSelectedColor(color.value);
                      } else {
                        onHighlight(color.value);
                        onClose();
                      }
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                      selectedColor === color.value ? 'scale-110 shadow-md' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: color.bg,
                      borderColor: selectedColor === color.value ? color.border : 'transparent',
                    }}
                    title={showNoteInput ? `批注颜色：${color.label}` : `高亮为${color.label}`}
                  />
                ))}

                <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />

                {/* 批注按钮 */}
                <button
                  onClick={() => setShowNoteInput(true)}
                  className={`px-1.5 py-0.5 text-xs rounded transition-all shrink-0 ${
                    showNoteInput ? 'bg-white shadow-sm text-warm-600' : 'text-warm-400 hover:bg-white hover:shadow-sm'
                  }`}
                  title="添加批注"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </button>

                {/* 批注模式下的格式按钮 */}
                {showNoteInput && (
                  <>
                    <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />
                    {formatActions.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={item.action}
                        className="px-1.5 py-0.5 text-xs text-warm-500 hover:bg-white hover:shadow-sm rounded transition-all shrink-0"
                        title={item.title}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}

          {/* 编辑模式下也显示高亮功能 */}
          {isEditMode && (
            <div>
              <label className="text-xs text-warm-400 mb-1.5 block">高亮标注</label>
              <div className="flex items-center gap-1 p-1.5 bg-warm-50 rounded-lg border border-black/5 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      onHighlight(color.value);
                      onClose();
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 opacity-60 hover:opacity-100`}
                    style={{
                      backgroundColor: color.bg,
                      borderColor: 'transparent',
                    }}
                    title={`高亮为${color.label}`}
                  />
                ))}
                <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="px-1.5 py-0.5 text-xs text-warm-400 hover:bg-white hover:shadow-sm rounded transition-all shrink-0"
                  title="添加批注"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 批注输入 */}
          {showNoteInput && (
            <>
              <textarea
                ref={noteInputRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    insertAtCursor('\u3000\u3000');
                  }
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    insertAtCursor('\n');
                  }
                }}
                placeholder="输入批注内容...&#10;提示：Tab 键插入缩进，Ctrl+Enter 换行"
                className="w-full text-sm border border-black/10 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-warm-400/50"
                rows={4}
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelNote}
                  disabled={submitting}
                  className="flex-1 px-3 py-2 text-sm text-warm-500 hover:bg-black/5 rounded-lg transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmNote}
                  disabled={submitting}
                  className="flex-1 px-3 py-2 text-sm text-white bg-warm-400 hover:bg-warm-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '保存中...' : '确认'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 缩放手柄 */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity"
        onMouseDown={handleResizeMouseDown}
        title="拖拽调整大小"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-warm-400">
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="4" cy="8" r="1.2" />
          <circle cx="8" cy="4" r="1.2" />
        </svg>
      </div>
    </div>
  );
}
