import type { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';
import { listTopics, addTopic, addSuggestedTopics, setTopicStatus, suggestTopics } from '../growth/topics.js';

export default async function topicsRoutes(fastify: FastifyInstance) {

  fastify.get('/api/v1/topics', async (request) => {
    const { status } = request.query as any;
    return { ok: true, data: listTopics(getDb(), status) };
  });

  fastify.post('/api/v1/topics', async (request, reply) => {
    const { keyword, source = 'manual' } = request.body as { keyword?: string; source?: string };
    if (!keyword || !keyword.trim()) { reply.code(400); return { ok: false, error: 'keyword required' }; }
    const topic = addTopic(getDb(), keyword, source);
    return { ok: true, data: topic };
  });

  fastify.post('/api/v1/topics/suggest', async (request) => {
    const { limit } = request.body as { limit?: number };
    const suggestions = suggestTopics(getDb(), limit || 10);
    const result = addSuggestedTopics(getDb(), suggestions);
    return { ok: true, data: { ...result, suggestions } };
  });

  fastify.patch('/api/v1/topics/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    if (!status) { reply.code(400); return { ok: false, error: 'status required' }; }
    try {
      return { ok: true, data: setTopicStatus(getDb(), Number(id), status) };
    } catch (err: any) {
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  fastify.delete('/api/v1/topics/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(id);
    if (!topic) { reply.code(404); return { ok: false, error: 'Topic not found' }; }
    db.prepare('DELETE FROM topics WHERE id = ?').run(id);
    return { ok: true, message: 'Topic deleted' };
  });
}