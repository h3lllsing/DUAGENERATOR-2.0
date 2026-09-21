import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getDb, selectOne } from '../db.js';
import { runPublishCheck } from '../growth/scheduler.js';
import { appendAlert } from '../alerts.js';

const WORKER_ID = 'publish-' + process.pid;
const DEFAULT_INTERVAL_MS = 15000;
const ROOT = path.resolve(process.cwd());
const SCRIPTS_DIR = path.resolve(ROOT, 'remotion', 'scripts');
const UPLOAD_PY = path.join(SCRIPTS_DIR, 'upload.py');
const TOKEN_PATH = path.resolve(ROOT, 'data', 'yt_token_channel1.json');
const LEDGER_PATH = path.resolve(ROOT, 'data', 'upload_state_v2.json');
const UPLOAD_TIMEOUT_MS = 8 * 60 * 1000;

let running = true;
let timer: ReturnType<typeof setTimeout> | null = null;
let uploading = false;

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

function readSetting(key: string, fallback: string): string {
  const row = selectOne('SELECT value FROM settings WHERE key = ?', [key]) as any;
  return row?.value ?? fallback;
}

function duaKeyFromSlug(slug: string): string {
  return slug.replace(/^dua-/, '').replace(/-/g, '_');
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
  }
  try {
    runUploadJobs(getDb());
  } catch (err: any) {
    console.error('[' + WORKER_ID + '] Upload executor failed:', err.message);
    appendAlert('upload executor failed: ' + (err.message || err));
  } finally {
    schedule();
  }
}

/** Process queued 'upload' jobs by shelling out to upload.py (private by default). */
function runUploadJobs(db: any): void {
  if (uploading) return;
  const jobs = db.prepare(`
    SELECT j.id, j.state, d.slug AS slug, v.id AS video_id
    FROM jobs j
    JOIN videos v ON v.id = j.video_id
    JOIN duas d ON d.id = v.dua_id
    WHERE j.type = 'upload' AND j.state = 'queued'
    ORDER BY j.id ASC
  `).all() as any[];
  if (jobs.length === 0) return;

  uploading = true;
  try {
    const live = readSetting('upload_live', '0') === '1';
    const privacy = readSetting('v2_upload_privacy', 'private');
    for (const job of jobs) {
      const duaKey = duaKeyFromSlug(job.slug);
      const mode = live ? '--live' : '--dry-run';
      const cmd = 'python -X utf8 "' + UPLOAD_PY + '" --token "' + TOKEN_PATH + '" --ledger "' + LEDGER_PATH
        + '" --only ' + duaKey + ' --privacy ' + privacy + ' ' + mode;
      console.log('[' + WORKER_ID + '] upload ' + duaKey + ' live=' + live + ' privacy=' + privacy);
      let videoUrl = '';
      try {
        const stdout = execSync(cmd, { cwd: remotionCwd(), timeout: UPLOAD_TIMEOUT_MS, encoding: 'utf8' });
        const tail = stdout.split('\n').filter((l) => l.trim().length > 0).slice(-3).join(' | ');
        if (!live) {
          db.prepare("UPDATE jobs SET state = 'done', payload = json_patch(COALESCE(payload,'{}'), ?) WHERE id = ?")
            .run(JSON.stringify({ dry_run: true, note: tail }), job.id);
          console.log('[' + WORKER_ID + '] dry-run ok: ' + duaKey + ' | ' + tail);
          continue;
        }
        videoUrl = resolveUploadedVideoId(duaKey, stdout);
        if (videoUrl) {
          db.prepare("UPDATE videos SET video_id = ?, state = 'published' WHERE id = ?").run(videoUrl, job.video_id);
          db.prepare("UPDATE jobs SET state = 'done', payload = json_patch(COALESCE(payload,'{}'), ?) WHERE id = ?")
            .run(JSON.stringify({ video_id: videoUrl, via: 'upload.py', live }), job.id);
          appendAlert('upload done: ' + duaKey + ' -> ' + videoUrl + ' (live=' + live + ')');
          console.log('[' + WORKER_ID + '] upload done: ' + duaKey + ' -> ' + videoUrl);
        } else {
          db.prepare("UPDATE jobs SET state = 'failed', payload = json_patch(COALESCE(payload,'{}'), ?) WHERE id = ?")
            .run(JSON.stringify({ error: 'no video id returned', live }), job.id);
          appendAlert('upload no id: ' + duaKey);
        }
      } catch (err: any) {
        const errMsg = (err?.stderr?.toString?.() || err?.message || String(err)).split('\n').slice(-4).join(' ');
        db.prepare("UPDATE jobs SET state = 'failed', payload = json_patch(COALESCE(payload,'{}'), ?) WHERE id = ?")
          .run(JSON.stringify({ error: errMsg, live }), job.id);
        appendAlert('upload failed: ' + duaKey + ' | ' + errMsg);
      }
    }
  } finally {
    uploading = false;
  }
}

function remotionCwd(): string {
  return path.resolve(ROOT, 'remotion');
}

function resolveUploadedVideoId(duaKey: string, stdout: string): string {
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
      const entry = ledger[duaKey];
      if (entry && entry.video_id) return entry.video_id;
    }
  } catch { /* fall through */ }
  const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(/"video_id"\s*:\s*"([^"]+)"/);
    if (match) return match[1];
  }
  return '';
}