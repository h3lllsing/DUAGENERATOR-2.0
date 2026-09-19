import { getDb, selectOne } from '../db.js';
import { runPublishCheck } from '../growth/scheduler.js';
import { appendAlert } from '../alerts.js';

const WORKER_ID = 'publish-' + process.pid;
const DEFAULT_INTERVAL_MS = 15000;
let running = true;
let timer: ReturnType<typeof setTimeout> | null = null;

export function startPublishWorker(): void {
  console.log('[' + WORKER_ID + '] Starting publish worker');
  process.on('SIGINT', () => { running = false; if (timer) clearTimeout(timer); });
  process.on('SIGTERM', () => { running = false; if (timer) clearTimeout(timer); });
  schedule();
}

function schedule(): void {
  if (!running) return;
  const interval = readIntervalSec();
  timer = setTimeout(runOnce, interval >= 1 ? interval * 1000 : DEFAULT_INTERVAL_MS);
}

function readIntervalSec(): number {
  const row = selectOne('SELECT value FROM settings WHERE key = ?', ['publish_interval_sec']) as any;
  const n = parseInt(row?.value || '15', 10);
  return isNaN(n) ? 15 : n;
}

function runOnce(): void {
  try {
    const result = runPublishCheck(getDb());
    if (result.dispatched > 0) {
      console.log('[' + WORKER_ID + '] Dispatched ' + result.dispatched + ' uploads (skipped ' + result.skipped + ')');
    }
  } catch (err: any) {
    console.error('[' + WORKER_ID + '] Publish check failed:', err.message);
    appendAlert('publish check failed: ' + (err.message || err));
  } finally {
    schedule();
  }
}