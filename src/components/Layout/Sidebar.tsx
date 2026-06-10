import { BookOpen, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { icon: BookOpen, label: '书架', path: '/' },
  { icon: Settings, label: '设置', path: '/settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <aside
      className={`h-full flex flex-col bg-warm-100 border-r border-warm-200 theme-transition transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo 区域 */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-warm-200">
        <div className="w-8 h-8 rounded-lg bg-warm-400 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-serif text-lg font-semibold text-warm-800 whitespace-nowrap">
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                active
                  ? 'bg-warm-400 text-white shadow-sm'
                  : 'text-warm-700 hover:bg-warm-200'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* 折叠按钮 */}
      <div className="p-2 border-t border-warm-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-warm-600 hover:bg-warm-200 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
