import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const LEGACY_EN_REVIEW = () => path.resolve(process.cwd(), 'data', 'legacy_en_review.json');

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

export function loadLegacyEnReview(): Record<string, any> | null {
  const p = LEGACY_EN_REVIEW();
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function seedReviewFromLegacy(db: Database.Database, duaId: number, videoId: number): number {
  const legacy = loadLegacyEnReview();
  if (!legacy) return 0;
  const dua = db.prepare('SELECT slug FROM duas WHERE id = ?').get(duaId) as any;
  if (!dua) return 0;

  const stem = dua.slug.replace(/^dua-/, '').replace(/-/g, '_');
  const entry: any = legacy[stem] || legacy[dua.slug];
  if (!entry || typeof entry !== 'object') return 0;

  const status = REVIEW_STATUSES.includes(entry.status) ? entry.status : 'pending';
  const stmt = db.prepare('INSERT OR IGNORE INTO review (video_id, kind, status, note, reviewer) VALUES (?, ?, ?, ?, ?)');
  stmt.run(videoId, 'en', status, entry.note || entry.edited_note || null, 'legacy-migration');
  const row = db.prepare('SELECT id FROM review WHERE video_id = ? AND kind = ?').get(videoId, 'en') as any;
  return row ? 1 : 0;
}

export function legacyEnReviewPath(): string {
  return LEGACY_EN_REVIEW();
}