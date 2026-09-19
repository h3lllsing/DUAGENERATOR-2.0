import { getDb, selectAll, selectOne, run } from '../db.js';
import { execSync } from 'child_process';
import path from 'path';

const WORKER_ID = 'render-' + process.pid;
const POLL_MS = 1000;
let running = true;

export function startRenderWorker(): void {
  console.log('[' + WORKER_ID + '] Starting render worker');
  process.on('SIGINT', () => { running = false; });
  process.on('SIGTERM', () => { running = false; });
  loop();
}

async function loop(): Promise<void> {
  while (running) {
    const job = getNext();
    if (job) { await processJob(job); } else { await new Promise(r => setTimeout(r, POLL_MS)); }
  }
  console.log('[' + WORKER_ID + '] Stopped');
}

function getNext(): any | null {
  return selectOne("SELECT * FROM jobs WHERE state IN ('queued','failed') ORDER BY created_at ASC LIMIT 1");
}

function updateState(id: number, state: string, progress: number, error?: string): void {
  if (error) {
    run('UPDATE jobs SET state=?, progress=?, error=? WHERE id=?', [state, progress, error, id]);
  } else {
    run('UPDATE jobs SET state=?, progress=? WHERE id=?', [state, progress, id]);
  }
}

async function processJob(job: any): Promise<void> {
  console.log('[' + WORKER_ID + '] Job ' + job.id + ' (video ' + job.video_id + ')');
  try {
    updateState(job.id, 'prep', 0);
    const video = selectOne('SELECT * FROM videos WHERE id=?', [job.video_id]);
    if (!video) throw new Error('Video ' + job.video_id + ' not found');
    const dua = selectOne('SELECT * FROM duas WHERE id=?', [video.dua_id]);
    if (!dua) throw new Error('Dua ' + video.dua_id + ' not found');

    const remotionDir = path.resolve(process.cwd(), 'remotion');
    const scriptsDir = path.resolve(remotionDir, 'scripts');

    updateState(job.id, 'render', 10);
    execSync('python -X utf8 "' + path.join(scriptsDir, 'prepare_dua.py') + '" --dua-id ' + dua.id, { cwd: remotionDir, timeout: 300000 });

    updateState(job.id, 'render', 30);
    execSync('python -X utf8 "' + path.join(scriptsDir, 'make_manifest.py') + '" --dua-id ' + dua.id, { cwd: remotionDir, timeout: 60000 });

    updateState(job.id, 'render', 50);
    const compId = dua.id.replace(/_/g, '-');
    execSync('npx remotion render ' + compId + ' out/' + dua.id + '.mp4', { cwd: remotionDir, timeout: 600000 });

    updateState(job.id, 'render', 65);
    const mp4In = path.resolve(remotionDir, 'out', dua.id + '.mp4');
    const mp4Out = path.resolve(remotionDir, 'out', dua.id + '_final.mp4');
    execSync('ffmpeg -y -i "' + mp4In + '" -c:v libx264 -crf 18 -preset fast -movflags +faststart "' + mp4Out + '"', { timeout: 120000 });

    updateState(job.id, 'qc', 75);
    execSync('python -X utf8 "' + path.join(scriptsDir, 'qc.py') + '" "' + mp4Out + '"', { timeout: 60000 });

    updateState(job.id, 'qc', 85);
    execSync('python -X utf8 "' + path.join(scriptsDir, 'make_thumbs.py') + '" --dua-id ' + dua.id + ' --dry-run', { cwd: remotionDir, timeout: 120000 });

    updateState(job.id, 'qc', 95);
    execSync('python -X utf8 "' + path.join(scriptsDir, 'metadata.py') + '" ' + dua.id, { cwd: remotionDir, timeout: 30000 });

    updateState(job.id, 'done', 100);
    run("UPDATE videos SET state='rendered' WHERE id=?", [video.id]);
    console.log('[' + WORKER_ID + '] Job ' + job.id + ' completed');
  } catch (err: any) {
    console.error('[' + WORKER_ID + '] Job ' + job.id + ' failed:', err.message);
    const failCount = selectOne("SELECT COUNT(*) as c FROM jobs WHERE video_id=? AND state='failed'", [job.video_id]);
    updateState(job.id, 'failed', 0, err.message);
  }
}
