import { BookOpen, Settings, ChevronLeft, ChevronRight, Compass, LogIn, LogOut, BarChart3 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useBookStore } from '@/stores/bookStore';

const navItems = [
  { icon: BookOpen, label: '书架', path: '/' },
  { icon: Compass, label: '发现', path: '/discover' },
  { icon: BarChart3, label: '统计', path: '/stats' },
  { icon: Settings, label: '设置', path: '/settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const loadBooks = useBookStore((s) => s.loadBooks);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    loadBooks();
    navigate('/');
  };

  return (
    <aside
      className={`h-full flex flex-col theme-transition transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
        borderRightWidth: '1px',
        borderRightStyle: 'solid',
      }}
    >
      {/* Logo 区域 */}
      <div className="flex items-center gap-3 px-4 h-16"
        style={{ borderBottom: '1px solid var(--theme-border)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--theme-accent)' }}
        >
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-serif text-lg font-semibold whitespace-nowrap"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            墨卷
          </span>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
              style={{
                backgroundColor: active ? 'var(--theme-accent)' : 'transparent',
                color: active ? '#FFFFFF' : 'var(--theme-text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'var(--theme-bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* 用户信息区 */}
      <div className="px-2 pb-2"
        style={{ borderTop: '1px solid var(--theme-border)' }}
      >
        {isAuthenticated && user ? (
          <div className={`flex items-center gap-2 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            {/* 头像 */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            >
              <span className="text-xs text-white font-medium">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--theme-text-tertiary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--theme-bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--theme-text-tertiary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-bg-tertiary)';
              e.currentTarget.style.color = 'var(--theme-text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--theme-text-tertiary)';
            }}
          >
            <LogIn className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>登录</span>}
          </button>
        )}
      </div>

      {/* 折叠按钮 */}
      <div className="p-2" style={{ borderTop: '1px solid var(--theme-border)' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg transition-colors"
          style={{ color: 'var(--theme-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
