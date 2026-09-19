import { useState } from 'react';
import { setToken } from '../api/client';

export default function TokenSetup({ onDone }: { onDone: () => void }) {
  const [token, setTokenState] = useState('');

  const submit = () => {
    if (token.trim()) {
      setToken(token.trim());
      onDone();
    }
  };

  return (
    <div className="page" style={{ maxWidth: 400, margin: '80px auto' }}>
      <h1>Enter Access Token</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Paste your bearer token from data/duav2_token.json</p>
      <div className="form-group">
        <input
          value={token}
          onChange={e => setTokenState(e.target.value)}
          placeholder="Bearer token..."
          className="wide"
          type="password"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </div>
      <button className="btn-primary" onClick={submit}>Connect</button>
    </div>
  );
}
