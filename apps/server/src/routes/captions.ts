import type { FastifyInstance } from 'fastify';
import { selectOne, run } from '../db.js';

export default async function captionsRoutes(fastify: FastifyInstance) {

  // GET /api/v1/videos/:id/captions — get EN caption text
  fastify.get('/api/v1/videos/:id/captions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT id, caption_en FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    return { ok: true, data: { caption_en: video.caption_en } };
  });

  // PUT /api/v1/videos/:id/captions — update EN caption (edit-in-place)
  fastify.put('/api/v1/videos/:id/captions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { caption_en } = request.body as { caption_en: string };
    if (caption_en === undefined) { reply.code(400); return { ok: false, error: 'caption_en required' }; }

    const video = selectOne('SELECT id FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    run('UPDATE videos SET caption_en = ? WHERE id = ?', [caption_en, id]);
    return { ok: true, data: { caption_en } };
  });

  // POST /api/v1/videos/:id/captions/from-srt — import from SRT file path
  fastify.post('/api/v1/videos/:id/captions/from-srt', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { srt_path } = request.body as { srt_path: string };
    if (!srt_path) { reply.code(400); return { ok: false, error: 'srt_path required' }; }

    const video = selectOne('SELECT id FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }

    try {
      const fs = await import('fs');
      if (!fs.existsSync(srt_path)) { reply.code(404); return { ok: false, error: 'SRT file not found' }; }
      const srtContent = fs.readFileSync(srt_path, 'utf-8');
      // Parse SRT to plain text (strip timestamps and indices)
      const text = srtContent
        .replace(/\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}\s*\n/g, '')
        .replace(/\n{2,}/g, '\n')
        .trim();
      run('UPDATE videos SET caption_en = ? WHERE id = ?', [text, id]);
      return { ok: true, data: { caption_en: text, source: srt_path } };
    } catch (err: any) {
      reply.code(500);
      return { ok: false, error: 'Failed to read SRT: ' + err.message };
    }
  });

  // POST /api/v1/videos/:id/captions/preview — generate preview HTML
  fastify.post('/api/v1/videos/:id/captions/preview', { body: false }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = selectOne('SELECT id, caption_en FROM videos WHERE id = ?', [id]);
    if (!video) { reply.code(404); return { ok: false, error: 'Video not found' }; }
    const text = video.caption_en || '';
    const lines = text.split('\n').filter((l: string) => l.trim());
    const preview = lines.map((line: string, i: number) => `<span class="caption-line" data-idx="${i}">${escHtml(line)}</span>`).join('<br>');
    return { ok: true, data: { preview, line_count: lines.length } };
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
