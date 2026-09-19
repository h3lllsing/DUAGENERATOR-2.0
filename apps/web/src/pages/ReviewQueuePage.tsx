import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.getReviewQueue().then(r => setQueue(r.data)).catch(console.error);
  };

  useEffect(load, []);

  const approve = async (videoId: number) => {
    try {
      await api.approveVideo(videoId);
      setMsg('Video approved');
      load();
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  const reject = async (videoId: number) => {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try {
      await api.rejectVideo(videoId, reason);
      setMsg('Video rejected');
      load();
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  return (
    <div className="page">
      <h1>Review Queue</h1>
      {queue.length === 0 ? (
        <div className="empty-state">No videos pending review</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dua</th>
                <th>Reference</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((v: any) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.dua_title}</td>
                  <td>{v.dua_reference}</td>
                  <td><span className={`badge badge-${v.state}`}>{v.state}</span></td>
                  <td className="actions-cell">
                    <Link to={'/studio/captions/' + v.id}>Edit Captions</Link>
                    <Link to={'/studio/seo/' + v.id}>Edit SEO</Link>
                    <Link to={'/studio/thumbnails/' + v.id}>Thumbnails</Link>
                    <button className="btn-approve" onClick={() => approve(v.id)}>Approve</button>
                    <button className="btn-reject" onClick={() => reject(v.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg && <div className="success">{msg}</div>}
    </div>
  );
}
