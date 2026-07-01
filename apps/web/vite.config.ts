import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js pulls in `buffer`, which expects Node's `global`.
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    proxy: {
      // Backend serves routes under /api, so forward the prefix as-is
      // (matches the CloudFront /api/* behavior in production).
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
