import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';

export default async function monitoringRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/monitoring', async () => {
    const db = getDb();

    const jobsByStateRaw = db.prepare('SELECT state, COUNT(*) as c FROM jobs GROUP BY state').all() as { state: string; c: number }[];
    const byState: Record<string, number> = {};
    for (const row of jobsByStateRaw) byState[row.state] = row.c;
    const active = ['queued', 'prep', 'render', 'qc', 'retry'];
    const running = active.reduce((sum, s) => sum + (byState[s] || 0), 0);

    const schedulesActive = (db.prepare("SELECT COUNT(*) as c FROM schedules WHERE status IN ('pending','scheduled')").get() as { c: number }).c;

    const channel = db.prepare("SELECT daily_caps, quota_used, quota_date FROM channels WHERE name='channel1'").get() as { daily_caps: number; quota_used: number; quota_date: string } | undefined;

    const dataDir = path.resolve(process.cwd(), 'data');
    let disk: { freeBytes: number; totalBytes: number } | null = null;
    try {
      const st = fs.statfsSync(dataDir);
      disk = { freeBytes: st.bavail * st.bsize, totalBytes: st.blocks * st.bsize };
    } catch { /* statfs unavailable */ }

    const dbPath = path.join(dataDir, 'v2.db');
    let dbSizeBytes = 0;
    try { dbSizeBytes = fs.statSync(dbPath).size; } catch { /* ignore */ }

    return {
      ok: true,
      data: {
        uptimeSec: Math.round(process.uptime()),
        pid: process.pid,
        version: '2.0.0',
        jobs: { byState, running, done: byState['done'] || 0, failed: byState['failed'] || 0 },
        queueDepth: byState['queued'] || 0,
        schedules: { active: schedulesActive },
        quota: channel
          ? { dailyCaps: channel.daily_caps, quotaUsed: channel.quota_used, remaining: Math.max(0, channel.daily_caps - channel.quota_used), quotaDate: channel.quota_date }
          : null,
        disk,
        dbSizeBytes,
        dbPath,
      },
    };
  });
}