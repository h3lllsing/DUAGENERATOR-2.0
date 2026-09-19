import type { FastifyInstance } from 'fastify';
import { getDb, selectOne } from '../db.js';
import { createSchedule, updateSchedule, runPublishCheck, calendarCounts, listSchedules } from '../growth/scheduler.js';
import { getDefaultChannelId } from '../growth/quota.js';

export default async function schedulesRoutes(fastify: FastifyInstance) {

  fastify.get('/api/v1/schedules', async (request) => {
    const { status } = request.query as any;
    return { ok: true, data: listSchedules(getDb(), status) };
  });

  fastify.get('/api/v1/schedules/calendar', async (request) => {
    const { month } = request.query as any;
    const monthKey = month || new Date().toISOString().slice(0, 7);
    return { ok: true, data: calendarCounts(getDb(), monthKey) };
  });

  fastify.post('/api/v1/schedules', async (request, reply) => {
    const { video_id, publish_at, channel_id, note, status = 'scheduled' } = request.body as any;
    if (!video_id) { reply.code(400); return { ok: false, error: 'video_id required' }; }
    if (!publish_at) { reply.code(400); return { ok: false, error: 'publish_at required' }; }
    try {
      return { ok: true, data: createSchedule(getDb(), video_id, publish_at, channel_id ?? null, note, status) };
    } catch (err: any) {
      if (String(err.message).includes('Video not found')) { reply.code(404); }
      else { reply.code(400); }
      return { ok: false, error: err.message };
    }
  });

  fastify.patch('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return { ok: true, data: updateSchedule(getDb(), Number(id), request.body as any) };
    } catch (err: any) {
      reply.code(err.message.includes('not found') ? 404 : 400);
      return { ok: false, error: err.message };
    }
  });

  fastify.delete('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const sched = db.prepare('SELECT id FROM schedules WHERE id = ?').get(id);
    if (!sched) { reply.code(404); return { ok: false, error: 'Schedule not found' }; }
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return { ok: true, message: 'Schedule deleted' };
  });

  fastify.post('/api/v1/schedules/run-check', async () => {
    const result = runPublishCheck(getDb());
    return { ok: true, data: result };
  });

  fastify.get('/api/v1/schedules/capacity', async () => {
    const db = getDb();
    const channelId = selectOne('SELECT id FROM channels WHERE name = ?', ['channel1']) as any;
    const chRow = db.prepare('SELECT id, name, daily_caps, quota_used, quota_date FROM channels WHERE id = ?').get(channelId?.id || getDefaultChannelId(db));
    return { ok: true, data: chRow };
  });
}