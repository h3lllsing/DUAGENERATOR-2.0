import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function DuaListPage() {
  const [duas, setDuas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', status: '' });

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filter.category) params.category = filter.category;
    if (filter.status) params.status = filter.status;
    api.getDuas(params).then(r => setDuas(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  return (
    <div className="page">
      <h1>Duas ({duas.length})</h1>
      <div className="filters">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="qc_passed">QC Passed</option>
          <option value="en_review">EN Review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
        </select>
      </div>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Reference</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {duas.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.title}</td>
                  <td>{d.reference}</td>
                  <td>{d.category || '-'}</td>
                  <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                  <td><Link to={'/duas/' + d.id}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
