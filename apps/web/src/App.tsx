import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CourseListPage } from './pages/CourseListPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { TypingPage } from './pages/TypingPage';

export function App() {
  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            EchoType
          </Link>
          <Link to="/courses/short" className="text-sm text-slate-600 hover:text-slate-900">
            Short
          </Link>
          <Link to="/courses/article" className="text-sm text-slate-600 hover:text-slate-900">
            Article
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<Navigate to="/" replace />} />
          <Route path="/courses/short/collections/:collectionId" element={<CollectionDetailPage courseMode="SHORT" />} />
          <Route path="/courses/article/collections/:collectionId" element={<CollectionDetailPage courseMode="ARTICLE" />} />
          <Route path="/courses/short" element={<CourseListPage courseMode="SHORT" />} />
          <Route path="/courses/article" element={<CourseListPage courseMode="ARTICLE" />} />
          <Route path="/courses/:id/type" element={<TypingPage />} />
        </Routes>
      </main>
    </div>
  );
}
