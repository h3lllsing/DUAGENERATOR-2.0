import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { selectAll, selectOne, run } from '../db.js';

const DuaSchema = z.object({
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  title_en: z.string().max(500).optional(),
  urdu: z.string().optional(),
  arabic: z.string().optional(),
  english: z.string().optional(),
  explanation: z.string().optional(),
  reference: z.string().min(1).max(1000),
  category: z.string().max(100).optional(),
  part: z.string().max(100).optional(),
  source: z.string().max(50).optional()
});

const DuaUpdateSchema = DuaSchema.partial();

export default async function duasRoutes(fastify: FastifyInstance) {

  // GET /api/v1/duas
  fastify.get('/api/v1/duas', async (request) => {
    const { category, status, page = '1', limit = '50' } = request.query as any;
    let sql = 'SELECT * FROM duas WHERE 1=1';
    const params: any[] = [];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY id ASC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const duas = selectAll(sql, params);
    const totalRow = selectOne('SELECT COUNT(*) as count FROM duas');
    return { ok: true, data: duas, pagination: { page: parseInt(page), limit: parseInt(limit), total: totalRow?.count || 0 } };
  });

  // GET /api/v1/duas/:id
  fastify.get('/api/v1/duas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const dua = selectOne('SELECT * FROM duas WHERE id = ? OR slug = ?', [id, id]);
    if (!dua) { reply.code(404); return { ok: false, error: 'Dua not found' }; }
    return { ok: true, data: dua };
  });

  // POST /api/v1/duas
  fastify.post('/api/v1/duas', async (request, reply) => {
    const parsed = DuaSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { ok: false, error: parsed.error.issues }; }
    const d = parsed.data;
    const existing = selectOne('SELECT id FROM duas WHERE slug = ?', [d.slug]);
    if (existing) { reply.code(409); return { ok: false, error: 'Slug already exists' }; }
    const result = run(
      'INSERT INTO duas (slug,title,title_en,urdu,arabic,english,explanation,reference,category,part,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [d.slug, d.title, d.title_en||null, d.urdu||null, d.arabic||null, d.english||null, d.explanation||null, d.reference, d.category||null, d.part||null, d.source||null]
    );
    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [result.lastInsertRowid]);
    reply.code(201);
    return { ok: true, data: dua };
  });

  // PATCH /api/v1/duas/:id
  fastify.patch('/api/v1/duas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = DuaUpdateSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { ok: false, error: parsed.error.issues }; }
    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [id]);
    if (!dua) { reply.code(404); return { ok: false, error: 'Dua not found' }; }
    const updates = parsed.data;
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) { setClauses.push(key + ' = ?'); values.push(value); }
    }
    if (setClauses.length === 0) return { ok: true, data: dua };
    values.push(id);
    run('UPDATE duas SET ' + setClauses.join(', ') + ' WHERE id = ?', values);
    return { ok: true, data: selectOne('SELECT * FROM duas WHERE id = ?', [id]) };
  });

  // DELETE /api/v1/duas/:id (soft delete)
  fastify.delete('/api/v1/duas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [id]);
    if (!dua) { reply.code(404); return { ok: false, error: 'Dua not found' }; }
    run('UPDATE duas SET status = ? WHERE id = ?', ['draft', id]);
    return { ok: true, message: 'Dua deleted (soft)' };
  });

  // GET /api/v1/duas/:id/review
  fastify.get('/api/v1/duas/:id/review', async (request) => {
    const { id } = request.params as { id: string };
    return { ok: true, data: selectAll('SELECT * FROM review WHERE video_id = ?', [id]) };
  });

  // GET /api/v1/trash
  fastify.get('/api/v1/trash', async () => {
    return { ok: true, data: selectAll('SELECT * FROM duas WHERE status = ? ORDER BY updated_at DESC', ['draft']) };
  });

  // POST /api/v1/trash/restore/:id
  fastify.post('/api/v1/trash/restore/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [id]);
    if (!dua) { reply.code(404); return { ok: false, error: 'Dua not found' }; }
    run('UPDATE duas SET status = ? WHERE id = ?', ['draft', id]);
    return { ok: true, message: 'Dua restored' };
  });
}
