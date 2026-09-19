# V2 Architecture — Dua Video Studio (Rebuild)

Owner-approved stack: **React + TS + Vite + Tailwind (mobile-first PWA)** · **Fastify + better-sqlite3** · WebSockets · single Remotion render path · Python subprocess helpers. Dev port **7870**. Based on audit in `V2_AUDIT_AND_PLAN.md`.

## 1. Folder layout (target)

```
H:\DUAGENERATOR 2.0\
  apps/
    web/                  # React + Vite + Tailwind frontend (PWA)
      src/{pages,components,api,stores,hooks,i18n}
      src/pwa/           # manifest + service worker
    server/               # Fastify API + WS hub
      src/
        routes/{duas,videos,render,jobs,schedule,channels,uploads,
                thumbnails,captions,seo,review,analytics,settings}.ts
        workers/{render,publish,analytics,notify}.ts
        db/{migrations/,schema.sql,repo/}
        services/        # youtube/quota/metadata/aws-helpers
  remotion/               # components + CLI tools (reuse from prod clone)
    src/  scripts/  out/
  core/                   # Python (TTS, audio, metadata, QC) — reuse
  data/                   # gitignored local state (secrets, v2.db backups)
  tests/                  # vitest + pytest
  docs/
```

## 2. Data model (SQLite, `v2.db`)

Truth moves into DB; JSON kept for export/backup only.

- `duas(id, slug UNIQUE, title, title_en, urdu, arabic, english, explanation, reference, category, part, status CHECK(draft|qc_passed|en_review|approved|published), source, created_at, updated_at)`
- `videos(id, dua_id FK, kind CHECK(short|long), video_id, state, render_files, thumbs, published_at, schedule_at)` — one dua → one or more videos.
- `channels(id, name, token_ref, default_privacy, daily_caps, quota_used, quota_date)`
- `ledger_entries(id, channel_id, dua_id, video_yid UNIQUE, action, meta, ts)` — replaces upload_state/shorts_state.
- `review(id, video_id, kind CHECK(en|caption|thumb), status CHECK(pending|approved|rejected), note, reviewer, ts)` — replaces en_review.json with edit-in-place.
- `jobs(id, type, video_id, state, progress, payload, worker, created_at, finished_at, error)` — queue in DB (auto-resume on restart).
- `analytics_cache(video_yid, day, views, likes, comments, ctr, retention, ts)` — nightly refresh.
- `settings(key, value)` + `schedules(id, video_id, publish_at, channel_id, status)`.
- Migration/backup: one-off `import_legacy.js` reads `duas.json` + ledgers + review → DB.

## 3. API surface (Fastify, typed)

All under `/api/v1`, bearer token + optional password. WS namespace `/ws` emits jobs/queue/upload/schedule events.

- Duas: `GET/POST /duas`, `PATCH /duas/:id`, `DELETE /duas/:id` (soft), `GET /duas/:id`
- Videos: `GET/POST /videos`, `PATCH /videos/:id`, `GET /videos/:id/render-files`
- Render: `POST /videos/:id/render`, `POST /videos/queue` (additive), `GET /jobs`, `POST /jobs/:id/cancel`, `GET /jobs/:id`
- Upload: `POST /videos/:id/publish` (channel+privacy), `GET /channels/:id/quota`, `POST /uploads/:id/retry`, `GET /uploads`
- Studio: `POST /videos/:id/thumbnail` (still/upload), `PATCH /videos/:id/captions`, `PATCH /videos/:id/seo` (title/tags/desc/hashtags), `GET/PATCH /videos/:id/review/[:kind]`
- Schedule: `GET/POST /schedules`, `DELETE /schedules/:id`, `GET /calendar`
- Analytics: `GET /analytics/overview`, `/analytics/videos` (underperformers), `/analytics/trends`
- Channels: `GET/POST /channels`, `POST /channels/:id/oauth` (auth flow), `PATCH /channels/:id`
- Extras: `POST /share-kit/:id` (reuse generate_share_kit), `POST /playlists/build` (reuse plan_playlists), `GET/POST /settings`

## 4. Workers

- **render-worker**: single in-flight Remotion render; reads `jobs` from DB; owns ffmpeg BT.709 tag + QC call; emits WS progress. Auto-resumes on boot (fixes prod stall bugs).
- **publish-worker**: sequential uploader honoring channel daily caps + quota ledger; watchdog; dry-run mode.
- **analytics-worker**: nightly cheap reads (`videos.list`+`statistics`), fills `analytics_cache`.
- **notify**: web-push for render-done/upload-done/review-needed/failure; logs to `jobs.error`.

## 5. Realtime contract (WS)

`{type: 'job', payload:{id,state,progress,phase}}` · `{type:'queue', payload:{count,active}}` · `{type:'upload', ...}` · `{type:'review', ...}` · `{type:'schedule', ...}`. All long ops stream; no polling.

## 6. Security (non-negotiable for V2)

- Auth on **every** endpoint, including media (`/media/*` signed or token).
- CSP header; no inline handlers; server-side HTML stripping (defense in depth with React escaping).
- Secrets: env vars or OS keyring; never in git (`data/`, `.env`, `*token*`, `client_secret*`).
- Rate-limit all `/api`, origin allowlist, `timingSafeEqual` compare, 1MB body cap, arg-array spawns.

## 7. Deterministic renders (include in Phase 1)

- Persist & reload master config per dua; replace `hash()` cache keys with stable slugs; seed `random` per duaId; optional palette/effect lock in DB for A/B.

## 8. Migrations order

1. Scaffold apps (Vite+React, Fastify) with lint+test runners.
2. SQLite schema + repo layer + legacy import script.
3. Render worker + jobs API (fixes prod queue stalls by design).
4. Auth/security pass → then studio features per roadmap (`V2_AUDIT_AND_PLAN.md` §5).