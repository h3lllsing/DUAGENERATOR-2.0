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
      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8')) as { token?: string };
      if (typeof data.token === 'string' && data.token.length > 0) {
        cachedToken = data.token;
        return data.token;
      }
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

function timingSafe(tokenA: string, tokenB: string): boolean {
  if (tokenA.length !== tokenB.length) return false;
  return crypto.timingSafeEqual(Buffer.from(tokenA), Buffer.from(tokenB));
}

function cookieToken(request: FastifyRequest): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const pair = part.trim();
    if (pair.startsWith('duav2_token=')) return pair.slice('duav2_token='.length);
  }
  return null;
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = loadToken();
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const provided = authHeader.slice(7);
    if (timingSafe(provided, token)) return;
  }
  const cookie = cookieToken(request);
  if (cookie) {
    if (timingSafe(cookie, token)) return;
  }
  reply.code(401).send({ ok: false, error: 'Unauthorized: invalid or missing bearer token' });
}

export function getCurrentToken(): string { return loadToken(); }
