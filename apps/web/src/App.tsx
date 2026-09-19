import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DuaListPage from './pages/DuaListPage';
import DuaDetailPage from './pages/DuaDetailPage';
import ThumbnailStudioPage from './pages/ThumbnailStudioPage';
import CaptionsEditorPage from './pages/CaptionsEditorPage';
import SeoManagerPage from './pages/SeoManagerPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import TokenSetup from './components/TokenSetup';
import { getToken } from './api/client';
import './App.css';

function App() {
  const [hasToken, setHasToken] = useState(!!getToken());

  if (!hasToken) {
    return <TokenSetup onDone={() => setHasToken(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="sidebar">
          <div className="sidebar-brand">DuaStudio V2</div>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/duas">Duas</NavLink>
          <NavLink to="/review">Review Queue</NavLink>
          <div className="sidebar-divider" />
          <span className="sidebar-label">Content Studio</span>
          <NavLink to="/studio/thumbnails">Thumbnails</NavLink>
          <NavLink to="/studio/captions">Captions</NavLink>
          <NavLink to="/studio/seo">SEO</NavLink>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/duas" element={<DuaListPage />} />
            <Route path="/duas/:id" element={<DuaDetailPage />} />
            <Route path="/studio/thumbnails" element={<ThumbnailStudioPage />} />
            <Route path="/studio/thumbnails/:videoId" element={<ThumbnailStudioPage />} />
            <Route path="/studio/captions" element={<CaptionsEditorPage />} />
            <Route path="/studio/captions/:videoId" element={<CaptionsEditorPage />} />
            <Route path="/studio/seo" element={<SeoManagerPage />} />
            <Route path="/studio/seo/:videoId" element={<SeoManagerPage />} />
            <Route path="/review" element={<ReviewQueuePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
