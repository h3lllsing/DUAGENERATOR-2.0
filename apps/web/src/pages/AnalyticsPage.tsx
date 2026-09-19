import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [under, setUnder] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  function refresh() {
    api.getAnalyticsOverview().then(r => setOverview(r.data)).catch(e => setErr(String(e)));
    api.getUnderperformers().then(r => setUnder(r.data)).catch(e => setErr(String(e)));
  }

  useEffect(() => { refresh(); }, []);

  async function importManual() {
    setMsg(''); setErr('');
    try {
      const r = await api.importAnalytics();
      setMsg(`Imported ${r.data.imported} metric rows from data/analytics_manual.json`);
      refresh();
    } catch (e: any) { setErr(String(e)); }
  }

  return (
    <div className="page">
      <h1>Analytics</h1>

      <div className="studio-toolbar">
        <button onClick={importManual}>Import manual file</button>
      </div>

      {overview && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value">{overview.videos}</div><div className="stat-label">Videos tracked</div></div>
          <div className="stat-card"><div className="stat-value">{overview.days}</div><div className="stat-label">Days</div></div>
          <div className="stat-card"><div className="stat-value">{overview.views}</div><div className="stat-label">Total views</div></div>
          <div className="stat-card"><div className="stat-value">{overview.avgCtr}%</div><div className="stat-label">AVG CTR</div></div>
          <div className="stat-card"><div className="stat-value">{overview.avgRetention}%</div><div className="stat-label">AVG retention</div></div>
        </div>
      )}

      <h2>Underperformers (below 100 views)</h2>
      {under.length === 0 ? (
        <div className="empty-state">No metrics yet — run import manual file</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Video</th><th>Dua</th><th>Views</th><th>CTR</th><th>Retention</th><th>Score</th><th>Suggested actions</th>
              </tr>
            </thead>
            <tbody>
              {under.map((u: any) => (
                <tr key={u.video_yid}>
                  <td><a href={'https://www.youtube.com/watch?v=' + u.video_yid} target="_blank" rel="noreferrer">{u.video_yid}</a></td>
                  <td>{u.dua_title || u.dua_slug || '—'}</td>
                  <td>{u.views}</td>
                  <td>{u.ctr}%</td>
                  <td>{u.retention}%</td>
                  <td>{u.score}</td>
                  <td>
                    <div className="actions-cell">
                      {u.dua_id && <a href={`/duas/${u.dua_id}`}>open</a>}
                      {u.actions.swapThumb && <span className="tag">swap thumb</span>}
                      <span className="tag">re-title</span>
                      <span className="tag">re-SEO</span>
                      <span className="tag">re-share</span>
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