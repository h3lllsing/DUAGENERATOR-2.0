# API Documentation

Dua Video Generator Dashboard API endpoints.

**Base URL:** `http://localhost:7860`
**Auth:** Bearer token (see `remotion/dashboard/auth.json`)

---

## Render Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/render` | Render a single dua video |
| POST | `/api/render-selected` | Add selected duas to render queue (additive, skip duplicates) |
| POST | `/api/render-all` | Render all pending (not yet rendered) duas |
| GET | `/api/status` | Get current render status + queue info (remaining, done, failed) |
| GET | `/api/status/stream` | SSE stream for real-time job updates |
| POST | `/api/cancel` | Cancel current render or batch queue |
| POST | `/api/voice-only` | Generate TTS + manifest only (no video render) |

## Dua Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/duas` | List all duas |
| POST | `/api/duas` | Add new dua |
| PUT | `/api/duas/:id` | Update dua |
| DELETE | `/api/duas/:id` | Delete dua |
| GET | `/api/duas/:id` | Get dua by ID |

## TTS (Text-to-Speech)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tts` | Generate TTS for dua |
| POST | `/api/tts-custom` | Custom TTS with Arabic/Urdu text |

## VFX (Visual Effects)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vfx` | List available effects |
| POST | `/api/vfx/preview` | Preview effect on frame |
| POST | `/api/vfx/import` | Import custom VFX |

## YouTube

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/youtube/auth` | Authenticate with YouTube |
| GET | `/api/youtube/status` | Get upload status |
| POST | `/api/youtube/upload` | Upload video (per-channel duplicate check, 409 if already uploaded) |
| POST | `/api/youtube/sync` | Sync upload status from ledgers or YouTube API |
| GET | `/api/youtube/uploaded` | List uploaded videos |
| GET | `/api/youtube/stats` | Get video/channel statistics |

## Batch (Python Pipeline)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/batch/start` | Start Python pipeline batch |
| GET | `/api/batch/status` | Get batch status |
| POST | `/api/batch/cancel` | Cancel batch |

## Config & System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get project config |
| PUT | `/api/config` | Update project config |
| GET | `/api/health` | Health check |
| GET | `/api/history` | Get render history |
| POST | `/api/thumbs-all` | Generate all thumbnails |
| GET | `/thumb/:name` | Serve thumbnail image |
| GET | `/video/:name` | Serve video file |

## Static Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Dashboard HTML |
| GET | `/*.css` | Stylesheets |
| GET | `/*.js` | JavaScript files |
| GET | `/*.png` | Images |

---

## Response Format

All API responses follow this format:
```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request / invalid JSON |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (CORS, path traversal) |
| 404 | Resource not found |
| 409 | Conflict (job already running) |
| 416 | Range not satisfiable |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
