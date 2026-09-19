import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, closeDb } from './db.js';
import { authGuard } from './auth.js';
import duasRoutes from './routes/duas.js';
import videosRoutes from './routes/videos.js';
import thumbnailsRoutes from './routes/thumbnails.js';
import captionsRoutes from './routes/captions.js';
import seoRoutes from './routes/seo.js';
import reviewRoutes from './routes/review.js';
import schedulesRoutes from './routes/schedules.js';
import analyticsRoutes from './routes/analytics.js';
import playlistsRoutes from './routes/playlists.js';
import topicsRoutes from './routes/topics.js';
import sharekitRoutes from './routes/sharekit.js';
import { startRenderWorker } from './workers/render-worker.js';
import { startPublishWorker } from './workers/publish-worker.js';

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
  await app.register(thumbnailsRoutes);
  await app.register(captionsRoutes);
  await app.register(seoRoutes);
  await app.register(reviewRoutes);
  await app.register(schedulesRoutes);
  await app.register(analyticsRoutes);
  await app.register(playlistsRoutes);
  await app.register(topicsRoutes);
  await app.register(sharekitRoutes);

  app.get('/api/v1/health', async () => ({ ok: true, version: '2.0.0' }));

  const distDir = path.resolve(process.cwd(), 'apps', 'web', 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    await app.register(staticPlugin, { root: distDir, wildcard: false });
    app.setNotFoundHandler(async (_request, reply) => {
      const url = _request.url;
      if (url.startsWith('/api/') || url.startsWith('/ws')) {
        return reply.code(404).send({ message: 'Route ' + url + ' not found', error: 'Not Found', statusCode: 404 });
      }
      if (url !== '/' && !/(\.(js|css|svg|png|ico|woff2?|json|map))$/.test(url)) {
        return reply.type('text/html').send(fs.readFileSync(path.join(distDir, 'index.html')));
      }
      return reply.code(404).send({ message: 'Route ' + url + ' not found', error: 'Not Found', statusCode: 404 });
    });
    console.log('[Server] Serving web UI from ' + distDir);
  } else {
    console.log('[Server] Web dist not found at ' + distDir + ' — API only');
  }

  startRenderWorker();
  startPublishWorker();

  await app.listen({ port: PORT, host: HOST });
  console.log('[Server] V2 running on http://' + HOST + ':' + PORT);

  const shutdown = async () => { await app.close(); closeDb(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => { console.error('[Server] Fatal:', err); process.exit(1); });
