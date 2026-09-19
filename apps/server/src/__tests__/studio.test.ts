import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers';
import type Database from 'better-sqlite3';

describe('Phase 2 — Content Studio (DB layer)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    db.prepare("INSERT INTO channels (name) VALUES (?)").run('ch-test');
    db.prepare("INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)").run('dua-s1', 'Studio Test', 'Ref');
  });

  function seedVideo() {
    const dua = db.prepare('SELECT id FROM duas WHERE slug = ?').get('dua-s1') as any;
    db.prepare("INSERT INTO videos (dua_id, state) VALUES (?, 'not_started')").run(dua.id);
    return db.prepare('SELECT id FROM videos ORDER BY id DESC LIMIT 1').get() as any;
  }

  describe('Thumbnail columns', () => {
    it('set and read thumbs JSON', () => {
      const video = seedVideo();
      const thumbs = { a: { path: '/tmp/thumb_a.jpg', set_at: '2026-09-20' }, b: null };
      db.prepare('UPDATE videos SET thumbs = ? WHERE id = ?').run(JSON.stringify(thumbs), video.id);
      const row = db.prepare('SELECT thumbs FROM videos WHERE id = ?').get(video.id) as any;
      const parsed = JSON.parse(row.thumbs);
      expect(parsed.a.path).toBe('/tmp/thumb_a.jpg');
      expect(parsed.b).toBeNull();
    });

    it('swap thumbs', () => {
      const video = seedVideo();
      const thumbs = { a: { path: 'a.jpg' }, b: { path: 'b.jpg' } };
      db.prepare('UPDATE videos SET thumbs = ? WHERE id = ?').run(JSON.stringify(thumbs), video.id);
      // swap
      const row = db.prepare('SELECT thumbs FROM videos WHERE id = ?').get(video.id) as any;
      const t = JSON.parse(row.thumbs);
      const temp = t.a; t.a = t.b; t.b = temp;
      db.prepare('UPDATE videos SET thumbs = ? WHERE id = ?').run(JSON.stringify(t), video.id);
      const result = JSON.parse((db.prepare('SELECT thumbs FROM videos WHERE id = ?').get(video.id) as any).thumbs);
      expect(result.a.path).toBe('b.jpg');
      expect(result.b.path).toBe('a.jpg');
    });
  });

  describe('Caption columns', () => {
    it('set and read caption_en', () => {
      const video = seedVideo();
      db.prepare('UPDATE videos SET caption_en = ? WHERE id = ?').run('Line 1\nLine 2\nLine 3', video.id);
      const row = db.prepare('SELECT caption_en FROM videos WHERE id = ?').get(video.id) as any;
      expect(row.caption_en).toBe('Line 1\nLine 2\nLine 3');
    });

    it('update caption in place', () => {
      const video = seedVideo();
      db.prepare('UPDATE videos SET caption_en = ? WHERE id = ?').run('Original', video.id);
      db.prepare('UPDATE videos SET caption_en = ? WHERE id = ?').run('Edited', video.id);
      const row = db.prepare('SELECT caption_en FROM videos WHERE id = ?').get(video.id) as any;
      expect(row.caption_en).toBe('Edited');
    });
  });

  describe('SEO columns', () => {
    it('set and read SEO fields', () => {
      const video = seedVideo();
      db.prepare('UPDATE videos SET seo_title = ?, seo_description = ?, seo_tags = ?, seo_hashtags = ? WHERE id = ?')
        .run('SEO Title', 'Description', JSON.stringify(['islam', 'dua']), JSON.stringify(['#islam', '#dua']), video.id);
      const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(video.id) as any;
      expect(row.seo_title).toBe('SEO Title');
      expect(row.seo_description).toBe('Description');
      expect(JSON.parse(row.seo_tags)).toEqual(['islam', 'dua']);
      expect(JSON.parse(row.seo_hashtags)).toEqual(['#islam', '#dua']);
    });
  });

  describe('Approval workflow', () => {
    it('state transitions: draft → qc_passed → en_review → approved → published', () => {
      const video = seedVideo();
      const states = ['draft', 'qc_passed', 'en_review', 'approved', 'published'];
      for (const state of states) {
        db.prepare('UPDATE videos SET state = ? WHERE id = ?').run(state, video.id);
        const row = db.prepare('SELECT state FROM videos WHERE id = ?').get(video.id) as any;
        expect(row.state).toBe(state);
      }
    });

    it('approved_by and approved_at set on approval', () => {
      const video = seedVideo();
      db.prepare("UPDATE videos SET state = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?")
        .run('admin', video.id);
      const row = db.prepare('SELECT approved_by, approved_at FROM videos WHERE id = ?').get(video.id) as any;
      expect(row.approved_by).toBe('admin');
      expect(row.approved_at).toBeDefined();
    });

    it('review table: pending → approved with edited_text', () => {
      const video = seedVideo();
      db.prepare("INSERT INTO review (video_id, kind, status, note, edited_text) VALUES (?, 'en', 'pending', 'needs review', null)")
        .run(video.id);
      db.prepare("UPDATE review SET status = 'approved', edited_text = ? WHERE video_id = ? AND kind = 'en'")
        .run('Edited caption text', video.id);
      const row = db.prepare("SELECT * FROM review WHERE video_id = ? AND kind = 'en'").get(video.id) as any;
      expect(row.status).toBe('approved');
      expect(row.edited_text).toBe('Edited caption text');
    });

    it('review queue view: qc_passed and en_review videos', () => {
      const video = seedVideo();
      db.prepare("UPDATE videos SET state = 'qc_passed' WHERE id = ?").run(video.id);
      // Insert another video that is approved (should not be in queue)
      db.prepare("INSERT INTO videos (dua_id, state) VALUES (1, 'approved')").run();
      const queue = db.prepare("SELECT * FROM videos WHERE state IN ('qc_passed', 'en_review')").all();
      expect(queue).toHaveLength(1);
      expect((queue[0] as any).id).toBe(video.id);
    });
  });
});
