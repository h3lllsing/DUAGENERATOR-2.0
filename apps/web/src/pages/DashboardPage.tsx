import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function DashboardPage() {
  const [status, setStatus] = useState<any>(null);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);

  useEffect(() => {
    api.getStatus().then(r => setStatus(r.data)).catch(console.error);
    api.getReviewQueue().then(r => setReviewQueue(r.data)).catch(console.error);
  }, []);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {status && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{status.stats.duas}</div>
            <div className="stat-label">Duas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{status.stats.videos}</div>
            <div className="stat-label">Videos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{status.stats.activeJobs}</div>
            <div className="stat-label">Active Jobs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">v{status.version}</div>
            <div className="stat-label">Version</div>
          </div>
        </div>
      )}

      <h2>Review Queue</h2>
      {reviewQueue.length === 0 ? (
        <div className="empty-state">No videos pending review</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dua</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((v: any) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.dua_title}</td>
                  <td><span className={`badge badge-${v.state}`}>{v.state}</span></td>
                  <td>
                    <Link to={`/studio/captions/${v.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
