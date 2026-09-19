import type { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';
import { listPlaylists, getPlaylist, setMemberStatus, manifestForPlaylist, importPlaylistsFromJson } from '../growth/playlists.js';
import path from 'path';

const DEFAULT_PLAN = () => path.resolve(process.cwd(), 'data', 'playlist_plan_channel1.json');

export default async function playlistsRoutes(fastify: FastifyInstance) {

  fastify.get('/api/v1/playlists', async () => {
    return { ok: true, data: listPlaylists(getDb()) };
  });

  fastify.get('/api/v1/playlists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const playlist = getPlaylist(getDb(), Number(id));
    if (!playlist) { reply.code(404); return { ok: false, error: 'Playlist not found' }; }
    return { ok: true, data: playlist };
  });

  fastify.post('/api/v1/playlists/sync', async (request, reply) => {
    const { path: filePath } = request.body as { path?: string };
    try {
      const result = importPlaylistsFromJson(getDb(), filePath || DEFAULT_PLAN());
      return { ok: true, data: result };
    } catch (err: any) {
      reply.code(404);
      return { ok: false, error: err.message };
    }
  });

  fastify.patch('/api/v1/playlists/members/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    if (!status) { reply.code(400); return { ok: false, error: 'status required' }; }
    try {
      return { ok: true, data: setMemberStatus(getDb(), Number(id), status) };
    } catch (err: any) {
      reply.code(err.message.includes('not found') ? 404 : 400);
      return { ok: false, error: err.message };
    }
  });

  fastify.get('/api/v1/playlists/:id/manifest', async (request, reply) => {
    const { id } = request.params as { id: string };
    const manifest = manifestForPlaylist(getDb(), Number(id));
    if (!manifest) { reply.code(404); return { ok: false, error: 'Playlist not found' }; }
    return { ok: true, data: manifest };
  });
}