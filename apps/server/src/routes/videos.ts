import type { FastifyInstance } from 'fastify';
import { getDb, selectAll, selectOne, run } from '../db.js';
import { seedReviewFromLegacy } from '../growth/legacy.js';

export default async function videosRoutes(fastify: FastifyInstance) {

// GET /api/v1/videos
  fastify.get('/api/v1/videos', async (request) => {
    const { dua_id, state, page = '1', limit = '50' } = request.query as any;
    let sql = 'SELECT v.*, d.title as dua_title, d.slug as dua_slug FROM videos v JOIN duas d ON d.id = v.dua_id WHERE 1=1';
    const params: any[] = [];
    let tsql = 'SELECT COUNT(*) as count FROM videos WHERE 1=1';
    const tparams: any[] = [];
    if (dua_id) { sql += ' AND v.dua_id = ?'; params.push(dua_id); tsql += ' AND dua_id = ?'; tparams.push(dua_id); }
    if (state) { sql += ' AND v.state = ?'; params.push(state); tsql += ' AND state = ?'; tparams.push(state); }
    sql += ' ORDER BY v.id DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const videos = selectAll(sql, params);
    const totalRow = selectOne(tsql, tparams);
    return { ok: true, data: videos, pagination: { page: parseInt(page), limit: parseInt(limit), total: totalRow?.count || 0 } };
  });

  // GET /api/v1/videos/:id
  fastify.get('/api/v1/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [video.dua_id]);
    return { ok: true, data: { ...video, dua } };
  });

  // POST /api/v1/videos
  fastify.post('/api/v1/videos', async (request, reply) => {
    const { dua_id, kind = 'long' } = request.body as any;
    if (!dua_id) { reply.code(400); return { ok: false, error: 'dua_id required' }; }
    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [dua_id]);
    if (!dua) { reply.code(404); return { ok: false, error: 'Dua not found' }; }
    const existing = selectOne('SELECT * FROM videos WHERE dua_id = ? AND kind = ?', [dua_id, kind]);
    if (existing) { reply.code(409); return { ok: false, error: 'Video already exists for this dua' }; }
const result = run('INSERT INTO videos (dua_id, kind, state) VALUES (?, ?, ?)', [dua_id, kind, 'not_started']);
    const created = selectOne('SELECT * FROM videos WHERE id = ?', [result.lastInsertRowid]);
    seedReviewFromLegacy(getDb(), dua_id, created.id);
    reply.code(201);
    return { ok: true, data: created };
  });

  // PATCH /api/v1/videos/:id
  fastify.patch('/api/v1/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const video = selectOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const allowed = ['state', 'video_id', 'render_files', 'published_at', 'schedule_at'];
    const sets: string[] = []; const vals: any[] = [];
    for (const k of allowed) { if (k in body && body[k] !== undefined) { sets.push(k + ' = ?'); vals.push(body[k]); } }
    if (sets.length === 0) return { ok: true, data: video };
    vals.push(id);
    run('UPDATE videos SET ' + sets.join(', ') + ' WHERE id = ?', vals);
    return { ok: true, data: selectOne('SELECT * FROM videos WHERE id = ?', [id]) };
  });

// POST /api/v1/videos/:id/render
  fastify.post('/api/v1/videos/:id/render', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const active = selectOne("SELECT * FROM jobs WHERE video_id = ? AND state IN ('queued','prep','render','qc','retry')", [id]);
    if (active) { reply.code(409); return { ok: false, error: 'Active job exists', data: active }; }
    const prev = selectOne("SELECT id FROM jobs WHERE video_id = ? AND type = 'render'", [id]);
    if (prev) {
      run("UPDATE jobs SET state = 'queued', progress = 0, error = NULL, payload = ? WHERE id = ?", [JSON.stringify({ dua_id: video.dua_id }), prev.id]);
      reply.code(201);
      return { ok: true, data: selectOne('SELECT * FROM jobs WHERE id = ?', [prev.id]) };
    }
    const result = run('INSERT INTO jobs (video_id, type, state, payload) VALUES (?, ?, ?, ?)', [id, 'render', 'queued', JSON.stringify({ dua_id: video.dua_id })]);
    const job = selectOne('SELECT * FROM jobs WHERE id = ?', [result.lastInsertRowid]);
    reply.code(201);
    return { ok: true, data: job };
  });

