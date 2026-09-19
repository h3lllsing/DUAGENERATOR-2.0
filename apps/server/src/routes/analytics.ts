import type { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';
import { overview, underperformers, upsertMetrics, importMetricsFromFile } from '../growth/analytics.js';
import path from 'path';

const MANUAL_FILE = () => path.resolve(process.cwd(), 'data', 'analytics_manual.json');

export default async function analyticsRoutes(fastify: FastifyInstance) {

  fastify.get('/api/v1/analytics/overview', async () => {
    return { ok: true, data: overview(getDb()) };
  });

  fastify.get('/api/v1/analytics/underperformers', async () => {
    return { ok: true, data: underperformers(getDb()) };
  });

  fastify.post('/api/v1/analytics/metrics', async (request, reply) => {
    const { rows } = request.body as { rows?: any[] };
    if (!Array.isArray(rows) || !rows.length) { reply.code(400); return { ok: false, error: 'rows array required' }; }
    const n = upsertMetrics(getDb(), rows);
    return { ok: true, data: { imported: n } };
  });

  fastify.post('/api/v1/analytics/import', async (request, reply) => {
    const { path: filePath } = request.body as { path?: string };
    try {
      const n = importMetricsFromFile(getDb(), filePath || MANUAL_FILE());
      return { ok: true, data: { imported: n } };
    } catch (err: any) {
      reply.code(404);
      return { ok: false, error: err.message };
    }
  });
}