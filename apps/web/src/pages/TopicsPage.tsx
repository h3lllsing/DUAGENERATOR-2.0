import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  function refresh() {
    api.getTopics().then(r => setTopics(r.data)).catch(e => setErr(String(e)));
  }

  useEffect(() => { refresh(); }, []);

  async function suggest() {
    setMsg(''); setErr('');
    try {
      const r = await api.suggestTopics();
      setMsg(`Suggested ${r.data.suggestions.length} topics, added ${r.data.added}, ${r.data.existing} already present`);
      refresh();
    } catch (e: any) { setErr(String(e)); }
  }

  async function add() {
    setMsg(''); setErr('');
    if (!keyword.trim()) { setErr('Enter a keyword'); return; }
    try {
      await api.addTopic(keyword);
      setKeyword('');
      refresh();
    } catch (e: any) { setErr(String(e)); }
  }

  async function setStatus(id: number, status: string) {
    try { await api.updateTopic(id, status); refresh(); } catch (e: any) { setErr(String(e)); }
  }

  async function remove(id: number) {
    try { await api.deleteTopic(id); refresh(); } catch (e: any) { setErr(String(e)); }
  }

  const counts: Record<string, number> = { pending: 0, progress: 0, done: 0, ignored: 0 };
  topics.forEach((t: any) => { if (counts[t.status] !== undefined) counts[t.status]++; });

  return (
    <div className="page">
      <h1>Topics Queue</h1>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{counts.pending}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card"><div className="stat-value">{counts.progress}</div><div className="stat-label">In progress</div></div>
        <div className="stat-card"><div className="stat-value">{counts.done}</div><div className="stat-label">Done</div></div>
        <div className="stat-card"><div className="stat-value">{counts.ignored}</div><div className="stat-label">Ignored</div></div>
      </div>

      <div className="studio-toolbar">
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="keyword, e.g. safar" />
        <button className="btn-primary" onClick={add}>Add topic</button>
        <button onClick={suggest}>Suggest from library (trend radar)</button>
      </div>

      {topics.length === 0 ? (
        <div className="empty-state">No topics yet</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Keyword</th><th>Source</th><th>Compadres</th><th>Status</th><th>Added</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {topics.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.keyword}</td>
                  <td>{t.source}</td>
                  <td>{t.comp_count}</td>
                  <td><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                  <td>{t.created_at}</td>
                  <td>
                    <div className="actions-cell">
                      {t.status !== 'progress' && <button onClick={() => setStatus(t.id, 'progress')}>Start</button>}
                      {t.status !== 'done' && <button onClick={() => setStatus(t.id, 'done')}>Done</button>}
                      {t.status !== 'ignored' && <button onClick={() => setStatus(t.id, 'ignored')}>Ignore</button>}
                      <button className="btn-reject" onClick={() => remove(t.id)}>Delete</button>
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