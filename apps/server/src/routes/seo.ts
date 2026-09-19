import type { FastifyInstance } from 'fastify';
import { selectOne, selectAll, run } from '../db.js';

const CATEGORY_PILLARS = [
  'salah', 'dua', 'quran', 'hadith', 'deen', 'akhlaq', 'tawbah', 'shukr',
  'sabr', 'tawakkul', 'zikr', 'ilm', 'ramadan', 'hajj', 'family', 'health',
  'protection', 'forgiveness', 'guidance', 'barakah'
];

export default async function seoRoutes(fastify: FastifyInstance) {

  // GET /api/v1/videos/:id/seo — get SEO data for a video
  fastify.get('/api/v1/videos/:id/seo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT id, seo_title, seo_description, seo_tags, seo_hashtags FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    return {
      ok: true,
      data: {
        seo_title: video.seo_title,
        seo_description: video.seo_description,
        seo_tags: video.seo_tags ? JSON.parse(video.seo_tags) : [],
        seo_hashtags: video.seo_hashtags ? JSON.parse(video.seo_hashtags) : []
      }
    };
  });

  // PATCH /api/v1/videos/:id/seo — update SEO fields
  fastify.patch('/api/v1/videos/:id/seo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const video = selectOne('SELECT id FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    const sets: string[] = [];
    const vals: any[] = [];
    if (body.seo_title !== undefined) { sets.push('seo_title = ?'); vals.push(body.seo_title); }
    if (body.seo_description !== undefined) { sets.push('seo_description = ?'); vals.push(body.seo_description); }
    if (body.seo_tags !== undefined) { sets.push('seo_tags = ?'); vals.push(JSON.stringify(body.seo_tags)); }
    if (body.seo_hashtags !== undefined) { sets.push('seo_hashtags = ?'); vals.push(JSON.stringify(body.seo_hashtags)); }

    if (sets.length === 0) return { ok: true, data: video };
    vals.push(id);
    run('UPDATE videos SET ' + sets.join(', ') + ' WHERE id = ?', vals);
    return { ok: true, data: selectOne('SELECT id, seo_title, seo_description, seo_tags, seo_hashtags FROM videos WHERE id = ?', [id]) };
  });

  // GET /api/v1/seo/pillars — list category pillars
  fastify.get('/api/v1/seo/pillars', async () => {
    return { ok: true, data: CATEGORY_PILLARS };
  });

  // GET /api/v1/seo/pillars/distribution — count duas per pillar
  fastify.get('/api/v1/seo/pillars/distribution', async () => {
    const rows = selectAll('SELECT category, COUNT(*) as count FROM duas WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC');
    return { ok: true, data: rows };
  });

  // POST /api/v1/seo/suggest — suggest tags/hashtags from dua content
  fastify.post('/api/v1/seo/suggest', async (request, reply) => {
    const { dua_id } = request.body as { dua_id: number };
    if (!dua_id) { reply.code(400); return { ok: false, error: 'dua_id required' }; }

    const dua = selectOne('SELECT * FROM duas WHERE id = ?', [dua_id]);
    if (!dua) { reply.code(404); return { ok: false, error: 'Dua not found' }; }

    // Suggest tags from reference, category, and title
    const tags: string[] = [];
    const hashtags: string[] = [];

    if (dua.source) tags.push(dua.source);
    if (dua.category) { tags.push(dua.category); hashtags.push('#' + dua.category.toLowerCase().replace(/\s+/g, '')); }
    if (dua.reference) {
      const refTags = dua.reference.match(/[\w\s]+(?=\s*\d)/g) || [];
      refTags.forEach((t: string) => tags.push(t.trim()));
    }
    // Add common Islamic hashtags
    const baseTags = ['#islam', '#dua', '#muslim', '#quran', '#hadith'];
    hashtags.push(...baseTags);

    return { ok: true, data: { tags: [...new Set(tags)].slice(0, 15), hashtags: [...new Set(hashtags)].slice(0, 15) } };
  });
}
