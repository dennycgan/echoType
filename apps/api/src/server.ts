import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { prisma } from './prisma.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerSessionRoutes } from './routes/sessions.js';

const PORT = Number(process.env.API_PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const DEMO_USER_ID = process.env.DEMO_USER_ID ?? 'demo-user';

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  },
  genReqId: () => crypto.randomUUID(),
});

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

app.addHook('onRequest', async (req) => {
  // Walking-skeleton auth: pin every request to the seeded demo user.
  // Will be replaced by Cognito JWT verification when we move to the cloud stage.
  req.userId = DEMO_USER_ID;
});

app.setErrorHandler((error: Error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'validation_error', issues: error.issues });
  }
  app.log.error(error);
  return reply.status(500).send({ error: 'internal_error', message: error.message });
});

await app.register(cors, { origin: WEB_ORIGIN, credentials: true });

// All application routes live under /api so a single CloudFront behavior
// (/api/*) can route here while everything else serves the static SPA.
//   - Public (through CloudFront): https://<dist>.cloudfront.net/api/health
//   - Direct on the instance (via SSM session): curl http://localhost/api/health
await app.register(
  async (api) => {
    api.get('/health', async () => ({ ok: true, demoUser: DEMO_USER_ID }));
    await registerCourseRoutes(api);
    await registerCategoryRoutes(api);
    await registerSessionRoutes(api);
  },
  { prefix: '/api' },
);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
