import type { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';
import { buildSharePayload } from '../growth/sharekit.js';

export default async function sharekitRoutes(fastify: FastifyInstance) {

  fastify.get('/api/v1/share/:yid', async (request, reply) => {
    const { yid } = request.params as { yid: string };
    const db = getDb();
    const video: any = db.prepare('SELECT * FROM videos WHERE video_id = ?').get(yid) || db.prepare('SELECT * FROM videos WHERE id = ?').get(yid);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const dua: any = video.dua_id ? db.prepare('SELECT * FROM duas WHERE id = ?').get(video.dua_id) : null;
    return { ok: true, data: buildSharePayload(video, dua) };
  });

  fastify.get('/api/v1/videos/:id/share', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const video: any = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const dua: any = video.dua_id ? db.prepare('SELECT * FROM duas WHERE id = ?').get(video.dua_id) : null;
    return { ok: true, data: buildSharePayload(video, dua) };
  });
}