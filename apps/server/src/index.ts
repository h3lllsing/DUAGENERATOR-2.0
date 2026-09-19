import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { initDb, closeDb } from './db.js';
import { authGuard } from './auth.js';
import duasRoutes from './routes/duas.js';
import videosRoutes from './routes/videos.js';
import { startRenderWorker } from './workers/render-worker.js';

const PORT = parseInt(process.env.PORT || '7870');
const HOST = process.env.HOST || '127.0.0.1';

async function main() {
  initDb();
  console.log('[Server] Database initialized');

  const app = Fastify({ logger: { level: 'info' } });

  await app.register(websocket);
  await app.register(cors, { origin: ['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT] });
  await app.register(rateLimit, { max: 30, timeWindow: 2000 });

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/') && !request.url.includes('health')) {
      await authGuard(request, reply);
    }
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
  });

  await app.register(duasRoutes);
  await app.register(videosRoutes);

  app.get('/api/v1/health', async () => ({ ok: true, version: '2.0.0' }));

  startRenderWorker();

  await app.listen({ port: PORT, host: HOST });
  console.log('[Server] V2 running on http://' + HOST + ':' + PORT);

  const shutdown = async () => { await app.close(); closeDb(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => { console.error('[Server] Fatal:', err); process.exit(1); });
