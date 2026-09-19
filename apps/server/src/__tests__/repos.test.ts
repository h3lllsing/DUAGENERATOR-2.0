import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers';
import type Database from 'better-sqlite3';

describe('Repos (DB layer)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('duas CRUD', () => {
    it('insert and retrieve a dua', () => {
      const stmt = db.prepare(`
        INSERT INTO duas (slug, title, title_en, urdu, arabic, english, explanation, category, reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run('test-dua', 'Test Dua', 'Test Dua EN', 'test urdu', 'test arabic', 'test english', 'test explanation', 'test', 'Test Ref 1:1');
      expect(result.changes).toBe(1);

      const row = db.prepare('SELECT * FROM duas WHERE slug = ?').get('test-dua') as any;
      expect(row).toBeDefined();
      expect(row.title).toBe('Test Dua');
      expect(row.reference).toBe('Test Ref 1:1');
    });

    it('update a dua', () => {
      db.prepare(`INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)`).run('dua-1', 'Original', 'Ref');
      const result = db.prepare('UPDATE duas SET title = ? WHERE slug = ?').run('Updated', 'dua-1');
      expect(result.changes).toBe(1);

      const row = db.prepare('SELECT title FROM duas WHERE slug = ?').get('dua-1') as any;
      expect(row.title).toBe('Updated');
    });

    it('delete a dua', () => {
      db.prepare(`INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)`).run('dua-del', 'To Delete', 'Ref');
      const result = db.prepare('DELETE FROM duas WHERE slug = ?').run('dua-del');
      expect(result.changes).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as c FROM duas').get()).toHaveProperty('c', 0);
    });

    it('enforces unique slug', () => {
      db.prepare(`INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)`).run('dua-unique', 'First', 'Ref');
      expect(() => {
        db.prepare(`INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)`).run('dua-unique', 'Second', 'Ref2');
      }).toThrow();
    });

    it('list all duas', () => {
      for (let i = 0; i < 5; i++) {
        db.prepare(`INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)`).run(`dua-${i}`, `Dua ${i}`, `Ref ${i}`);
      }
      const rows = db.prepare('SELECT * FROM duas').all();
      expect(rows).toHaveLength(5);
    });
  });

  describe('channels', () => {
    it('insert and retrieve a channel', () => {
      db.prepare('INSERT INTO channels (name, daily_caps) VALUES (?, ?)').run('test-channel', 5);
      const row = db.prepare('SELECT * FROM channels WHERE name = ?').get('test-channel') as any;
      expect(row).toBeDefined();
      expect(row.daily_caps).toBe(5);
    });

    it('update quota', () => {
      db.prepare('INSERT INTO channels (name, daily_caps, quota_used) VALUES (?, ?, ?)').run('ch', 10, 0);
      db.prepare('UPDATE channels SET quota_used = ? WHERE name = ?').run(5, 'ch');
      const row = db.prepare('SELECT quota_used FROM channels WHERE name = ?').get('ch') as any;
      expect(row.quota_used).toBe(5);
    });
  });

  describe('ledger_entries', () => {
    it('insert ledger entry with FK', () => {
      db.prepare('INSERT INTO channels (name) VALUES (?)').run('ch1');
      const ch = db.prepare('SELECT id FROM channels WHERE name = ?').get('ch1') as any;
      db.prepare('INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)').run('dua-fk', 'FK Test', 'Ref');
      const dua = db.prepare('SELECT id FROM duas WHERE slug = ?').get('dua-fk') as any;

      const result = db.prepare(
        'INSERT INTO ledger_entries (dua_id, channel_id, action, meta, ts) VALUES (?, ?, ?, ?, ?)'
      ).run(dua.id, ch.id, 'upload', '{"status":"uploaded"}', '2026-09-20T00:00:00');
      expect(result.changes).toBe(1);
    });

    it('rejects FK violation', () => {
      expect(() => {
        db.prepare(
          'INSERT INTO ledger_entries (dua_id, channel_id, action, meta, ts) VALUES (?, ?, ?, ?, ?)'
        ).run(9999, 9999, 'upload', '{}', '2026-09-20T00:00:00');
      }).toThrow();
    });
  });

  describe('review table', () => {
    it('insert and query review', () => {
      db.prepare('INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)').run('dua-rev', 'Review Test', 'Ref');
      const dua = db.prepare('SELECT id FROM duas WHERE slug = ?').get('dua-rev') as any;

      db.prepare('INSERT INTO review (video_id, kind, status, note) VALUES (?, ?, ?, ?)').run(dua.id, 'en', 'pending', 'needs review');
      const row = db.prepare('SELECT * FROM review WHERE video_id = ?').get(dua.id) as any;
      expect(row).toBeDefined();
      expect(row.status).toBe('pending');
    });
  });
});
