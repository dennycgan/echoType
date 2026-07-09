import type { FastifyInstance } from 'fastify';

export async function registerDebugRoutes(api: FastifyInstance) {
  if (process.env.SENTRY_DEBUG !== '1') return;

  api.get('/debug/sentry', async () => {
    throw new Error('EchoType Sentry API probe');
  });
}
