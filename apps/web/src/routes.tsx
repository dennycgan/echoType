import { Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { GuestOnly } from './auth/GuestOnly';
import { HomePage } from './pages/HomePage';
import { CourseListPage } from './pages/CourseListPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { TypingPage } from './pages/TypingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';

export const router = [
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestOnly>
        <RegisterPage />
      </GuestOnly>
    ),
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />,
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/courses', element: <Navigate to="/" replace /> },
      {
        path: '/courses/short/collections/:collectionId',
        element: <CollectionDetailPage courseMode="SHORT" />,
      },
      {
        path: '/courses/article/collections/:collectionId',
        element: <CollectionDetailPage courseMode="ARTICLE" />,
      },
      { path: '/courses/short', element: <CourseListPage courseMode="SHORT" /> },
      { path: '/courses/article', element: <CourseListPage courseMode="ARTICLE" /> },
      { path: '/courses/:id/type', element: <TypingPage /> },
    ],
  },
];
