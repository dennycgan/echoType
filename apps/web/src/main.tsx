import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { assertCognitoConfig } from './auth/cognitoConfig';
import { disableBrowserScrollRestoration } from './lib/routeScroll';
import { router } from './routes';
import './styles.css';

assertCognitoConfig();
disableBrowserScrollRestoration();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const browserRouter = createBrowserRouter(router);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={browserRouter} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
