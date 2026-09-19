import type Database from 'better-sqlite3';

// PT (America/Los_Angeles) calendar day key, e.g. "2026-09-20".
// Quota resets at midnight PT = 12:00 noon PKT.
export function ptDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getDefaultChannelId(db: Database.Database): number {
  let channel = db.prepare('SELECT id FROM channels WHERE name = ?').get('channel1') as any;
  if (!channel) {
    db.prepare("INSERT INTO channels (name, daily_caps, quota_used, quota_date) VALUES (?, 10, 0, ?)").run('channel1', ptDateKey());
    channel = db.prepare('SELECT id FROM channels WHERE name = ?').get('channel1') as any;
  }
  return channel.id;
}

export function ensureFreshChannelQuota(db: Database.Database, channelId: number, dayKey: string = ptDateKey()): void {
  db.prepare('UPDATE channels SET quota_date = ?, quota_used = 0 WHERE id = ? AND quota_date <> ?').run(dayKey, channelId, dayKey);
}

export function uploadsRemaining(db: Database.Database, channelId: number, dayKey: string = ptDateKey()): number {
  ensureFreshChannelQuota(db, channelId, dayKey);
  const row = db.prepare('SELECT daily_caps, quota_used FROM channels WHERE id = ?').get(channelId) as any;
  if (!row) return 0;
  return Math.max(0, row.daily_caps - row.quota_used);
}

export function consumeQuota(db: Database.Database, channelId: number, dayKey: string = ptDateKey()): number | null {
  ensureFreshChannelQuota(db, channelId, dayKey);
  const row = db.prepare('SELECT daily_caps, quota_used FROM channels WHERE id = ?').get(channelId) as any;
  if (!row) return null;
  if (row.quota_used >= row.daily_caps) return null;
  db.prepare('UPDATE channels SET quota_used = quota_used + 1 WHERE id = ?').run(channelId);
  return row.quota_used + 1;
}