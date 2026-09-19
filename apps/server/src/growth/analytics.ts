import type Database from 'better-sqlite3';
import fs from 'fs';

export function upsertMetrics(db: Database.Database, rows: any[]): number {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO analytics_cache (video_yid, day, views, likes, comments, ctr, retention) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  for (const r of rows) {
    if (!r.video_yid || !r.day) continue;
    stmt.run(r.video_yid, r.day, r.views || 0, r.likes || 0, r.comments || 0, r.ctr || 0, r.retention || 0);
    n++;
  }
  return n;
}

export function importMetricsFromFile(db: Database.Database, filePath: string): number {
  if (!fs.existsSync(filePath)) throw new Error('Analytics file not found: ' + filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const rows = Array.isArray(data) ? data : data.rows;
  if (!Array.isArray(rows)) throw new Error('Malformed analytics file: expected array or {rows:[...]}');
  return upsertMetrics(db, rows);
}

export function overview(db: Database.Database): any {
  const totals = db.prepare(
    'SELECT COUNT(DISTINCT video_yid) as videos, COUNT(DISTINCT day) as days, SUM(views) as views, SUM(likes) as likes, SUM(comments) as comments, AVG(ctr) as avg_ctr, AVG(retention) as avg_retention FROM analytics_cache'
  ).get() as any;
  const todayRow = db.prepare('SELECT MAX(day) as last FROM analytics_cache').get() as any;
  return {
    videos: totals?.videos || 0,
    days: totals?.days || 0,
    views: totals?.views || 0,
    likes: totals?.likes || 0,
    comments: totals?.comments || 0,
    avgCtr: round2(totals?.avg_ctr),
    avgRetention: round2(totals?.avg_retention),
    lastUpdated: todayRow?.last || null,
  };
}

export function underperformers(db: Database.Database): any[] {
  const threshold = getThreshold(db);
  const rows = db.prepare(`
    SELECT c.video_yid,
           SUM(c.views) as views, SUM(c.likes) as likes, SUM(c.comments) as comments,
           AVG(c.ctr) as ctr, AVG(c.retention) as retention,
           v.id as video_id, v.dua_id, v.state, d.slug as dua_slug, d.title as dua_title, d.category
      FROM analytics_cache c
      LEFT JOIN videos v ON v.video_id = c.video_yid
      LEFT JOIN duas d ON d.id = v.dua_id
     GROUP BY c.video_yid
  `).all() as any[];

  const scored = rows
    .filter((r: any) => r.views < threshold)
    .map((r: any) => {
      const ctrScore = r.ctr == null ? 0 : Math.max(0, 1 - r.ctr / 5);
      const retScore = r.retention == null ? 0 : Math.max(0, 1 - r.retention / 60);
      const lackScore = Math.max(0, 1 - r.views / threshold);
      return {
        ...r,
        ctr: round2(r.ctr),
        retention: round2(r.retention),
        score: round2((lackScore * 0.5 + ctrScore * 0.3 + retScore * 0.2) * 100),
        actions: { swapThumb: true, retitle: true, reseo: true, reshare: true },
      };
    })
    .sort((a: any, b: any) => b.score - a.score);

  return scored;
}

export function buildSampleRows(db: Database.Database, days = 7): any[] {
  const yids = db.prepare('SELECT DISTINCT video_id FROM videos WHERE video_id IS NOT NULL').all() as any[];
  if (!yids.length) {
    const fromLedger = db.prepare("SELECT DISTINCT json_extract(meta, '$.video_id') as yid FROM ledger_entries WHERE json_extract(meta, '$.video_id') IS NOT NULL").all() as any[];
    yids.push(...fromLedger);
  }
  const rows: any[] = [];
  const base = new Date('2026-09-13T00:00:00.000Z');
  yids.forEach((y, i) => {
    for (let d = 0; d < days; d++) {
      const day = new Date(base.getTime() + d * 86400000);
      const dayKey = day.toISOString().slice(0, 10);
      const growth = 1 + (i % 3) * 0.4;
      rows.push({
        video_yid: y.yid || y.video_id,
        day: dayKey,
        views: Math.round((30 + ((i * 7 + d * 5) % 120)) * growth),
        likes: Math.round((2 + ((i * 3 + d) % 9)) * growth),
        comments: Math.round((0 + ((i + d) % 5)) * growth),
        ctr: Number((1 + ((i * 5 + d * 5) % 60) / 10).toFixed(2)),
        retention: Number((20 + ((i * 11 + d * 7) % 50)).toFixed(2)),
      });
    }
  });
  return rows;
}

function getThreshold(db: Database.Database): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('analytics_threshold_views') as any;
  const n = parseInt(row?.value || '100', 10);
  return isNaN(n) ? 100 : n;
}

function round2(n: any): number {
  if (n == null || isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}