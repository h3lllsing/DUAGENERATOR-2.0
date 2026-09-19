import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function SeoManagerPage() {
  const { videoId } = useParams();
  const [videoIdState, setVideoIdState] = useState(videoId || '');
  const [seo, setSeo] = useState({ seo_title: '', seo_description: '', seo_tags: [] as string[], seo_hashtags: [] as string[] });
  const [pillars, setPillars] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.getSeoPillars().then(r => setPillars(r.data)).catch(console.error);
    api.getSeoDistribution().then(r => setDistribution(r.data)).catch(console.error);
    if (videoId) {
      setVideoIdState(videoId);
      loadSeo(Number(videoId));
    }
  }, [videoId]);

  const loadSeo = (vid: number) => {
    api.getSeo(vid).then(r => setSeo(r.data)).catch(() => {});
  };

  const saveSeo = async () => {
    if (!videoIdState) return;
    try {
      await api.updateSeo(Number(videoIdState), seo);
      setMsg('SEO saved');
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  const addTag = () => {
    if (newTag && !seo.seo_tags.includes(newTag)) {
      setSeo(s => ({ ...s, seo_tags: [...s.seo_tags, newTag] }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setSeo(s => ({ ...s, seo_tags: s.seo_tags.filter(t => t !== tag) }));
  };

  const addHashtag = () => {
    const tag = newHashtag.startsWith('#') ? newHashtag : '#' + newHashtag;
    if (!seo.seo_hashtags.includes(tag)) {
      setSeo(s => ({ ...s, seo_hashtags: [...s.seo_hashtags, tag] }));
      setNewHashtag('');
    }
  };

  const removeHashtag = (tag: string) => {
    setSeo(s => ({ ...s, seo_hashtags: s.seo_hashtags.filter(t => t !== tag) }));
  };

  return (
    <div className="page">
      <h1>SEO Manager</h1>

      <div className="studio-toolbar">
        <label>Video ID:</label>
        <input value={videoIdState} onChange={e => setVideoIdState(e.target.value)} placeholder="Video ID" />
        {videoIdState && <Link to={'/studio/seo/' + videoIdState}>Load</Link>}
      </div>

      <div className="seo-form">
        <div className="form-group">
          <label>SEO Title</label>
          <input value={seo.seo_title} onChange={e => setSeo(s => ({ ...s, seo_title: e.target.value }))} className="wide" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={seo.seo_description} onChange={e => setSeo(s => ({ ...s, seo_description: e.target.value }))} rows={5} className="wide" />
        </div>

        <div className="form-group">
          <label>Tags</label>
          <div className="tag-list">
            {seo.seo_tags.map(t => (
              <span key={t} className="tag">{t} <button onClick={() => removeTag(t)}>×</button></span>
            ))}
          </div>
          <div className="tag-input">
            <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add tag" onKeyDown={e => e.key === 'Enter' && addTag()} />
            <button onClick={addTag}>Add</button>
          </div>
        </div>

        <div className="form-group">
          <label>Hashtags</label>
          <div className="tag-list">
            {seo.seo_hashtags.map(t => (
              <span key={t} className="tag">{t} <button onClick={() => removeHashtag(t)}>×</button></span>
            ))}
          </div>
          <div className="tag-input">
            <input value={newHashtag} onChange={e => setNewHashtag(e.target.value)} placeholder="Add hashtag" onKeyDown={e => e.key === 'Enter' && addHashtag()} />
            <button onClick={addHashtag}>Add</button>
          </div>
        </div>

        <button className="btn-primary" onClick={saveSeo}>Save SEO</button>
      </div>

      <div className="pillars-section">
        <h2>Category Pillars</h2>
        <div className="pillars-grid">
          {pillars.map(p => <span key={p} className="badge">{p}</span>)}
        </div>
        <h3>Distribution</h3>
        <div className="distribution">
          {distribution.map((d: any) => (
            <div key={d.category} className="dist-row">
              <span>{d.category}</span>
              <span className="dist-count">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="success">{msg}</div>}
    </div>
  );
}
