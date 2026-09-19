import type { FastifyInstance } from 'fastify';
import { selectOne, selectAll, run } from '../db.js';

// Approval workflow states (ordered)
const WORKFLOW_STATES = ['draft', 'qc_passed', 'en_review', 'approved', 'published'];

export default async function reviewRoutes(fastify: FastifyInstance) {

  // GET /api/v1/videos/:id/review — get all review entries for a video
  fastify.get('/api/v1/videos/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT id, state FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const reviews = selectAll('SELECT * FROM review WHERE video_id = ?', [id]);
    return { ok: true, data: { video_state: video.state, reviews } };
  });

  // POST /api/v1/videos/:id/review — create or update a review entry
  fastify.post('/api/v1/videos/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { kind = 'en', status = 'pending', note, edited_text } = request.body as {
      kind?: string; status?: string; note?: string; edited_text?: string;
    };

    const video = selectOne('SELECT id, state FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    // Check if review entry exists
    const existing = selectOne('SELECT id FROM review WHERE video_id = ? AND kind = ?', [id, kind]);

    if (existing) {
      const sets: string[] = ['status = ?', 'ts_updated = datetime(\'now\')'];
      const vals: any[] = [status];
      if (note !== undefined) { sets.push('note = ?'); vals.push(note); }
      if (edited_text !== undefined) { sets.push('edited_text = ?'); vals.push(edited_text); }
      vals.push(existing.id);
      run('UPDATE review SET ' + sets.join(', ') + ' WHERE id = ?', vals);
    } else {
      run(
        'INSERT INTO review (video_id, kind, status, note, edited_text) VALUES (?, ?, ?, ?, ?)',
        [id, kind, status, note || null, edited_text || null]
      );
    }

    // Auto-transition video state based on review
    if (kind === 'en' && status === 'approved' && video.state === 'qc_passed') {
      run("UPDATE videos SET state = 'en_review' WHERE id = ?", [id]);
    }

    const review = selectOne('SELECT * FROM review WHERE video_id = ? AND kind = ?', [id, kind]);
    return { ok: true, data: review };
  });

  // POST /api/v1/videos/:id/approve — advance workflow state
  fastify.post('/api/v1/videos/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { approved_by = 'system' } = request.body as { approved_by?: string };

    const video = selectOne('SELECT id, state FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    const currentIdx = WORKFLOW_STATES.indexOf(video.state);
    if (currentIdx === -1 || currentIdx >= WORKFLOW_STATES.length - 1) {
      reply.code(400);
      return { ok: false, error: `Cannot advance from state: ${video.state}` };
    }

    // Gate: en_review requires approved EN review before advancing to approved
    if (video.state === 'en_review') {
      const enReview = selectOne("SELECT * FROM review WHERE video_id = ? AND kind = 'en'", [id]);
      if (!enReview || enReview.status !== 'approved') {
        reply.code(400);
        return { ok: false, error: 'EN review must be approved before advancing to approved' };
      }
    }

    const nextState = WORKFLOW_STATES[currentIdx + 1];
    const updates: string[] = ['state = ?'];
    const vals: any[] = [nextState];

    if (nextState === 'approved') {
      updates.push('approved_by = ?');
      vals.push(approved_by);
      updates.push("approved_at = datetime('now')");
    }

    vals.push(id);
    run('UPDATE videos SET ' + updates.join(', ') + ' WHERE id = ?', vals);

    return { ok: true, data: selectOne('SELECT * FROM videos WHERE id = ?', [id]) };
  });

  // POST /api/v1/videos/:id/reject — reject and send back
  fastify.post('/api/v1/videos/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    const video = selectOne('SELECT id, state FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    // Can only reject from en_review or approved states
    if (!['en_review', 'approved'].includes(video.state)) {
      reply.code(400);
      return { ok: false, error: `Cannot reject from state: ${video.state}` };
    }

    run("UPDATE videos SET state = 'qc_passed' WHERE id = ?", [id]);
    run("UPDATE review SET status = 'rejected', note = ? WHERE video_id = ? AND kind = 'en'", [reason || 'Rejected', id]);

    return { ok: true, data: selectOne('SELECT * FROM videos WHERE id = ?', [id]) };
  });

  // GET /api/v1/review/queue — list videos needing review
  fastify.get('/api/v1/review/queue', async () => {
    const videos = selectAll(`
      SELECT v.*, d.title as dua_title, d.reference as dua_reference
      FROM videos v JOIN duas d ON v.dua_id = d.id
      WHERE v.state IN ('qc_passed', 'en_review')
      ORDER BY v.id ASC
    `);
    return { ok: true, data: videos };
  });
}
