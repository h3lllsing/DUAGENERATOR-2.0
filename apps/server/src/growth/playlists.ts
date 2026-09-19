import type Database from 'better-sqlite3';
import fs from 'fs';

export function importPlaylistsFromJson(db: Database.Database, filePath: string, channelId?: number): { playlists: number; members: number } {
  if (!fs.existsSync(filePath)) throw new Error('Playlist plan file not found: ' + filePath);
  const plan = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const playlists = Array.isArray(plan.playlists) ? plan.playlists : [];
  let playlistsImported = 0;
  let membersImported = 0;

  const upsertPlaylist = db.prepare(`
    INSERT INTO playlists (key, title, channel_id, member_count, status) VALUES (?, ?, ?, ?, 'active')
    ON CONFLICT(key) DO UPDATE SET title = excluded.title, channel_id = excluded.channel_id, member_count = excluded.member_count, updated_at = datetime('now')
  `);
  const getPlaylist = db.prepare('SELECT id FROM playlists WHERE key = ?');
  const getMember = db.prepare('SELECT id FROM playlist_members WHERE playlist_id = ? AND dua_slug = ?');
  const insertMember = db.prepare(`
    INSERT INTO playlist_members (playlist_id, dua_id, dua_slug, video_yid, title, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);
  const updateMember = db.prepare('UPDATE playlist_members SET dua_id = ?, video_yid = ?, title = ? WHERE id = ?');
  const getDuaBySlug = db.prepare('SELECT id FROM duas WHERE slug = ?');

  for (const pl of playlists) {
    if (!pl.key || !pl.title) continue;
    upsertPlaylist.run(pl.key, pl.title, channelId ?? null, (pl.members || []).length);
    const plRow = getPlaylist.get(pl.key) as any;
    playlistsImported++;
    for (const m of pl.members || []) {
      if (!m.dua_id) continue;
      const slug = 'dua-' + String(m.dua_id).replace(/_/g, '-');
      const duaRow = getDuaBySlug.get(slug) as any;
      const existing = getMember.get(plRow.id, slug) as any;
      if (existing) {
        updateMember.run(duaRow ? duaRow.id : null, m.video_id || null, m.title || null, existing.id);
      } else {
        insertMember.run(plRow.id, duaRow ? duaRow.id : null, slug, m.video_id || null, m.title || null);
      }
      membersImported++;
    }
  }

  db.prepare('UPDATE playlists SET added_count = (SELECT COUNT(*) FROM playlist_members pm WHERE pm.playlist_id = playlists.id AND pm.status = \'added\')').run();
  return { playlists: playlistsImported, members: membersImported };
}

export function listPlaylists(db: Database.Database): any[] {
  return db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM playlist_members pm WHERE pm.playlist_id = p.id AND pm.status = 'added') as done_count
    FROM playlists p ORDER BY p.member_count DESC
  `).all() as any[];
}

export function getPlaylist(db: Database.Database, id: number): any {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as any;
  if (!playlist) return null;
  const members = db.prepare(`
    SELECT pm.*, d.slug as dua_slug_resolved, COALESCE(d.title, pm.title) as dua_title, d.reference
    FROM playlist_members pm LEFT JOIN duas d ON d.id = pm.dua_id
    WHERE pm.playlist_id = ? ORDER BY pm.id ASC
  `).all(id);
  return { ...playlist, members };
}

export function setMemberStatus(db: Database.Database, memberId: number, status: string): any {
  if (!['pending', 'added', 'skipped'].includes(status)) throw new Error('Invalid status');
  const member = db.prepare('SELECT playlist_id FROM playlist_members WHERE id = ?').get(memberId) as any;
  if (!member) throw new Error('Member not found');
  db.prepare('UPDATE playlist_members SET status = ?, added_at = CASE WHEN ? = \'added\' THEN datetime(\'now\') ELSE null END WHERE id = ?').run(status, status, memberId);
  db.prepare(`UPDATE playlists SET added_count = (SELECT COUNT(*) FROM playlist_members pm WHERE pm.playlist_id = ? AND pm.status = 'added'), status = CASE WHEN ? = 'done' THEN 'done' ELSE status END WHERE id = ?`).run(member.playlist_id, status, member.playlist_id);
  return db.prepare('SELECT * FROM playlist_members WHERE id = ?').get(memberId);
}

export function manifestForPlaylist(db: Database.Database, id: number): any {
  const playlist = getPlaylist(db, id);
  if (!playlist) return null;
  const lines = playlist.members.map((m: any) =>
    (m.video_yid ? 'https://www.youtube.com/watch?v=' + m.video_yid : 'MISSING_VIDEO') + '\t' + (m.dua_title || m.dua_slug)
  );
  return {
    playlistId: playlist.id,
    key: playlist.key,
    title: playlist.title,
    total: playlist.members.length,
    missingVideos: playlist.members.filter((m: any) => !m.video_yid).length,
    manifest: lines.join('\n'),
  };
}