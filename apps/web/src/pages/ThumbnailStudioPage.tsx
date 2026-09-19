import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ThumbnailStudioPage() {
  const { videoId } = useParams();
  const [thumbs, setThumbs] = useState<{ a: any; b: any }>({ a: null, b: null });
  const [videoIdState, setVideoIdState] = useState(videoId || '');
  const [thumbPath, setThumbPath] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (videoId) {
      setVideoIdState(videoId);
      loadThumbs(Number(videoId));
    }
  }, [videoId]);

  const loadThumbs = (vid: number) => {
    api.getThumbs(vid).then(r => setThumbs(r.data)).catch(() => setThumbs({ a: null, b: null }));
  };

  const setThumbnail = async (variant: string) => {
    if (!videoIdState || !thumbPath) return;
    try {
      await api.setThumb(Number(videoIdState), variant, thumbPath);
      loadThumbs(Number(videoIdState));
      setMsg(`Thumbnail ${variant} set`);
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  const swap = async () => {
    if (!videoIdState) return;
    try {
      await api.swapThumbs(Number(videoIdState));
      loadThumbs(Number(videoIdState));
      setMsg('Thumbnails swapped');
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  const remove = async (variant: string) => {
    if (!videoIdState) return;
    try {
      await api.deleteThumb(Number(videoIdState), variant);
      loadThumbs(Number(videoIdState));
      setMsg(`Thumbnail ${variant} removed`);
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  return (
    <div className="page">
      <h1>Thumbnail Studio</h1>

      <div className="studio-toolbar">
        <label>Video ID:</label>
        <input value={videoIdState} onChange={e => setVideoIdState(e.target.value)} placeholder="Video ID" />
        {videoIdState && <Link to={'/studio/thumbnails/' + videoIdState}>Load</Link>}
      </div>

      <div className="thumb-grid">
        <div className="thumb-slot">
          <h3>Variant A {thumbs.a && <button onClick={() => remove('a')}>Remove</button>}</h3>
          {thumbs.a ? (
            <div className="thumb-preview">
              <code>{thumbs.a.path}</code>
              <small>{thumbs.a.set_at}</small>
            </div>
          ) : <div className="thumb-empty">No thumbnail A</div>}
        </div>
        <div className="thumb-slot">
          <h3>Variant B {thumbs.b && <button onClick={() => remove('b')}>Remove</button>}</h3>
          {thumbs.b ? (
            <div className="thumb-preview">
              <code>{thumbs.b.path}</code>
              <small>{thumbs.b.set_at}</small>
            </div>
          ) : <div className="thumb-empty">No thumbnail B</div>}
        </div>
      </div>

      <div className="studio-toolbar">
        <input value={thumbPath} onChange={e => setThumbPath(e.target.value)} placeholder="Thumbnail file path" className="wide" />
        <button onClick={() => setThumbnail('a')}>Set A</button>
        <button onClick={() => setThumbnail('b')}>Set B</button>
        <button onClick={swap}>Swap A↔B</button>
      </div>

      {msg && <div className="success">{msg}</div>}
    </div>
  );
}
