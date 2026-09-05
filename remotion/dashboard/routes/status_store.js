'use strict';
/**
 * Persistent dua status tracker (v2 — per-channel upload tracking).
 *
 * Stores per-dua lifecycle status in data/dua_status.json so that the
 * dashboard can always show the correct state regardless of whether
 * local video/thumbnail files have been deleted to save disk space.
 *
 * Status hierarchy (forward-only, never regresses):
 *   not_started → rendered → uploaded
 *
 * "uploaded" now tracks PER-CHANNEL status so we can:
 * - Prevent duplicate uploads to the same channel
 * - Show which channels a dua has been uploaded to
 *
 * Schema:
 * {
 *   "dua_id": {
 *     "status": "uploaded" | "rendered" | "not_started",
 *     "renderedAt": "ISO...",
 *     "uploaded_channels": {
 *       "channel1": { "videoId": "...", "url": "...", "uploadedAt": "..." },
 *       "channel2": { "videoId": "...", "url": "...", "uploadedAt": "..." }
 *     }
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'data');
const STATUS_FILE = path.join(DATA_DIR, 'dua_status.json');

// ── Ledger paths (source of truth for upload history) ──
function _ledgerPath(ch) {
  return path.join(DATA_DIR, 'upload_state_' + ch + '.json');
}
const CHANNELS = ['channel1', 'channel2'];

function _load() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

function _flush(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    const tmp = STATUS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, STATUS_FILE);
  } catch (e) {
    // non-fatal — dashboard is read-mostly
  }
}

// ── Ledger reading ──
function _readLedger(ch) {
  try {
    const txt = fs.readFileSync(_ledgerPath(ch), 'utf8').replace(/^\uFEFF/, '');
    const raw = JSON.parse(txt);
    const result = {};
    for (const [duaId, v] of Object.entries(raw)) {
      if (v && v.status === 'uploaded') {
        result[duaId] = {
          videoId: v.video_id || null,
          url: v.video_id ? 'https://youtu.be/' + v.video_id : null,
          uploadedAt: v.uploaded_at || null,
          privacy: v.privacy || null,
        };
      }
    }
    return result;
  } catch (_) {
    return {};
  }
}

/**
 * Get the persistent status record for a dua.
 * Returns { status, renderedAt, uploaded_channels: {...} } or null.
 */
function getStatus(duaId) {
  return _load()[duaId] || null;
}

/**
 * Set the dua to "rendered" (video generated locally).
 * Only upgrades from "not_started"; never downgrades from "uploaded".
 */
function setRendered(duaId) {
  const db = _load();
  const cur = db[duaId];
  // Never downgrade from uploaded
  if (cur && cur.status === 'uploaded') return;
  db[duaId] = {
    status: 'rendered',
    renderedAt: new Date().toISOString(),
    uploaded_channels: cur && cur.uploaded_channels || {},
  };
  _flush(db);
}

/**
 * Set the dua to "uploaded" for a specific channel.
 * This is the highest status — local file deletion does NOT affect it.
 */
function setUploaded(duaId, youtubeId, youtubeUrl, channel) {
  const db = _load();
  const cur = db[duaId] || {};
  const ch = channel || 'channel1';
  if (!cur.uploaded_channels) cur.uploaded_channels = {};
  cur.uploaded_channels[ch] = {
    videoId: youtubeId || null,
    url: youtubeUrl || (youtubeId ? 'https://youtu.be/' + youtubeId : null),
    uploadedAt: new Date().toISOString(),
  };
  // Compute overall status: uploaded if uploaded to ANY channel
  const hasUploads = Object.keys(cur.uploaded_channels).length > 0;
  db[duaId] = {
    status: hasUploads ? 'uploaded' : (cur.status === 'rendered' ? 'rendered' : 'not_started'),
    renderedAt: cur.renderedAt || null,
    uploaded_channels: cur.uploaded_channels,
  };
  _flush(db);
}

/**
 * Bulk-set uploaded status for multiple duas on a specific channel.
 * Called after upload batch completes.
 */
function setUploadedBatch(entries, channel) {
  const db = _load();
  const ch = channel || 'channel1';
  for (const e of entries) {
    if (!e || !e.duaId) continue;
    const cur = db[e.duaId] || {};
    if (!cur.uploaded_channels) cur.uploaded_channels = {};
    cur.uploaded_channels[ch] = {
      videoId: e.videoId || null,
      url: e.url || (e.videoId ? 'https://youtu.be/' + e.videoId : null),
      uploadedAt: e.uploadedAt || new Date().toISOString(),
    };
    const hasUploads = Object.keys(cur.uploaded_channels).length > 0;
    db[e.duaId] = {
      status: hasUploads ? 'uploaded' : 'rendered',
      renderedAt: cur.renderedAt || null,
      uploaded_channels: cur.uploaded_channels,
    };
  }
  _flush(db);
}

