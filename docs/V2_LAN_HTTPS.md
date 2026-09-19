# V2 LAN / HTTPS (optional, phone access)

By default the portal listens on `127.0.0.1:7870` (loopback only) — safe but not reachable from a phone.
PWA install from a phone requires HTTPS (or localhost). This guide makes the portal reachable on your LAN with a self-signed cert via `mkcert`. **Fully optional.**

## 1. Allow LAN access

The API process reads `HOST` env. For phone access bind to all interfaces:

```powershell
$env:HOST = "0.0.0.0"
npm run dev        # server (apps/server)
```

Or with the PM2 stack, set `HOST: '0.0.0.0'` in `ecosystem.config.js` (`v2-server` env).

Find your machine's LAN IP: `ipconfig` → e.g. `192.168.1.50`. Phone opens `http://192.168.1.50:7870`.

> Warning: binding `0.0.0.0` exposes the portal to your whole WiFi. The token is still required for every `/api` call (authGuard), and the UI only works after the token is set, but anyone on the LAN who learns the URL sees the login page. Only do this on a trusted network.

## 2. HTTPS with mkcert (for real PWA install)

```powershell
choco install mkcert   # or scoop install mkcert
mkcert -install
mkcert 192.168.1.50 localhost 127.0.0.1
```

This creates `192.168.1.50+2.pem` / `-key.pem`.

## 3. Serve HTTPS

Add TLS env to the API (Fastify `https` options) or front with a reverse proxy. Minimal Fastify change:

```ts
// apps/server/src/index.ts
const https = process.env.TLS_CERT ? {
  cert: fs.readFileSync(process.env.TLS_CERT),
  key: fs.readFileSync(process.env.TLS_KEY),
} : undefined;
app.listen({ port: PORT, host: HOST }, (err) => {})
```

Set when starting:

```powershell
$env:TLS_CERT = "C:\path\192.168.1.50+2.pem"
$env:TLS_KEY  = "C:\path\192.168.1.50+2-key.pem"
```

## 4. CORS / SW scope

- `apps/server/src/index.ts` CORS `origin` whitelist must include `https://192.168.1.50:7870`.
- Service worker scope is `/` and works over HTTPS automatically.
- The phone must trust the mkcert root once (mkcert -install on that OS, or visit the URL and accept the cert warning).

## Not doing

No port-forwarding, no public hosting, no Let's Encrypt (free-only + local-only decisions). See `V2_DECISIONS.md`.