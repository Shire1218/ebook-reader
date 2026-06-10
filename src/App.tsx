import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/Layout/AppLayout';
import Library from '@/pages/Library';
import Reader from '@/pages/Reader';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Library />} />
          <Route path="/reader/:bookId" element={<Reader />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