/**
 * Check if a dua is already uploaded to a specific channel.
 */
function isUploadedToChannel(duaId, channel) {
  const st = getStatus(duaId);
  if (!st || !st.uploaded_channels) return false;
  return !!st.uploaded_channels[channel || 'channel1'];
}

/**
 * Get the list of dua IDs uploaded to a specific channel.
 */
function getUploadedIdsForChannel(channel) {
  const db = _load();
  const ch = channel || 'channel1';
  return Object.keys(db).filter(id =>
    db[id] && db[id].uploaded_channels && db[id].uploaded_channels[ch]
  );
}

/**
 * Sync dua_status.json from the upload ledger files.
 * The ledgers are the ground truth — this backfills any uploads
 * that happened before dua_status.json was introduced.
 *
 * Returns { backfilled: number, channels: { channel1: N, channel2: N } }
 */
function syncFromLedgers() {
  const db = _load();
  let backfilled = 0;
  const channelCounts = {};
  for (const ch of CHANNELS) {
    const ledger = _readLedger(ch);
    channelCounts[ch] = 0;
    for (const [duaId, info] of Object.entries(ledger)) {
      const cur = db[duaId] || {};
      if (!cur.uploaded_channels) cur.uploaded_channels = {};
      // Only backfill if not already tracked for this channel
      if (!cur.uploaded_channels[ch]) {
        cur.uploaded_channels[ch] = {
          videoId: info.videoId,
          url: info.url,
          uploadedAt: info.uploadedAt,
        };
        backfilled++;
        channelCounts[ch]++;
      }
      // Upgrade overall status
      const hasUploads = Object.keys(cur.uploaded_channels).length > 0;
      db[duaId] = {
        status: hasUploads ? 'uploaded' : (cur.status || 'not_started'),
        renderedAt: cur.renderedAt || null,
        uploaded_channels: cur.uploaded_channels,
      };
    }
  }
  if (backfilled > 0) _flush(db);
  return {backfilled, channels: channelCounts};
}

/**
 * Backfill from YouTube API results (for uploads done before the ledger).
 * entries: [{ duaId, videoId, channel, uploadedAt }]
 */
function syncFromYouTubeApi(entries) {
  const db = _load();
  let backfilled = 0;
  for (const e of entries) {
    if (!e || !e.duaId || !e.videoId) continue;
    const ch = e.channel || 'channel1';
    const cur = db[e.duaId] || {};
    if (!cur.uploaded_channels) cur.uploaded_channels = {};
    if (!cur.uploaded_channels[ch]) {
      cur.uploaded_channels[ch] = {
        videoId: e.videoId,
        url: 'https://youtu.be/' + e.videoId,
        uploadedAt: e.uploadedAt || new Date().toISOString(),
      };
      backfilled++;
    }
    const hasUploads = Object.keys(cur.uploaded_channels).length > 0;
    db[e.duaId] = {
      status: hasUploads ? 'uploaded' : (cur.status || 'not_started'),
      renderedAt: cur.renderedAt || null,
      uploaded_channels: cur.uploaded_channels,
    };
  }
  if (backfilled > 0) _flush(db);
  return {backfilled};
}

/**
 * Merge persistent status into a duaStatus response object.
 * Called by duaStatus() in render.js before returning to the API.
 */
function mergeStatus(duaId, obj) {
  const st = getStatus(duaId);
  if (!st) {
    // No persistent record — derive from files as before
    obj.duaStatus = obj.videoFile ? 'rendered' : 'not_started';
    obj.uploadedChannels = {};
    return obj;
  }
  // Persistent record takes priority
  obj.duaStatus = st.status;
  obj.uploadedChannels = st.uploaded_channels || {};
  // Backward compat: set top-level youtubeId/youtubeUrl from any channel
  const anyCh = Object.values(st.uploaded_channels || {})[0];
  obj.youtubeId = anyCh && anyCh.videoId || null;
  obj.youtubeUrl = anyCh && anyCh.url || null;
  obj.uploadedAt = anyCh && anyCh.uploadedAt || null;
  return obj;
}

module.exports = {
  getStatus,
  setRendered,
  setUploaded,
  setUploadedBatch,
  isUploadedToChannel,
  getUploadedIdsForChannel,
  syncFromLedgers,
  syncFromYouTubeApi,
  mergeStatus,
};
