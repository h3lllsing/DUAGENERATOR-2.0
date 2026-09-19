import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [capacity, setCapacity] = useState<any>(null);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  const [videoId, setVideoId] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [note, setNote] = useState('');

  const monthKey = new Date().toISOString().slice(0, 7);

  function refresh() {
    api.getSchedules().then(r => setSchedules(r.data)).catch(e => setErr(String(e)));
    api.getCapacity().then(r => setCapacity(r.data)).catch(e => setErr(String(e)));
    api.getCalendar(monthKey).then(r => setCalendar(r.data)).catch(() => {});
  }

  useEffect(() => {
    refresh();
    api.getVideos({}).then(r => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.videos || []);
      setVideos(list);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const next30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const countFor = (day: string) => calendar.find(c => c.d === day)?.c || 0;

  async function create() {
    setMsg(''); setErr('');
    if (!videoId || !publishAt) { setErr('Select a video and pick a date/time'); return; }
    try {
      const iso = new Date(publishAt).toISOString();
      await api.createSchedule({ video_id: Number(videoId), publish_at: iso, note: note || undefined });
      setVideoId(''); setPublishAt(''); setNote('');
      refresh();
      setMsg('Schedule created');
    } catch (e: any) { setErr(String(e)); }
  }

  async function runCheck() {
    setErr(''); setMsg('');
    try {
      const r = await api.runPublishCheck();
      setMsg(`Publish check: ${r.data.dispatched} dispatched, ${r.data.skipped} skipped`);
      refresh();
    } catch (e: any) { setErr(String(e)); }
  }

  async function patch(id: number, data: any) {
    try { await api.updateSchedule(id, data); refresh(); } catch (e: any) { setErr(String(e)); }
  }

  async function remove(id: number) {
    try { await api.deleteSchedule(id); refresh(); } catch (e: any) { setErr(String(e)); }
  }

  const remaining = capacity ? capacity.daily_caps - capacity.quota_used : null;

  return (
    <div className="page">
      <h1>Publishing Scheduler</h1>

      {capacity && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{remaining}</div>
            <div className="stat-label">Remaining Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{capacity.quota_used}/{capacity.daily_caps}</div>
            <div className="stat-label">Used / Daily Cap</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{capacity.quota_date}</div>
            <div className="stat-label">Quota Day (PT)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{schedules.length}</div>
            <div className="stat-label">Total Schedules</div>
          </div>
        </div>
      )}

      <div className="studio-toolbar">
        <button className="btn-primary" onClick={runCheck}>Run publish check now</button>
        <span className="hint">Publish worker runs every {capacity ? '15' : '15'}s configured — uploads only proceed under quota.</span>
      </div>

      <h2>Next 30 days</h2>
      <div className="pillars-grid" style={{ gap: 6 }}>
        {next30.map(day => (
          <span key={day} className={`tag ${countFor(day) ? 'dist-count' : ''}`} title={day}>
            {day.slice(5)} · {countFor(day)}
          </span>
        ))}
      </div>

      <h2>New schedule</h2>
      <div className="form-group">
        <label>Video (dua to publish)</label>
        <select className="wide" value={videoId} onChange={e => setVideoId(e.target.value)}>
          <option value="">— select video —</option>
          {videos.map((v: any) => (
            <option key={v.id} value={v.id}>#{v.id} {v.dua_title || v.title || v.slug || ''} ({v.video_id || 'no yid'})</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Publish datetime (local = PKT)</label>
        <input type="datetime-local" className="wide" value={publishAt} onChange={e => setPublishAt(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Note</label>
        <input className="wide" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Ramadan series ep 12" />
      </div>
      <button className="btn-primary" onClick={create}>Schedule publish</button>

      <h2>All schedules</h2>
      {schedules.length === 0 ? (
        <div className="empty-state">No schedules yet — add one above</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Dua</th><th>Video</th><th>Publish at</th><th>Status</th><th>Note</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.dua_title || s.dua_slug || '—'}</td>
                  <td>#{s.video_id} {s.yid || ''}</td>
                  <td>{s.publish_at ? new Date(s.publish_at).toLocaleString() : '—'}</td>
                  <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                  <td>{s.note || '—'}</td>
                  <td>
                    <div className="actions-cell">
                      {s.status !== 'published' && <button onClick={() => patch(s.id, { status: 'published' })}>Mark published</button>}
                      {s.status !== 'pending' && <button onClick={() => patch(s.id, { status: 'pending' })}>Un-schedule</button>}
                      <button onClick={() => remove(s.id)} className="btn-reject">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {msg && <div className="success">{msg}</div>}
      {err && <div className="error">{err}</div>}
    </div>
  );
}