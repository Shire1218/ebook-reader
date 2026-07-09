import { create } from 'zustand';
import type { User, AuthResponse } from '@/types';
import { apiPost, clearTokens, getAccessToken } from '@/utils/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => void;
}

const TOKENS_KEY = 'auth-tokens';

function loadTokens(): { accessToken: string; refreshToken: string } | null {
  try {
    const stored = localStorage.getItem(TOKENS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

function loadUser(): User | null {
  try {
    const stored = localStorage.getItem('auth-user');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

function saveUser(user: User) {
  localStorage.setItem('auth-user', JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem('auth-user');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const data = await apiPost<AuthResponse>('/api/auth/login', { username, password });
      localStorage.setItem(TOKENS_KEY, JSON.stringify({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));
      saveUser(data.user);
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (username: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      const data = await apiPost<AuthResponse>('/api/auth/register', { username, email, password });
      localStorage.setItem(TOKENS_KEY, JSON.stringify({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));
      saveUser(data.user);
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    clearTokens();
    clearUser();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  initAuth: () => {
    const tokens = loadTokens();
    const user = loadUser();
    const token = getAccessToken();
    if (tokens && user && token) {
      set({
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isAuthenticated: true,
      });
    }
  },
}));
