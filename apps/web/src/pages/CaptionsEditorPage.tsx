import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function CaptionsEditorPage() {
  const { videoId } = useParams();
  const [videoIdState, setVideoIdState] = useState(videoId || '');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState('');
  const [lineCount, setLineCount] = useState(0);
  const [msg, setMsg] = useState('');
  const [srtPath, setSrtPath] = useState('');

  useEffect(() => {
    if (videoId) {
      setVideoIdState(videoId);
      loadCaptions(Number(videoId));
    }
  }, [videoId]);

  const loadCaptions = (vid: number) => {
    api.getCaptions(vid).then(r => {
      setCaption(r.data.caption_en || '');
      updatePreview(vid);
    }).catch(() => setCaption(''));
  };

  const updatePreview = (vid: number) => {
    api.previewCaptions(vid).then(r => {
      setPreview(r.data.preview);
      setLineCount(r.data.line_count);
    }).catch(() => {});
  };

  const save = async () => {
    if (!videoIdState) return;
    try {
      await api.updateCaptions(Number(videoIdState), caption);
      updatePreview(Number(videoIdState));
      setMsg('Captions saved');
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  const importSrt = async () => {
    if (!videoIdState || !srtPath) return;
    try {
      const r = await api.importCaptionsSrt(Number(videoIdState), srtPath);
      setCaption(r.data.caption_en);
      updatePreview(Number(videoIdState));
      setMsg('SRT imported');
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  return (
    <div className="page">
      <h1>Captions Editor</h1>

      <div className="studio-toolbar">
        <label>Video ID:</label>
        <input value={videoIdState} onChange={e => setVideoIdState(e.target.value)} placeholder="Video ID" />
        {videoIdState && <Link to={'/studio/captions/' + videoIdState}>Load</Link>}
      </div>

      <div className="captions-layout">
        <div className="captions-editor">
          <h3>Edit EN Captions</h3>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Enter caption text (one line per subtitle)..."
            rows={20}
          />
          <div className="editor-toolbar">
            <button className="btn-primary" onClick={save}>Save</button>
            <span className="char-count">{caption.length} chars</span>
          </div>
        </div>

        <div className="captions-preview">
          <h3>Live Preview ({lineCount} lines)</h3>
          <div className="preview-box" dangerouslySetInnerHTML={{ __html: preview || '<em>No preview</em>' }} />
        </div>
      </div>

      <div className="studio-toolbar">
        <h3>Import from SRT</h3>
        <input value={srtPath} onChange={e => setSrtPath(e.target.value)} placeholder="SRT file path" className="wide" />
        <button onClick={importSrt}>Import SRT</button>
      </div>

      {msg && <div className="success">{msg}</div>}
    </div>
  );
}
