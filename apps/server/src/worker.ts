import { initDb, closeDb } from './db.js';
import { startRenderWorker } from './workers/render-worker.js';
import { startPublishWorker } from './workers/publish-worker.js';

function main(): void {
  initDb();
  console.log('[Worker] Database initialized');
  startRenderWorker();
  startPublishWorker();

  const shutdown = () => { closeDb(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  main();
} catch (err: any) {
  console.error('[Worker] Fatal:', err.message || err);
  process.exit(1);
}