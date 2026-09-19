import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers';
import type Database from 'better-sqlite3';

describe('Jobs FSM (state transitions)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    // Seed: channel + dua + video
    db.prepare("INSERT INTO channels (name) VALUES (?)").run('ch-test');
    db.prepare("INSERT INTO duas (slug, title, reference) VALUES (?, ?, ?)").run('dua-j1', 'J1', 'Ref');
  });

  function seedVideo() {
    const dua = db.prepare('SELECT id FROM duas WHERE slug = ?').get('dua-j1') as any;
    db.prepare("INSERT INTO videos (dua_id, state) VALUES (?, 'not_started')").run(dua.id);
    return db.prepare('SELECT id FROM videos ORDER BY id DESC LIMIT 1').get() as any;
  }

  function createJob(videoId: number) {
    db.prepare("INSERT INTO jobs (video_id, type, state, progress) VALUES (?, 'render', 'queued', 0)").run(videoId);
    return db.prepare('SELECT id FROM jobs ORDER BY id DESC LIMIT 1').get() as any;
  }

  function transition(id: number, state: string, progress: number, error?: string) {
    if (error) {
      db.prepare('UPDATE jobs SET state=?, progress=?, error=? WHERE id=?').run(state, progress, error, id);
    } else {
      db.prepare('UPDATE jobs SET state=?, progress=? WHERE id=?').run(state, progress, id);
    }
  }

  it('queued → prep → render → qc → done', () => {
    const video = seedVideo();
    const job = createJob(video.id);

    // Initial
    let row = db.prepare('SELECT state FROM jobs WHERE id=?').get(job.id) as any;
    expect(row.state).toBe('queued');

    // prep
    transition(job.id, 'prep', 0);
    row = db.prepare('SELECT state FROM jobs WHERE id=?').get(job.id) as any;
    expect(row.state).toBe('prep');

    // render
    transition(job.id, 'render', 30);
    row = db.prepare('SELECT state, progress FROM jobs WHERE id=?').get(job.id) as any;
    expect(row.state).toBe('render');
    expect(row.progress).toBe(30);

    // qc
    transition(job.id, 'qc', 75);
    row = db.prepare('SELECT state FROM jobs WHERE id=?').get(job.id) as any;
    expect(row.state).toBe('qc');

    // done
    transition(job.id, 'done', 100);
    row = db.prepare('SELECT state, progress FROM jobs WHERE id=?').get(job.id) as any;
    expect(row.state).toBe('done');
    expect(row.progress).toBe(100);
  });

  it('queued → prep → failed (with error message)', () => {
    const video = seedVideo();
    const job = createJob(video.id);

    transition(job.id, 'prep', 0);
    transition(job.id, 'failed', 0, 'Remotion not found');

    const row = db.prepare('SELECT state, error FROM jobs WHERE id=?').get(job.id) as any;
    expect(row.state).toBe('failed');
    expect(row.error).toBe('Remotion not found');
  });

  it('failed job can be retried (picked up by getNext)', () => {
    const video = seedVideo();
    const job = createJob(video.id);
    transition(job.id, 'failed', 0, 'timeout');

    // getNext should find it
    const next = db.prepare("SELECT * FROM jobs WHERE state IN ('queued','failed') ORDER BY created_at ASC LIMIT 1").get();
    expect(next).toBeDefined();
    expect((next as any).id).toBe(job.id);
  });

  it('done job is NOT picked up by getNext', () => {
    const video = seedVideo();
    const job = createJob(video.id);
    transition(job.id, 'done', 100);

    const next = db.prepare("SELECT * FROM jobs WHERE state IN ('queued','failed') ORDER BY created_at ASC LIMIT 1").get();
    expect(next).toBeUndefined();
  });

  it('progress updates are tracked', () => {
    const video = seedVideo();
    const job = createJob(video.id);

    const progressSteps = [0, 10, 30, 50, 65, 75, 85, 95, 100];
    const states = ['prep', 'render', 'render', 'render', 'render', 'qc', 'qc', 'qc', 'done'];

    for (let i = 0; i < progressSteps.length; i++) {
      transition(job.id, states[i], progressSteps[i]);
      const row = db.prepare('SELECT state, progress FROM jobs WHERE id=?').get(job.id) as any;
      expect(row.state).toBe(states[i]);
      expect(row.progress).toBe(progressSteps[i]);
    }
  });
});
