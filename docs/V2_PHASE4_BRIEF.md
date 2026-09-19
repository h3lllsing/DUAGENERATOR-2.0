# Phase 4 — Scale & Hardening (delivered)

Status: 2026-09-20 — all items delivered (backups excluded per owner decision, see `V2_DECISIONS.md`).

## 1. Detached workers (API never blocks on renders)

Render + publish workers have moved out of the API process.

- `apps/server/src/index.ts` — API only (single long-lived process on :7870).
- `apps/server/src/worker.ts` — new entrypoint: starts `render-worker` + `publish-worker` in a **separate process**.
- `apps/server/package.json` → `npm run worker` (dev), `npm run dev` (API watch).
- The old in-process behaviour (long `execSync` renders blocking every API call) is gone: a render now queues the job and the API returns immediately.

## 2. Monitoring

- `GET /api/v1/monitoring` (authed) returns:
  - `jobs.byState` + `running`, `done`, `failed`; `queueDepth`
  - `schedules.active`, `quota` (used / caps / remaining / date), `disk` free+total via `fs.statfs`, `dbSizeBytes`, `uptimeSec`, `pid`, `version`
- Dashboard shows a **Monitoring** panel (jobs active, done/failed, quota today, schedules active, disk %, DB size, PID/uptime).
- **Crash/error alerts** — every render job failure and publish-check failure appends a timestamped line to `data/alerts.log` (`apps/server/src/alerts.ts`).

## 3. PM2 orchestration

`ecosystem.config.js` (repo root) defines two apps:

| App | Entry | Cwd | Memory cap |
|---|---|---|---|
| `v2-server` | `apps/server/src/index.ts` via `tsx` | repo root | 512M |
| `v2-worker` | `apps/server/src/worker.ts` via `tsx` | repo root | 1G |

Logs → `data/logs/`. Start:

```powershell
npm i -g pm2                # if needed (already installed: pm2@7.0.4)
node node_modules/tsx/dist/cli.mjs ecosystem.config.js  # or
pm2 start ecosystem.config.js
pm2 status ; pm2 logs v2-worker
```

Manual (without PM2):

```powershell
Start-Process node -ArgumentList "apps/server/src/index.ts" ...   # API
npm run worker                                                      # worker
```

## 4. PWA (offline-capable app shell)

- `apps/web/public/manifest.webmanifest` — name/short_name/theme/standalone + SVG icons (192/512).
- `apps/web/public/sw.js` — install precaches `/`, `/index.html`, manifest, icons; **app-shell navigation is network-first with offline cache fallback**; `/api/*` and `/ws` are always network-only (auth'd, never cached); hashed static assets cache-first.
- Registration in `apps/web/src/main.tsx` (auto on load, scope `/`).
- `index.html` — manifest link, theme-color, mobile-web-app-capable, apple meta, real title (DuaStudio V2).
- Icons: `apps/web/public/icons/icon-{192,512}.svg` (crescent mark on dark tile).

Verify: Chrome → Install app from address bar; DevTools → Application → Service Workers registered + Manifest valid. Offline test = stop server, reload page → shell renders (API calls no-op/error gracefully).

## 5. Determinism

- Seed derivation is already per-dua deterministic: `make_manifest.py` `_seed_pick(seq, dua["id"])`; `metadata.py` sha1(dua_id); `remotion/src` has **no `Math.random`** (all VFX geometry pure/seeded).
- `hash()` cache keys referenced in the audit are a prod-`dashboard/cache.json` concept (md5 of config+sfx, lookSpec excluded). V2 has **no render cache**, so there are no hash cache keys to remove.
- Re-render of the same dua produces identical output (same seed → same manifest → same frames). Two same-seed renders = identical checksums by construction.

## 6. LAN/HTTPS (optional)

Phone access guide → `docs/V2_LAN_HTTPS.md` (mkcert self-signed, HOST=0.0.0.0, CORS origin list update).

## Backups

Explicitly NOT delivered — owner opted out ("back up nahi chahiye"). Data safety = verified migrations + verify-by-recount only.