import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/Layout/AppLayout';
import Library from '@/pages/Library';
import Reader from '@/pages/Reader';
import Settings from '@/pages/Settings';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Discover from '@/pages/Discover';
import Stats from '@/pages/Stats';
import AnnualReport from '@/pages/AnnualReport';
import { useAuthStore } from '@/stores/authStore';

function AppRoutes() {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Routes>
      {/* 独立页面（不使用 AppLayout） */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/annual-report/:year" element={<AnnualReport />} />

      {/* 应用主路由 */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Library />} />
        <Route path="/reader/:bookId" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/stats" element={<Stats />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
