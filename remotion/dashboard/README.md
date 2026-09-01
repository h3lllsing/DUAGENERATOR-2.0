# Dua Video Studio Dashboard

YouTube Shorts generator dashboard for managing dua videos — add, edit, render, and upload Islamic dua videos to YouTube.

## Quick Start

```bash
# Option 1: PM2 (recommended)
pm2 start ecosystem.config.js

# Option 2: Direct
node server.js
```

Dashboard runs on `http://127.0.0.1:7860`. Auth token is auto-generated in `auth.json`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/duas` | List all duas |
| POST | `/api/add-dua` | Add new dua |
| POST | `/api/update-dua` | Update existing dua |
| POST | `/api/delete-dua` | Soft-delete dua (to trash) |
| POST | `/api/undo-delete-dua` | Undo last delete |
| GET | `/api/trash` | List trashed items |
| POST | `/api/trash/restore/:id` | Restore from trash |
| GET | `/api/config` | Get dashboard config |
| POST | `/api/config` | Save dashboard config |
| POST | `/api/render` | Render a dua video |
| POST | `/api/render-all` | Batch render all pending |
| GET | `/api/status` | Current render job status |
| POST | `/api/cancel` | Cancel running job |
| POST | `/api/voice-only` | Generate TTS only |
| POST | `/api/voice-preview` | Preview voice sample |
| POST | `/api/tts-custom` | Custom TTS generation |
| GET | `/api/ai-config` | Get AI API config |
| POST | `/api/ai-config` | Save AI API config |
| POST | `/api/ai-import` | AI-generate duas |
| POST | `/api/ai-fill-metadata` | AI fill dua metadata |
| POST | `/api/ai-format` | AI format dua text |
| POST | `/api/vfx/import` | Import VFX presets |
| POST | `/api/vfx/preview` | Preview VFX still |
| GET | `/api/vfx/list` | List VFX registry |
| POST | `/api/youtube/upload` | Upload to YouTube |
| GET | `/api/youtube/status` | YouTube upload status |
| GET | `/api/youtube/uploaded` | List uploaded videos |

## Auth

Bearer token stored in `auth.json` (auto-created). Send as `Authorization: Bearer <token>` header.

## File Structure

```
dashboard/
  server.js           # HTTP server, auth, static files
  ecosystem.config.js # PM2 config
  auth.json           # Auth token (auto-generated)
  cache.json          # Render cache
  qc.json             # Quality check cache
  fx-guardrails.js    # VFX validation rules
  theme-map.js        # Theme resolution
  look-spec.js        # Visual style specs
  routes/
    duas.js           # Dua CRUD + trash
    render.js         # Video rendering
    config.js         # Settings
    youtube.js        # YouTube upload
    vfx.js            # VFX management
    utils.js          # Shared helpers
  public/
    index.html        # Dashboard UI
    app.js            # Frontend JS
    *.css             # Styles
  data/trash/         # Soft-deleted duas (auto-cleaned after 30 days)
```
