import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:7870';

function findTokenFile(start: string): string | null {
  for (let d = path.resolve(start); ; d = path.dirname(d)) {
    const candidate = path.join(d, 'data', 'duav2_token.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(d);
    if (parent === d) return null;
  }
}

function getToken(): string {
  const tokenPath = findTokenFile(process.cwd());
  if (tokenPath) {
    return JSON.parse(fs.readFileSync(tokenPath, 'utf-8')).token;
  }
  return 'dua-v2-dev-token-change-me-in-prod';
}

describe('API auth (negative tests)', () => {
  it('GET /api/v1/health bypasses auth', async () => {
    const res = await fetch(BASE + '/api/v1/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/duas without token → 401', async () => {
    const res = await fetch(BASE + '/api/v1/duas');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/duas with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/v1/duas', {
      headers: { Authorization: 'Bearer wrong-token-123' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/duas with valid token → 200', async () => {
    const token = getToken();
    const res = await fetch(BASE + '/api/v1/duas', {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(res.status).toBe(200);
  });

  it('POST /api/v1/videos without token → 401', async () => {
    const res = await fetch(BASE + '/api/v1/videos', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/videos with valid token → 200', async () => {
    const token = getToken();
    const res = await fetch(BASE + '/api/v1/videos', {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(res.status).toBe(200);
  });
});
