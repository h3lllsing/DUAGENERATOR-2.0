import type Database from 'better-sqlite3';
import { getDefaultChannelId, consumeQuota, uploadsRemaining } from './quota.js';

export interface PublishResult {
  dispatched: number;
  skipped: number;
  nextDueAt: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeIso(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error('Invalid publish_at: ' + value);
  return d.toISOString();
}

export function createSchedule(db: Database.Database, videoId: number, publishAt: string, channelId: number | null, note?: string, status = 'scheduled'): any {
  const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(videoId) as any;
  if (!video) throw new Error('Video not found');
  const iso = normalizeIso(publishAt);
  const ch = channelId ?? getDefaultChannelId(db);
  const res = db.prepare(
    "INSERT INTO schedules (video_id, publish_at, channel_id, status, note) VALUES (?, ?, ?, ?, ?)"
  ).run(videoId, iso, ch, status, note || null);
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(res.lastInsertRowid);
}

export function updateSchedule(db: Database.Database, id: number, body: { publish_at?: string; status?: string; note?: string }): any {
  const current = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
  if (!current) throw new Error('Schedule not found');
  const sets: string[] = [];
  const vals: any[] = [];
  if (body.publish_at !== undefined) {
    sets.push('publish_at = ?');
    vals.push(normalizeIso(body.publish_at));
  }
  if (body.note !== undefined) {
    sets.push('note = ?');
    vals.push(body.note ?? null);
  }
  if (body.status !== undefined) {
    if (!['pending', 'scheduled', 'published', 'failed'].includes(body.status)) throw new Error('Invalid status');
    sets.push('status = ?');
    vals.push(body.status);
  }
  if (sets.length) {
    vals.push(id);
    db.prepare('UPDATE schedules SET ' + sets.join(', ') + ' WHERE id = ?').run(...vals);
  }
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
}

export function runPublishCheck(db: Database.Database, _now: Date = new Date()): PublishResult {
  const nowIsoStr = _now.toISOString();
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(_now);

  const due = db.prepare(
    "SELECT * FROM schedules WHERE status = 'scheduled' AND publish_at <= ? ORDER BY publish_at ASC"
  ).all(nowIsoStr) as any[];

  let dispatched = 0;
  let skipped = 0;
  let nextDueAt: string | null = null;

  const remainingRow = db.prepare(
    "SELECT MIN(publish_at) as m FROM schedules WHERE status = 'scheduled' AND publish_at > ?"
  ).get(nowIsoStr) as any;
  nextDueAt = remainingRow && remainingRow.m ? remainingRow.m : null;

  const processedVideos = new Set<number>();

  for (const sched of due) {
    const chId = sched.channel_id ?? getDefaultChannelId(db);
    const capacity = uploadsRemaining(db, chId, dayKey);
    if (capacity <= 0) { skipped++; continue; }

    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(sched.video_id) as any;
    if (!video) {
      db.prepare("UPDATE schedules SET status = 'failed' WHERE id = ?").run(sched.id);
      skipped++;
      continue;
    }

    if (processedVideos.has(sched.video_id)) { skipped++; continue; }

    const used = consumeQuota(db, chId, dayKey);
    if (used === null) { skipped++; continue; }

    const existingJob = db.prepare("SELECT id FROM jobs WHERE video_id = ? AND type = 'upload'").get(sched.video_id) as any;
    if (existingJob) {
      db.prepare("UPDATE schedules SET status = 'published', job_id = ?, updated_at = datetime('now') WHERE id = ?").run(existingJob.id, sched.id);
      processedVideos.add(sched.video_id);
      dispatched++;
      continue;
    }

    const jobRes = db.prepare(
      "INSERT INTO jobs (video_id, type, state, payload) VALUES (?, 'upload', 'queued', ?)"
    ).run(sched.video_id, JSON.stringify({ dua_id: video.dua_id, source: 'schedule:' + sched.id }));

    db.prepare("UPDATE schedules SET status = 'published', job_id = ?, updated_at = datetime('now') WHERE id = ?").run(Number(jobRes.lastInsertRowid), sched.id);
    db.prepare("UPDATE videos SET published_at = ?, state = 'uploaded' WHERE id = ?").run(nowIsoStr, sched.video_id);
    db.prepare(
      "INSERT INTO ledger_entries (channel_id, dua_id, action, meta, ts) VALUES (?, ?, 'upload', ?, ?)"
    ).run(chId, video.dua_id, JSON.stringify({ schedule_id: sched.id, video_id: video.id, day: dayKey }), nowIsoStr);

    processedVideos.add(sched.video_id);
    dispatched++;
  }

  return { dispatched, skipped, nextDueAt };
}

export function calendarCounts(db: Database.Database, monthKey: string, channelId?: number): any[] {
  const rows = db.prepare(
    "SELECT date(publish_at) as d, COUNT(*) as c FROM schedules WHERE substr(publish_at, 1, 7) = ? GROUP BY date(publish_at) ORDER BY d ASC"
  ).all(monthKey) as any[];
  return rows;
}

export function listSchedules(db: Database.Database, status?: string): any[] {
  const sql = "SELECT s.*, v.video_id as yid, v.state as video_state, d.slug as dua_slug, COALESCE(d.title, '') as dua_title FROM schedules s LEFT JOIN videos v ON v.id = s.video_id LEFT JOIN duas d ON d.id = v.dua_id";
  const params: any[] = [];
  let where = '';
  if (status) { where = ' WHERE s.status = ?'; params.push(status); }
  return db.prepare(sql + where + ' ORDER BY s.publish_at ASC').all(...params) as any[];
}