// POST /api/v1/videos/queue
  fastify.post('/api/v1/videos/queue', async (request, reply) => {
    const { video_ids } = request.body as { video_ids: number[] };
    if (!Array.isArray(video_ids) || !video_ids.length) { reply.code(400); return { ok: false, error: 'video_ids required' }; }
    let queued = 0; let skipped = 0;
for (const vid of video_ids) {
      const video = selectOne('SELECT * FROM videos WHERE id = ?', [vid]);
      if (!video) { skipped++; continue; }
      const active = selectOne("SELECT * FROM jobs WHERE video_id = ? AND state IN ('queued','prep','render','qc','retry')", [vid]);
      if (active) { skipped++; continue; }
      const prev = selectOne("SELECT id FROM jobs WHERE video_id = ? AND type = 'render'", [vid]);
      if (prev) {
        run("UPDATE jobs SET state = 'queued', progress = 0, error = NULL, payload = ? WHERE id = ?", [JSON.stringify({ dua_id: video.dua_id }), prev.id]);
      } else {
        run('INSERT INTO jobs (video_id, type, state, payload) VALUES (?, ?, ?, ?)', [vid, 'render', 'queued', JSON.stringify({ dua_id: video.dua_id })]);
      }
      queued++;
    }
    return { ok: true, data: { queued, skipped } };
  });

// GET /api/v1/jobs
  fastify.get('/api/v1/jobs', async (request) => {
    const { state, page = '1', limit = '50' } = request.query as any;
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];
    let tsql = 'SELECT COUNT(*) as count FROM jobs WHERE 1=1';
    const tparams: any[] = [];
    if (state) { sql += ' AND state = ?'; params.push(state); tsql += ' AND state = ?'; tparams.push(state); }
    sql += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const jobs = selectAll(sql, params);
    const totalRow = selectOne(tsql, tparams);
    return { ok: true, data: jobs, pagination: { page: parseInt(page), limit: parseInt(limit), total: totalRow?.count || 0 } };
  });

  // GET /api/v1/jobs/:id
  fastify.get('/api/v1/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = selectOne('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!job) { reply.code(404); return { ok: false, error: 'Job not found' }; }
    return { ok: true, data: job };
  });

  // POST /api/v1/jobs/:id/cancel
  fastify.post('/api/v1/jobs/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = selectOne('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!job) { reply.code(404); return { ok: false, error: 'Job not found' }; }
    if (!['queued', 'prep'].includes(job.state)) { reply.code(400); return { ok: false, error: 'Cannot cancel in current state' }; }
    run("UPDATE jobs SET state = 'failed', finished_at = datetime('now') WHERE id = ?", [id]);
    return { ok: true, message: 'Job cancelled' };
  });

// GET /api/v1/status
  fastify.get('/api/v1/status', async () => {
    const totalDuas = selectOne('SELECT COUNT(*) as count FROM duas');
    const totalVideos = selectOne('SELECT COUNT(*) as count FROM videos');
    const activeJobs = selectOne("SELECT COUNT(*) as count FROM jobs WHERE state IN ('queued','prep','render','qc','retry')");
    const growth = {
      schedules: selectOne("SELECT COUNT(*) as count FROM schedules WHERE status IN ('pending','scheduled')"),
      playlists: selectOne('SELECT COUNT(*) as count FROM playlists'),
      topics: selectOne("SELECT COUNT(*) as count FROM topics WHERE status = 'pending'"),
      capacityLeft: selectOne('SELECT (daily_caps - quota_used) as left FROM channels WHERE name = ?', ['channel1']),
    };
    return {
      ok: true,
      data: {
        version: '2.0.0', uptime: process.uptime(),
        stats: {
          duas: totalDuas?.count || 0, videos: totalVideos?.count || 0, activeJobs: activeJobs?.count || 0,
          schedules: growth.schedules?.count || 0, playlists: growth.playlists?.count || 0,
          topics: growth.topics?.count || 0, capacityLeft: growth.capacityLeft?.left ?? 10,
        },
      }
    };
  });
}
