'use strict';
/**
 * EN subtitle review routes — verified/authentic English translation queue.
 *
 * Every dua whose English subtitle is generated (verified Quran Sahih Int,
 * hadith AI, or glossary/AI fallback) lands in data/en_review.json as
 * "pending". A human approves/rejects them here. The upload flow must never
 * attach captions to YouTube unless approved (gate lives in upload.py).
 *
 * Endpoints:
 *   GET  /api/en-review/list[?status=pending]
 *   POST /api/en-review/{duaId}/approve
 *   POST /api/en-review/{duaId}/reject
 *
 * Factory: reviewRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function reviewRoutes(deps) {
  const {PROJECT, fs, path, send, log} = deps;
  const F = fs.promises;
  const {readBody, routeCatch} = require('./utils');

  const REVIEW_PATH = path.join(PROJECT, 'data', 'en_review.json');
  const VERIFIED_PATH = path.join(PROJECT, 'data', 'verified_en.json');
  const DUAS_PATH = path.join(PROJECT, 'data', 'duas.json');

  async function readStore(p, fallback) {
    try {
      const txt = (await F.readFile(p, 'utf8')).replace(/^\uFEFF/, '');
      return JSON.parse(txt) || fallback;
    } catch (_) { return fallback; }
  }
  async function writeStore(p, data) {
    const tmp = p + '.' + Date.now() + '.tmp.json';
    await F.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await F.rename(tmp, p);
  }
  function duaTitle(duaId) {
    // best-effort synchronous read is fine for title lookup; fall back to id.
    try {
      const raw = JSON.parse(fs.readFileSync(DUAS_PATH, 'utf8').replace(/^\uFEFF/, ''));
      const list = Array.isArray(raw) ? raw : raw.duas;
      const d = list.find((x) => x.id === duaId);
      return d ? (d.title || duaId) : duaId;
    } catch (_) { return duaId; }
  }

  async function doList(res, url) {
    const status = (url.searchParams.get('status') || 'pending').trim();
    const review = await readStore(REVIEW_PATH, {});
    const verified = await readStore(VERIFIED_PATH, {});
    const items = [];
    for (const [duaId, e] of Object.entries(review)) {
      if (duaId === '_comment') continue;
      if (status && e.status !== status) continue;
      items.push({
        duaId,
        title: duaTitle(duaId),
        status: e.status,
        ref: e.ref || null,
        source: e.source || null,
        ar: e.ar || '',
        en: e.en || '',
        queueTs: e.queue_ts || null,
        reviewedTs: e.reviewed_ts || null,
        note: e.note || null,
        hasVerified: !!(verified[duaId] && verified[duaId].en),
      });
    }
    items.sort((a, b) => (a.queueTs || 0) - (b.queueTs || 0));
    send(res, 200, JSON.stringify({ok: true, status, count: items.length,
      items}, null, 2));
    return true;
  }

  async function doSet(req, res, url, status) {
    const m = /^\/api\/en-review\/([a-z0-9_]+)\/(approve|reject)$/.exec(url.pathname);
    if (!m) {
      send(res, 400, JSON.stringify({ok: false, error: 'bad review path'}));
      return;
    }
    const duaId = m[1];
    const body = await readBody(req, res);
    let note = null;
    if (body) {
      try { note = JSON.parse(body).note; } catch (_) {}
    }
    const review = await readStore(REVIEW_PATH, {});
    if (duaId === '_comment' || !review[duaId]) {
      send(res, 404, JSON.stringify({ok: false, error: 'review entry not found: ' + duaId}));
      return;
    }
    review[duaId].status = status === 'approve' ? 'approved' : 'rejected';
    review[duaId].reviewed_ts = Math.floor(Date.now() / 1000);
    if (note !== null) review[duaId].note = note;
    await writeStore(REVIEW_PATH, review);
    log('[en-review] ' + duaId + ' -> ' + review[duaId].status);
    send(res, 200, JSON.stringify({ok: true, duaId,
      status: review[duaId].status}));
  }

  return function handler(req, url, res) {
    if (req.method === 'GET' && url.pathname === '/api/en-review/list') {
      routeCatch(res, () => doList(res, url));
      return true;
    }
    if (req.method === 'POST' &&
        /\/api\/en-review\/[a-z0-9_]+\/(approve|reject)$/.test(url.pathname)) {
      const action = url.pathname.split('/').pop();
      routeCatch(res, () => doSet(req, res, url, action));
      return true;
    }
    return false;
  };
};