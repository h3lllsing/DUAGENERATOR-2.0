import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function DuaDetailPage() {
  const { id } = useParams();
  const [dua, setDua] = useState<any>(null);
  const [video, setVideo] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getDua(Number(id)).then(r => setDua(r.data)).catch(e => setError(e.message));
    api.getVideos({ dua_id: id }).then(r => {
      if (r.data.length > 0) setVideo(r.data[0]);
    }).catch(() => {});
  }, [id]);

  const createVideo = async () => {
    if (!id) return;
    try {
      const r = await api.createVideo({ dua_id: Number(id) });
      setVideo(r.data);
    } catch (e: any) { setError(e.message); }
  };

  if (!dua) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <Link to="/duas" className="back-link">← Back to Duas</Link>
      <h1>{dua.title}</h1>
      <div className="dua-meta">
        <span className={`badge badge-${dua.status}`}>{dua.status}</span>
        <span>{dua.reference}</span>
        {dua.category && <span className="badge">{dua.category}</span>}
      </div>

      {dua.arabic && (
        <div className="dua-section">
          <h3>Arabic</h3>
          <p className="arabic-text" dir="rtl">{dua.arabic}</p>
        </div>
      )}
      {dua.urdu && (
        <div className="dua-section">
          <h3>Urdu</h3>
          <p dir="rtl">{dua.urdu}</p>
        </div>
      )}
      {dua.english && (
        <div className="dua-section">
          <h3>English</h3>
          <p>{dua.english}</p>
        </div>
      )}
      {dua.explanation && (
        <div className="dua-section">
          <h3>Explanation</h3>
          <p>{dua.explanation}</p>
        </div>
      )}

      <div className="video-section">
        <h2>Video</h2>
        {video ? (
          <div className="video-card">
            <span className={`badge badge-${video.state}`}>{video.state}</span>
            <div className="video-actions">
              <Link to={'/studio/thumbnails/' + video.id}>Thumbnails</Link>
              <Link to={'/studio/captions/' + video.id}>Captions</Link>
              <Link to={'/studio/seo/' + video.id}>SEO</Link>
              <button onClick={() => api.renderVideo(video.id)}>Render</button>
            </div>
          </div>
        ) : (
          <button className="btn-primary" onClick={createVideo}>Create Video</button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
