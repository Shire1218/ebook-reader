import { create } from 'zustand';
import type { ReadingPreference, ThemeType, ViewMode, TextAlignment } from '@/types';

const STORAGE_KEY = 'reading-preferences';

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

// 从 localStorage 读取偏好
function loadFromStorage(): ReadingPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch {
    // 解析失败使用默认值
  }
  return defaultPreferences;
}

// 保存到 localStorage
function saveToStorage(prefs: ReadingPreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

interface PreferenceState extends ReadingPreference {
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setTheme: (theme: ThemeType) => void;
  setBrightness: (brightness: number) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setTextAlignment: (alignment: TextAlignment) => void;
  setParagraphSpacing: (spacing: number) => void;
  resetPreferences: () => void;
}

export const usePreferenceStore = create<PreferenceState>((set) => {
  const initial = loadFromStorage();

  function updateAndSave(partial: Partial<ReadingPreference>) {
    set(partial);
    const current = usePreferenceStore.getState();
    const prefs: ReadingPreference = {
      fontFamily: current.fontFamily,
      fontSize: current.fontSize,
      lineHeight: current.lineHeight,
      theme: current.theme,
      brightness: current.brightness,
      viewMode: current.viewMode,
      textAlignment: current.textAlignment,
      paragraphSpacing: current.paragraphSpacing,
    };
    saveToStorage(prefs);
  }

  return {
    ...initial,

    setFontFamily: (fontFamily) => updateAndSave({ fontFamily }),
    setFontSize: (fontSize) => updateAndSave({ fontSize }),
    setLineHeight: (lineHeight) => updateAndSave({ lineHeight }),
    setTheme: (theme) => updateAndSave({ theme }),
    setBrightness: (brightness) => updateAndSave({ brightness }),
    setViewMode: (viewMode) => updateAndSave({ viewMode }),
    setTextAlignment: (textAlignment) => updateAndSave({ textAlignment }),
    setParagraphSpacing: (paragraphSpacing) => updateAndSave({ paragraphSpacing }),
    resetPreferences: () => {
      saveToStorage(defaultPreferences);
      set(defaultPreferences);
    },
  };
});
