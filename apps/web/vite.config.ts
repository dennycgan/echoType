import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryRelease = process.env.SENTRY_RELEASE;

export default defineConfig({
  plugins: [
    react(),
    ...(sentryAuthToken && sentryRelease
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG ?? 'echotype',
            project: 'echotype-web',
            authToken: sentryAuthToken,
            release: { name: sentryRelease },
            sourcemaps: {
              filesToDeleteAfterUpload: ['**/*.map'],
            },
          }),
        ]
      : []),
  ],
  // amazon-cognito-identity-js pulls in `buffer`, which expects Node's `global`.
  define: {
    global: 'globalThis',
  },
  build: {
    sourcemap: Boolean(sentryAuthToken && sentryRelease),
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
