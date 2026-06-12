import { useEffect, useCallback, useState } from 'react';

// 快捷键定义
export interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'reader' | 'general';
}

// 内置快捷键列表
export const SHORTCUTS: ShortcutDef[] = [
  // 阅读器通用
  { key: 'ArrowLeft', description: '上一页 / 上一章', category: 'reader' },
  { key: 'ArrowRight', description: '下一页 / 下一章', category: 'reader' },
  { key: 'PageUp', description: '向上翻屏', category: 'reader' },
  { key: 'PageDown', description: '向下翻屏', category: 'reader' },
  { key: ' ', description: '向下翻屏（TXT）', category: 'reader' },
  { key: 'ArrowUp', description: '向上滚动（TXT）', category: 'reader' },
  { key: 'ArrowDown', description: '向下滚动（TXT）', category: 'reader' },
  // 面板控制
  { key: 't', description: '切换目录面板', category: 'reader' },
  { key: 'b', description: '切换书签/添加书签', category: 'reader' },
  { key: 'n', description: '切换标注笔记面板', category: 'reader' },
  { key: 's', description: '切换设置面板', category: 'reader' },
  { key: 'f', ctrl: true, description: '全文搜索', category: 'reader' },
  { key: 'Escape', description: '关闭当前面板', category: 'reader' },
  { key: '?', shift: true, description: '显示快捷键帮助', category: 'general' },
  // PDF 专属
  { key: '=', alt: true, description: '放大（PDF）', category: 'reader' },
  { key: '-', alt: true, description: '缩小（PDF）', category: 'reader' },
  { key: '0', alt: true, description: '重置缩放（PDF）', category: 'reader' },
];

interface UseKeyboardShortcutsOptions {
  // 阅读器页面回调
  onToggleToc?: () => void;
  onToggleBookmarks?: () => void;
  onToggleBookmark?: () => void;
  onToggleNotes?: () => void;
  onToggleSettings?: () => void;
  onToggleSearch?: () => void;
  onCloseAllPanels?: () => void;
  // 是否处于输入状态（输入框聚焦时不触发快捷键）
  isInputFocused?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isInputActive = useCallback(() => {
    if (options.isInputFocused) return true;
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
  }, [options.isInputFocused]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + ? 或 Shift + ? 显示快捷键帮助
      if ((e.key === '?' || (e.shiftKey && e.key === '?')) && !isInputActive()) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Escape 关闭快捷键弹窗或面板
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        options.onCloseAllPanels?.();
        return;
      }

      // 输入框激活时不处理其他快捷键
      if (isInputActive()) return;

      // Ctrl+F 全文搜索
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        options.onToggleSearch?.();
        return;
      }

      // 以下快捷键仅在阅读器页面生效（有回调函数时）
      // T - 目录
      if (e.key === 't' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        options.onToggleToc?.();
        return;
      }
      // B - 书签
      if (e.key === 'b' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        options.onToggleBookmarks?.();
        return;
      }
      // N - 标注
      if (e.key === 'n' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        options.onToggleNotes?.();
        return;
      }
      // S - 设置
      if (e.key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        options.onToggleSettings?.();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, isInputActive, showShortcuts]);

  return { showShortcuts, setShowShortcuts };
}
