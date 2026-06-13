import type { ApiResponse } from '@/types';

const TOKENS_KEY = 'auth-tokens';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

function getTokens(): Tokens | null {
  try {
    const stored = localStorage.getItem(TOKENS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

function saveTokens(tokens: Tokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKENS_KEY);
}

export function getAccessToken(): string | null {
  return getTokens()?.accessToken ?? null;
}

// 刷新 token
async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) return null;

    const json: ApiResponse<{ accessToken: string; refreshToken: string }> = await res.json();
    if (!json.success || !json.data) return null;

    const newTokens = {
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
    };
    saveTokens(newTokens);
    return newTokens.accessToken;
  } catch {
    return null;
  }
}

// 核心请求函数
async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(url, {
    method,
    headers,
    body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
  });

  // 401 时尝试刷新 token 并重试
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method,
        headers,
        body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
      });
    }
    if (res.status === 401) {
      clearTokens();
      throw new Error('认证已过期，请重新登录');
    }
  }

  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || '请求失败');
  }
  return json.data as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>('GET', url);
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return request<T>('POST', url, body);
}

export function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return request<T>('PUT', url, body);
}

export function apiDelete<T>(url: string): Promise<T> {
  return request<T>('DELETE', url);
}

export function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  return request<T>('POST', url, formData, true);
}
