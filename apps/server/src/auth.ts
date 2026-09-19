import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = 'data/duav2_token.json';
let cachedToken: string | null = null;

function loadToken(): string {
  if (cachedToken) return cachedToken;
  if (process.env.DUAV2_TOKEN) { cachedToken = process.env.DUAV2_TOKEN; return cachedToken; }
  try {
    const tokenPath = path.resolve(process.cwd(), TOKEN_FILE);
    if (fs.existsSync(tokenPath)) {
      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      cachedToken = data.token;
      return cachedToken;
    }
  } catch {}
  const newToken = crypto.randomBytes(32).toString('hex');
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), TOKEN_FILE), JSON.stringify({ token: newToken, created: new Date().toISOString() }, null, 2));
    console.log('[Auth] Generated new token');
  } catch (err) { console.error('[Auth] Failed to save token:', err); }
  cachedToken = newToken;
  return newToken;
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = loadToken();
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const provided = authHeader.slice(7);
    if (provided.length === token.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))) return;
  }
  const cookies = request.cookies;
  if (cookies && cookies.duav2_token) {
    if (cookies.duav2_token.length === token.length && crypto.timingSafeEqual(Buffer.from(cookies.duav2_token), Buffer.from(token))) return;
  }
  reply.code(401).send({ ok: false, error: 'Unauthorized: invalid or missing bearer token' });
}

export function getCurrentToken(): string { return loadToken(); }
