import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers';
import type Database from 'better-sqlite3';
import { ptDateKey, getDefaultChannelId, uploadsRemaining, consumeQuota } from '../growth/quota.js';
import { createSchedule, updateSchedule, runPublishCheck, calendarCounts, listSchedules } from '../growth/scheduler.js';
import { upsertMetrics, overview, underperformers } from '../growth/analytics.js';
import { importPlaylistsFromJson, manifestForPlaylist } from '../growth/playlists.js';
import { suggestTopics, addTopic, addSuggestedTopics } from '../growth/topics.js';
import { buildSharePayload } from '../growth/sharekit.js';
import path from 'path';

describe('Phase 3 Growth Engine', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    seedDua(db, 'dua-1', 'Ghusl Dua', 'bukhari');
    seedDua(db, 'dua-2', 'Safar Dua', 'muslim');
    seedDua(db, 'dua-3', 'Khoon Dua', 'tirmidhi');
    const v1 = db.prepare('SELECT id FROM duas WHERE slug = ?').get('dua-1') as any;
    const v2 = db.prepare('SELECT id FROM duas WHERE slug = ?').get('dua-2') as any;
    db.prepare("INSERT INTO videos (dua_id, kind, video_id, state) VALUES (?, 'long', NULL, 'not_started')").run(v1.id);
    db.prepare("INSERT INTO videos (dua_id, kind, video_id, state) VALUES (?, 'long', NULL, 'rendered')").run(v2.id);
  });

  function seedDua(d: Database.Database, slug: string, title: string, source: string) {
    d.prepare('INSERT INTO duas (slug, title, title_en, urdu, arabic, english, explanation, reference, category, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(slug, title, title + ' EN', 'urdu ' + title, 'arabic ' + title, 'english ' + title, 'expl ' + title, 'Test Ref 1:1', 'category', source, 'approved');
  }

  function videoIdForSlug(slug: string): number {
    return (db.prepare('SELECT v.id FROM videos v JOIN duas d ON d.id = v.dua_id WHERE d.slug = ?').get(slug) as any).id;
  }

  describe('quota', () => {
    it('produces PT date key string', () => {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(ptDateKey())).toBe(true);
    });

    it('starts channel1 with full daily cap', () => {
      const chId = getDefaultChannelId(db);
      expect(uploadsRemaining(db, chId)).toBe(10);
    });

    it('consumes quota down to zero then blocks', () => {
      const chId = getDefaultChannelId(db);
      let used: number | null = null;
      for (let i = 0; i < 10; i++) {
        used = consumeQuota(db, chId);
        expect(used).not.toBeNull();
      }
      expect(consumeQuota(db, chId)).toBeNull();
      expect(uploadsRemaining(db, chId)).toBe(0);
    });
  });

  describe('scheduler', () => {
    it('creates a schedule and lists it with dua info', () => {
      const s = createSchedule(db, videoIdForSlug('dua-1'), '2026-09-21T09:00:00.000Z', null, 'test note');
      expect(s.status).toBe('scheduled');
      expect(s.note).toBe('test note');
      const rows = listSchedules(db);
      expect(rows).toHaveLength(1);
      expect(rows[0].dua_slug).toBe('dua-1');
    });

    it('rejects scheduling for missing video', () => {
      expect(() => createSchedule(db, 9999, '2026-09-21T09:00:00.000Z', null)).toThrow('Video not found');
    });

    it('publishes a due schedule into a queued upload job and deducts quota', () => {
      const chId = getDefaultChannelId(db);
      createSchedule(db, videoIdForSlug('dua-2'), '2020-01-01T00:00:00.000Z', chId, 'due');
      const result = runPublishCheck(db);
      expect(result.dispatched).toBe(1);
      expect(result.skipped).toBe(0);

      const job = db.prepare("SELECT * FROM jobs WHERE type = 'upload'").get() as any;
      expect(job).toBeDefined();
      expect(job.state).toBe('queued');

      const sched = db.prepare('SELECT * FROM schedules').get() as any;
      expect(sched.status).toBe('published');
      expect(sched.job_id).toBe(job.id);

      const video = db.prepare('SELECT * FROM videos').all() as any[];
      const published = video.find((v: any) => v.id === videoIdForSlug('dua-2'));
      expect(published.state).toBe('uploaded');
      expect(published.published_at).toBeTruthy();
      expect(uploadsRemaining(db, chId)).toBe(9);
    });

    it('respects daily cap: only 10 posted when 11+ are due', () => {
      const chId = getDefaultChannelId(db);
      const duaIds = db.prepare('SELECT id FROM duas').all() as any[];
      for (let i = 0; i < 12; i++) {
        const duaId = duaIds[i % duaIds.length].id;
        const vid = db.prepare("INSERT INTO videos (dua_id, kind, state) VALUES (?, 'long', 'rendered')").run(duaId).lastInsertRowid;
        db.prepare("INSERT INTO schedules (video_id, publish_at, channel_id, status, note) VALUES (?, ?, ?, 'scheduled', ?)").run(vid, '2020-01-01T00:00:00.000Z', chId, 'cap-test-' + i);
      }
      const result = runPublishCheck(db);
      expect(result.dispatched).toBe(10);
      const remaining = db.prepare("SELECT COUNT(*) as c FROM schedules WHERE status = 'scheduled'").get() as any;
      expect(remaining.c).toBe(2);
      expect(uploadsRemaining(db, chId)).toBe(0);
    });

    it('rolls quota over on a new PT day', () => {
      const chId = getDefaultChannelId(db);
      for (let i = 0; i < 10; i++) consumeQuota(db, chId);
      db.prepare('UPDATE channels SET quota_date = ? WHERE id = ?').run('1999-01-01', chId);
      const future = new Date('2026-09-21T07:00:00.000Z'); // = 2026-09-21 PT midnight
      const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(future);
      expect(dayKey).toBe('2026-09-21');
      expect(uploadsRemaining(db, chId, dayKey)).toBe(10);
    });

    it('updates schedule note/status', () => {
      const s = createSchedule(db, videoIdForSlug('dua-1'), '2026-09-21T09:00:00.000Z', null);
      const updated = updateSchedule(db, s.id, { note: 'pinned', status: 'pending' });
      expect(updated.note).toBe('pinned');
      expect(updated.status).toBe('pending');
    });

    it('returns calendar counts by month', () => {
      createSchedule(db, videoIdForSlug('dua-1'), '2026-09-21T09:00:00.000Z', null);
      const counts = calendarCounts(db, '2026-09');
      expect(counts).toHaveLength(1);
      expect(counts[0].c).toBe(1);
    });
  });

  describe('analytics', () => {
    it('upserts metrics and computes overview', () => {
      upsertMetrics(db, [
        { video_yid: 'VIDEO1', day: '2026-09-13', views: 50, likes: 2, comments: 0, ctr: 2.5, retention: 40 },
        { video_yid: 'VIDEO2', day: '2026-09-13', views: 500, likes: 20, comments: 3, ctr: 4.0, retention: 55 },
      ]);
      const o = overview(db);
      expect(o.videos).toBe(2);
      expect(o.views).toBe(550);
    });

    it('flags underperformers below threshold with actions', () => {
      upsertMetrics(db, [
        { video_yid: 'VIDEO1', day: '2026-09-13', views: 20, likes: 0, comments: 0, ctr: 0.5, retention: 10 },
      ]);
      const under = underperformers(db);
      expect(under).toHaveLength(1);
      expect(under[0].actions.swapThumb).toBe(true);
    });
  });

  describe('playlists', () => {
    it('imports a plan file and builds a manifest', () => {
      const tmp = path.join(require('os').tmpdir(), 'plan-' + Date.now() + '.json');
      require('fs').writeFileSync(tmp, JSON.stringify({
        channel: 'channel1',
        playlists: [{ key: 'morning', title: 'Morning Azkar', members: [{ dua_id: 'dua_1', video_id: 'VID1', title: 'Ghusl Dua' }] }],
      }));
      const result = importPlaylistsFromJson(db, tmp);
      expect(result.playlists).toBe(1);
      expect(result.members).toBe(1);

      const playlist = db.prepare('SELECT id FROM playlists').get() as any;
      const manifest = manifestForPlaylist(db, playlist.id) as any;
      expect(manifest.missingVideos).toBe(0);
      expect(manifest.manifest).toContain('VID1');
      require('fs').unlinkSync(tmp);
    });
  });

  describe('topics', () => {
    it('suggests sidebar candidates without live API', () => {
      const suggestions = suggestTopics(db, 5);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.some((s: any) => s.keyword === 'bukhari')).toBe(true);
    });

    it('adds a topic with matched count', () => {
      const t = addTopic(db, 'safar');
      expect(t.comp_count).toBe(1);
    });

    it('addSuggestedTopics is idempotent', () => {
      const first = addSuggestedTopics(db, [{ keyword: 'bukhari', source: 'suggest' }]);
      expect(first.added).toBe(1);
      const second = addSuggestedTopics(db, [{ keyword: 'bukhari', source: 'suggest' }]);
      expect(second.added).toBe(0);
      expect(second.existing).toBe(1);
    });
  });

  describe('sharekit', () => {
    it('builds a share payload with watch url and hashtags', () => {
      const dua = { title: 'Safar Dua', reference: 'Test Ref 1:1', arabic: 'اللهم', english: 'O Allah' };
      const payload = buildSharePayload({ video_id: 'VID9' }, dua);
      expect(payload.watch_url).toContain('youtube.com/watch?v=VID9');
      expect(payload.share_text).toContain('#Dua');
      expect(payload.share_text).toContain('Safar Dua');
    });

    it('handles missing dua text gracefully', () => {
      const payload = buildSharePayload({ video_id: 'VID10' }, { title: '', title_en: 'Dua One' });
      expect(payload.share_text.length).toBeGreaterThan(0);
    });
  });
});