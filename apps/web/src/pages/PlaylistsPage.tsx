import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  function refresh() {
    api.getPlaylists().then(r => setPlaylists(r.data)).catch(e => setErr(String(e)));
  }

  useEffect(() => { refresh(); }, []);

  async function sync() {
    setMsg(''); setErr('');
    try {
      const r = await api.syncPlaylists();
      setMsg(`Synced ${r.data.playlists} playlists / ${r.data.members} members from playlist_plan_channel1.json`);
      refresh();
    } catch (e: any) { setErr(String(e)); }
  }

  async function openDetail(id: number) {
    setOpen(id);
    setDetail(null); setManifest(null);
    try {
      const r = await api.getPlaylist(id);
      setDetail(r.data);
    } catch (e: any) { setErr(String(e)); }
  }

  async function loadManifest(id: number) {
    try {
      const r = await api.getPlaylistManifest(id);
      setManifest(r.data);
    } catch (e: any) { setErr(String(e)); }
  }

  async function setStatus(memberId: number, status: string) {
    try {
      await api.setMemberStatus(memberId, status);
      if (open) openDetail(open);
      refresh();
    } catch (e: any) { setErr(String(e)); }
  }

  return (
    <div className="page">
      <h1>Playlists</h1>

      <div className="studio-toolbar">
        <button className="btn-primary" onClick={sync}>Sync from playlist_plan_channel1.json</button>
      </div>

      {playlists.length === 0 ? (
        <div className="empty-state">No playlists yet — click "Sync from playlist_plan_channel1.json"</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Title</th><th>Members</th><th>Done</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.title} <small style={{ color: 'var(--text-dim)' }}>({p.key})</small></td>
                  <td>{p.member_count}</td>
                  <td>{p.done_count}/{p.member_count}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  <td>
                    <div className="actions-cell">
                      <button onClick={() => openDetail(p.id)}>Members</button>
                      <button onClick={() => loadManifest(p.id)}>Share URL list</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open !== null && detail && (
        <>
          <h2>Members — {detail.title}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Dua slug</th><th>Title</th><th>Video URL</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {detail.members.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.dua_slug}</td>
                    <td>{m.dua_title || '—'}</td>
                    <td>
                      {m.video_yid
                        ? <a href={'https://www.youtube.com/watch?v=' + m.video_yid} target="_blank" rel="noreferrer">{m.video_yid}</a>
                        : <span className="tag badge-skipped">missing video</span>}
                    </td>
                    <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                    <td>
                      <div className="actions-cell">
                        {m.status !== 'added' && <button onClick={() => setStatus(m.id, 'added')}>Mark added</button>}
                        {m.status !== 'skipped' && <button onClick={() => setStatus(m.id, 'skipped')}>Skip</button>}
                        <button onClick={() => setStatus(m.id, 'pending')}>Reset</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {manifest && (
        <>
          <h2>Share URL list — {manifest.title}</h2>
          <div className="success">
            {manifest.total} entries, {manifest.missingVideos} missing video URLs
          </div>
          <textarea className="wide" readOnly rows={12} value={manifest.manifest} />
        </>
      )}

      {msg && <div className="success">{msg}</div>}
      {err && <div className="error">{err}</div>}
    </div>
  );
}