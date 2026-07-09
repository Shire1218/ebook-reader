import { create } from 'zustand';
import type { ReadingPreference, ThemeType, ViewMode, TextAlignment } from '@/types';

const STORAGE_KEY = 'reading-preferences';
const PER_BOOK_KEY = 'reading-preferences-per-book';

// 默认偏好
const defaultPreferences: ReadingPreference = {
  fontFamily: 'system-ui',
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'light',
  brightness: 100,
  viewMode: 'grid',
  textAlignment: 'justify',
  paragraphSpacing: 0.8,
};

// 从 localStorage 读取全局偏好
function loadGlobal(): ReadingPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch {
    // 解析失败使用默认值
  }
  return { ...defaultPreferences };
}

// 保存全局偏好到 localStorage
function saveGlobal(prefs: ReadingPreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// 从 localStorage 读取每本书的偏好覆盖
function loadPerBook(): Record<string, Partial<ReadingPreference>> {
  try {
    const stored = localStorage.getItem(PER_BOOK_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // 解析失败使用空对象
  }
  return {};
}

// 保存每本书的偏好覆盖到 localStorage
function savePerBook(perBook: Record<string, Partial<ReadingPreference>>): void {
  localStorage.setItem(PER_BOOK_KEY, JSON.stringify(perBook));
}

// 计算有效偏好：全局默认 + 当前书籍覆盖
function effective(global: ReadingPreference, perBook: Record<string, Partial<ReadingPreference>>, bookId: string | null): ReadingPreference {
  if (bookId && perBook[bookId]) {
    return { ...global, ...perBook[bookId] };
  }
  return global;
}

// 闭包变量：保存全局偏好和每本书的偏好覆盖（不暴露在 Zustand state 中）
let globalPrefs = loadGlobal();
let perBookPrefs = loadPerBook();
let currentBookId: string | null = null;

interface PreferenceState extends ReadingPreference {
  setCurrentBookId: (bookId: string | null) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setTheme: (theme: ThemeType) => void;
  setBrightness: (brightness: number) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setTextAlignment: (alignment: TextAlignment) => void;
  setParagraphSpacing: (spacing: number) => void;
  resetPreferences: () => void;
  resetBookPreferences: (bookId: string) => void;
}

export const usePreferenceStore = create<PreferenceState>((set, get) => {
  // 初始有效偏好
  const initial = effective(globalPrefs, perBookPrefs, null);

  return {
    ...initial,

    // 设置当前阅读的书籍 ID，进入阅读器时调用
    setCurrentBookId: (bookId: string | null) => {
      currentBookId = bookId;
      const eff = effective(globalPrefs, perBookPrefs, bookId);
      set(eff);
    },

    setFontFamily: (v) => update(set, get, { fontFamily: v }),
    setFontSize: (v) => update(set, get, { fontSize: v }),
    setLineHeight: (v) => update(set, get, { lineHeight: v }),
    setTheme: (v) => update(set, get, { theme: v }),
    setBrightness: (v) => update(set, get, { brightness: v }),
    setViewMode: (v) => update(set, get, { viewMode: v }),
    setTextAlignment: (v) => update(set, get, { textAlignment: v }),
    setParagraphSpacing: (v) => update(set, get, { paragraphSpacing: v }),

    // 重置全局偏好
    resetPreferences: () => {
      globalPrefs = { ...defaultPreferences };
      saveGlobal(globalPrefs);
      const eff = effective(globalPrefs, perBookPrefs, currentBookId);
      set(eff);
    },

    // 重置指定书籍的偏好覆盖，回退到全局默认
    resetBookPreferences: (bookId: string) => {
      delete perBookPrefs[bookId];
      savePerBook(perBookPrefs);
      if (currentBookId === bookId) {
        set({ ...globalPrefs });
      }
    },
  };
});

// 内部辅助函数：根据是否有 currentBookId 决定写入全局还是写入书籍覆盖
function update(
  set: (partial: Partial<PreferenceState>) => void,
  get: () => PreferenceState,
  partial: Partial<ReadingPreference>
) {
  // 更新 state 中的显示值
  set(partial);

  if (currentBookId) {
    // 有当前书籍 → 写入该书的覆盖设置
    perBookPrefs[currentBookId] = { ...perBookPrefs[currentBookId], ...partial };
    savePerBook(perBookPrefs);
  } else {
    // 无当前书籍（设置页面）→ 写入全局设置
    const state = get();
    globalPrefs = {
      fontFamily: state.fontFamily,
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      theme: state.theme,
      brightness: state.brightness,
      viewMode: state.viewMode,
      textAlignment: state.textAlignment,
      paragraphSpacing: state.paragraphSpacing,
    };
    saveGlobal(globalPrefs);
  }
}
