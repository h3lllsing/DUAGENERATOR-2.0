import type { FastifyInstance } from 'fastify';
import { selectOne, run } from '../db.js';
import fs from 'fs';
import path from 'path';

const THUMB_DIR = path.resolve(process.cwd(), 'data', 'thumbnails');

export default async function thumbnailsRoutes(fastify: FastifyInstance) {

  // GET /api/v1/videos/:id/thumbs — get thumbnail set for a video
  fastify.get('/api/v1/videos/:id/thumbs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT id, thumbs FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const thumbs = video.thumbs ? JSON.parse(video.thumbs) : { a: null, b: null };
    return { ok: true, data: thumbs };
  });

  // POST /api/v1/videos/:id/thumbs — set a thumbnail (variant: 'a' or 'b')
  fastify.post('/api/v1/videos/:id/thumbs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { variant = 'a', thumb_path } = request.body as { variant?: string; thumb_path: string };
    if (!['a', 'b'].includes(variant)) { reply.code(400); return { ok: false, error: 'variant must be a or b' }; }
    if (!thumb_path) { reply.code(400); return { ok: false, error: 'thumb_path required' }; }

    const video = selectOne('SELECT id, thumbs FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    const existing = video.thumbs ? JSON.parse(video.thumbs) : { a: null, b: null };
    existing[variant] = { path: thumb_path, set_at: new Date().toISOString() };

    run('UPDATE videos SET thumbs = ? WHERE id = ?', [JSON.stringify(existing), id]);
    return { ok: true, data: existing };
  });

  // DELETE /api/v1/videos/:id/thumbs/:variant — remove a thumbnail variant
  fastify.delete('/api/v1/videos/:id/thumbs/:variant', async (request, reply) => {
    const { id, variant } = request.params as { id: string; variant: string };
    if (!['a', 'b'].includes(variant)) { reply.code(400); return { ok: false, error: 'variant must be a or b' }; }

    const video = selectOne('SELECT id, thumbs FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    const existing = video.thumbs ? JSON.parse(video.thumbs) : { a: null, b: null };
    existing[variant] = null;

    run('UPDATE videos SET thumbs = ? WHERE id = ?', [JSON.stringify(existing), id]);
    return { ok: true, data: existing };
  });

  // POST /api/v1/videos/:id/thumbs/swap — swap A/B thumbnails
  fastify.post('/api/v1/videos/:id/thumbs/swap', { body: false }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT id, thumbs FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    const existing = video.thumbs ? JSON.parse(video.thumbs) : { a: null, b: null };
    const temp = existing.a;
    existing.a = existing.b;
    existing.b = temp;

    run('UPDATE videos SET thumbs = ? WHERE id = ?', [JSON.stringify(existing), id]);
    return { ok: true, data: existing };
  });
}
