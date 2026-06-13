import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBookStore } from '@/stores/bookStore';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, isAuthenticated } = useAuthStore();
  const loadBooks = useBookStore((s) => s.loadBooks);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (!username.trim() || !email.trim() || !password) {
      setError('请填写所有字段');
      return;
    }

    if (password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      await register(username.trim(), email.trim(), password);
      await loadBooks();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
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
          <h1 className="text-2xl font-serif font-semibold text-warm-800">注册墨卷</h1>
          <p className="text-sm text-warm-500 mt-1">创建账号，开始云端阅读之旅</p>
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
            <label className="block text-sm font-medium text-warm-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400 transition-colors"
              placeholder="请输入邮箱"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400 transition-colors"
              placeholder="至少6位密码"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-warm-400/30 focus:border-warm-400 transition-colors"
              placeholder="再次输入密码"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-warm-400 text-white text-sm font-medium hover:bg-warm-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {isLoading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-warm-500">
            已有账号？
            <Link to="/login" className="text-warm-600 hover:text-warm-700 font-medium ml-1">
              立即登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
