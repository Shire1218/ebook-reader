import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBookStore } from '@/stores/bookStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated } = useAuthStore();
  const loadBooks = useBookStore((s) => s.loadBooks);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 覆盖 #root overflow
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.style.overflow = 'auto';
    return () => { if (root) root.style.overflow = ''; };
  }, []);

  // 已登录则跳转
  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }

    try {
      await login(username.trim(), password);
      await loadBooks();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  };

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-warm-400 mb-4">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-warm-800">登录墨卷</h1>
          <p className="text-sm text-warm-500 mt-1">登录后享受云端书籍同步</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400 transition-colors"
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400 transition-colors"
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-warm-400 text-white text-sm font-medium hover:bg-warm-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {isLoading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-warm-500">
            还没有账号？
            <Link to="/register" className="text-warm-600 hover:text-warm-700 font-medium ml-1">
              立即注册
            </Link>
          </p>
        </form>

        {/* 本地模式入口 */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-warm-400 hover:text-warm-600 transition-colors"
          >
            使用本地模式（不登录）
          </button>
        </div>
      </div>
    </div>
  );
}
