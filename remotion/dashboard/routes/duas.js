'use strict';
/**
 * Dua CRUD routes — async I/O + strict input sanitization + graceful errors.
 * Factory: duaRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function duaRoutes(deps) {
  const {PROJECT, TEMP, REMOTION, DATA, OUT,
    fs, path, send, log, safeTitle,
    cacheStore, saveCache, qcStore, saveQc,
    duaStatus, themeMap} = deps;
  const F = fs.promises;
  const {err, parseJson, cleanStr, readBody, routeCatch, exists: existsFn} = require('./utils');

  // ── strict input allowlists / limits ──
  const CATS = new Set(['general', 'sleep', 'food', 'travel', 'prayer',
    'morning', 'evening', 'bathroom', 'protection', 'rizq', 'forgiveness',
    'morning_evening', 'guidance', 'health', 'anxiety_relief', 'gratitude',
    'family', 'occasions']);
  const TEMPLATES = new Set(['dark', 'mosque', 'sunset', 'manuscript',
    'emerald', 'ocean', 'desert', 'royal', 'ramadan', 'eid', 'qadr']);
  const VOICES = new Set(['ar-SA-HamedNeural', 'ar-SA-ZariyahNeural',
    'ur-PK-AsadNeural', 'ur-PK-UzmaNeural']);
  const LIMITS = {title: 200, arabic: 4000, urdu: 2000, reference: 300,
    explanation: 2000};
  const DB_PATH = path.join(PROJECT, 'data', 'duas.json');

  async function readDuaDb() {
    const txt = (await F.readFile(DB_PATH, 'utf8')).replace(/^\uFEFF/, '');
    return JSON.parse(txt);
  }
  function toList(raw) { return Array.isArray(raw) ? raw : raw.duas; }
  async function writeDuaDb(raw, list) {
    const tmp = DB_PATH + '.' + Date.now() + '.tmp.json';
    await F.writeFile(tmp, JSON.stringify(
      Array.isArray(raw) ? list : Object.assign({}, raw, {duas: list}), null, 2), 'utf8');
    await F.rename(tmp, DB_PATH);
  }
  async function exists(p) { return existsFn(p, fs); }

  // ── duplicate detection (exact + fuzzy >=90%) ──
  function _norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function _normArabic(s) {
    return _norm(s).replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  }
  function _sim(a, b) {
    const len = Math.max(a.length, b.length);
    if (!len) return 0;
    let m = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++;
    return m / len;
  }
  function findDuplicates(list, fields, value, selfId) {
    const results = [];
    const normArabic = fields.includes('arabic');
    for (const d of list) {
      if (selfId && d.id === selfId) continue;
      for (const f of fields) {
        let a = _norm(value);
        let b = _norm(d[f]);
        if (!b) continue;
        if (normArabic) { a = _normArabic(a); b = _normArabic(b); }
        const exact = a === b;
        const fuzzy = (!exact && a && b) && _sim(a, b) >= 0.90;
        if (exact || fuzzy) {
          if (!results.some((r) => r.id === d.id && r.field === f)) {
            results.push({id: d.id, field: f});
          }
        }
      }
    }
    return results;
  }
  function dedupError(list, id, title, arabic, urdu) {
    const dup = [];
    if (title) dup.push.apply(dup, findDuplicates(list, ['title'], title, id));
    if (arabic) dup.push.apply(dup, findDuplicates(list, ['arabic'], arabic, id));
    if (urdu) dup.push.apply(dup, findDuplicates(list, ['urdu'], urdu, id));
    if (!dup.length) return null;
    const uniq = [];
    const seen = {};
    for (const x of dup) {
      const k = x.id + '::' + x.field;
      if (!seen[k]) { seen[k] = 1; uniq.push(x); }
    }
    return 'Duplicate — ye info pehle se maujood hai: '
      + uniq.map((x) => x.id + ' (' + x.field + ')').join(', ');
  }

  function slugId(f) {
    let id = (f && String(f.id || '').trim().toLowerCase() || '')
      .replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/_{2,}/g, '_');
    if (!id && f && f.title) {
      id = String(f.title).trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
    if (!id) id = 'custom_' + Date.now();
    return id.slice(0, 80);
  }

  async function doAdd(res, body) {
    const f = parseJson(body, 'add-dua');
    const title = cleanStr(f.title, LIMITS.title, 'Title');
    if (!title) throw err(400, 'title zaroori hai');
    const arabic = cleanStr(f.arabic, LIMITS.arabic, 'Arabic');
    if (!arabic) throw err(400, 'arabic zaroori hai');
    const urdu = cleanStr(f.urdu, LIMITS.urdu, 'Urdu');
    if (!urdu) throw err(400, 'urdu zaroori hai');
    const urduWords = urdu.match(/\S+/g)?.length || 0;
    if (urduWords > 75) {
      throw err(400, 'Urdu tarjuma bohot lambi hai (' + urduWords
        + ' words, max 75). Video 40 sec se lambi banegi aur render fail hogi');
    }
    const reference = cleanStr(f.reference, LIMITS.reference, 'Reference') || 'Custom';
    const explanation = cleanStr(f.explanation, LIMITS.explanation, 'Explanation');
    const category = CATS.has(String(f.category || '').trim())
      ? String(f.category).trim() : 'general';
    const template = TEMPLATES.has(f.template) ? f.template : 'dark';
    const voiceArabic = VOICES.has(String(f.voiceArabic || ''))
      ? String(f.voiceArabic) : 'ar-SA-HamedNeural';
    const voiceUrdu = VOICES.has(String(f.voiceUrdu || ''))
      ? String(f.voiceUrdu) : 'ur-PK-AsadNeural';

    const backup = DB_PATH.replace(/duas\.json$/, 'duas.backup.json');
    if (!(await exists(backup))) {
      try { await F.copyFile(DB_PATH, backup); } catch (_) {}
    }
    const raw = await readDuaDb();
    const list = toList(raw);
    let id = slugId(f);
    while (list.some((d) => d.id === id)) id = id + '_new';
    const entry = {
      id, category, title, arabic, urdu, explanation, reference,
      voice_arabic: voiceArabic, voice_urdu: voiceUrdu, template,
      bismillah: f.bismillah !== false, duration: 15,
    };
    const duperr = dedupError(list, null, entry.title, entry.arabic, entry.urdu);
    if (duperr) throw err(409, duperr);
    list.push(entry);
    await writeDuaDb(raw, list);
    log('NEW DUA ADDED: ' + id);
    send(res, 200, JSON.stringify({ok: true, id}));
  }

  async function doUpdate(res, body) {
    const f = parseJson(body, 'update-dua');
    const id = String(f.id || '').trim();
    if (!id || !/^[a-z0-9_]{1,80}$/.test(id)) throw err(400, 'id zaroori hai');
    if (f.urdu !== undefined && String(f.urdu).trim()) {
      const uw = cleanStr(f.urdu, LIMITS.urdu, 'Urdu').match(/\S+/g)?.length || 0;
      if (uw > 75) throw err(400, 'Urdu tarjuma bohot lambi hai (' + uw
        + ' words, max 75). Video 40 sec se lambi banegi aur render fail hogi');
    }
    const raw = await readDuaDb();
    const list = toList(raw);
    const idx = list.findIndex((d) => d.id === id);
    if (idx < 0) throw err(404, 'dua nahi mili');
    const d = list[idx];
    if (await exists(path.join(OUT, safeTitle(String(d.title || '')) + '.mp4'))) {
      throw err(409, 'RENDERED video edit nahi hoti (text/voice video ke andar baked hai). Isay delete karke naya banao');
    }
    if (f.title !== undefined && String(f.title).trim()) {
      d.title = cleanStr(f.title, LIMITS.title, 'Title');
    }
    if (f.arabic !== undefined && String(f.arabic).trim()) {
      d.arabic = cleanStr(f.arabic, LIMITS.arabic, 'Arabic');
    }
    if (f.urdu !== undefined && String(f.urdu).trim()) {
      d.urdu = cleanStr(f.urdu, LIMITS.urdu, 'Urdu');
    }
    if (f.reference !== undefined) {
      d.reference = cleanStr(f.reference, LIMITS.reference, 'Reference') || d.reference;
    }
    if (f.category !== undefined && CATS.has(String(f.category).trim())) {
      d.category = String(f.category).trim();
    }
    d.bismillah = f.bismillah !== false;
    if (TEMPLATES.has(f.template)) d.template = f.template;
    if (VOICES.has(String(f.voiceArabic || ''))) d.voice_arabic = String(f.voiceArabic);
    if (VOICES.has(String(f.voiceUrdu || ''))) d.voice_urdu = String(f.voiceUrdu);
    const duperr = dedupError(list, id, d.title, d.arabic, d.urdu);
    if (duperr) throw err(409, duperr);
    await writeDuaDb(raw, list);
    log('DUA UPDATED: ' + id);
    send(res, 200, JSON.stringify({ok: true, id}));
  }

  async function doDelete(res, body) {
    const f = parseJson(body, 'delete-dua');
    const id = String(f.id || '').trim();
    if (!id || !/^[a-z0-9_]{1,80}$/.test(id)) throw err(404, 'dua nahi mili');
    const raw = await readDuaDb();
    const list = toList(raw);
    const target = list.find((d) => d.id === id);
    const next = list.filter((d) => d.id !== id);
    if (next.length === list.length) throw err(404, 'dua nahi mili');
    try {
      await Promise.all(['_ar.mp3', '_ur.mp3', '_ar_timing.jsonl',
        '_ur_timing.jsonl', '_merged.wav'].map((s) =>
        F.rm(path.join(TEMP, id + s), {force: true}).catch(() => {})));
      await F.rm(path.join(REMOTION, 'public', 'audio', id + '.mp3'), {force: true}).catch(() => {});
      await F.rm(path.join(DATA, id + '.json'), {force: true}).catch(() => {});
      if (target && target.title) {
        const t = safeTitle(target.title);
        await Promise.all([path.join(OUT, t + '.mp4'),
          path.join(OUT, t + '.txt'),
          path.join(OUT, 'thumbs', t + '.png'),
          path.join(OUT, 'thumbs', id + '.png')].map((fp) =>
          F.rm(fp, {force: true}).catch(() => {})));
      }
      // remove id-based thumb when no title target (id + '.png')
      await F.rm(path.join(OUT, 'thumbs', id + '.png'), {force: true}).catch(() => {});
      delete cacheStore[id]; saveCache();
      delete qcStore[id]; saveQc();
    } catch (e) { log('cleanup warning: ' + e.message); }
    await writeDuaDb(raw, next);
    log('DUA DELETED (+files cleaned): ' + id);
    send(res, 200, JSON.stringify({ok: true}));
  }

  // ══════════════════════════════════════════════════════════════
  //  ROUTE HANDLER — returns true if request was handled
  // ══════════════════════════════════════════════════════════════
  return function handleDua(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── GET /api/duas ──
    if (method === 'GET' && p === '/api/duas') {
      routeCatch(res, async () => {
        let raw;
        try { raw = await readDuaDb(); }
        catch (e) { throw err(500, 'duas.json missing or corrupt'); }
        const all = toList(raw);
        const normRef = (s) => String(s || '').toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ').trim();
        const refCount = {};
        all.forEach((d) => {
          const r = normRef(d.reference);
          if (r) refCount[r] = (refCount[r] || 0) + 1;
        });
        const list = all.filter((d) => !d.archived && !d.locked);
        const themed = list.map((d) => Object.assign({}, d, {
          theme: themeMap.resolve(d),
          refShared: !!(normRef(d.reference) && refCount[normRef(d.reference)] > 1),
        }));
        const statuses = await Promise.all(themed.map(duaStatus));
        send(res, 200, JSON.stringify({duas: statuses}));
      });
      return true;
    }

    // ── POST /api/add-dua ──
    if (method === 'POST' && p === '/api/add-dua') {
      readBody(req, res).then((body) => {
        routeCatch(res, () => doAdd(res, body));
      }, () => {});
      return true;
    }

    // ── POST /api/update-dua ──
    if (method === 'POST' && p === '/api/update-dua') {
      readBody(req, res).then((body) => {
        routeCatch(res, () => doUpdate(res, body));
      }, () => {});
      return true;
    }

    // ── POST /api/delete-dua ──
    if (method === 'POST' && p === '/api/delete-dua') {
      readBody(req, res).then((body) => {
        routeCatch(res, () => doDelete(res, body));
      }, () => {});
      return true;
    }

    // ── GET /api/ai-config ──
    if (method === 'GET' && p === '/api/ai-config') {
      routeCatch(res, async () => {
        const cfgPath = path.join(PROJECT, 'data', 'ai_api_config.json');
        try {
          const cfg = JSON.parse((await F.readFile(cfgPath, 'utf8')).replace(/^\uFEFF/, ''));
          send(res, 200, JSON.stringify({ok: true, config: cfg}));
        } catch (_) {
          send(res, 200, JSON.stringify({ok: true, config: null}));
        }
      });
      return true;
    }

    // ── POST /api/ai-config (save base_url + api_keys + models) ──
    if (method === 'POST' && p === '/api/ai-config') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const cfg = parseJson(body, 'ai-config');
          const baseUrl = cleanStr(cfg.base_url, 300, 'base_url') || 'https://aihubmix.com/v1';
          if (!/^https?:\/\//i.test(baseUrl)) throw err(400, 'base_url http(s):// se shuru hona chahiye');
          const apiKeys = (Array.isArray(cfg.api_keys) ? cfg.api_keys : [])
            .map((k) => String(k || '').replace(/[\u0000-\u001F]/g, '').trim())
            .filter(Boolean).filter((k) => k.length <= 256);
          const models = (Array.isArray(cfg.models) ? cfg.models : [])
            .map((m) => String(m || '').replace(/[\u0000-\u001F]/g, '').trim())
            .filter(Boolean).filter((m) => m.length <= 128);
          if (!apiKeys.length) throw err(400, 'Kam se kam 1 API key chahiye');
          if (!models.length) models.push('minimax-m3-free', 'gemini-3.7-flash-free');
          const cleaned = {base_url: baseUrl, api_keys: apiKeys, models};
          await F.writeFile(path.join(PROJECT, 'data', 'ai_api_config.json'),
            JSON.stringify(cleaned, null, 2), 'utf8');
          send(res, 200, JSON.stringify({ok: true, config: cleaned}));
        });
      }, () => {});
      return true;
    }

    // ── POST /api/ai-import ──
    if (method === 'POST' && p === '/api/ai-import') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'ai-import');
          const count = Math.min(Math.max(parseInt(f.count, 10) || 5, 1), 10);
          const category = cleanStr(f.category, 60, 'category') || 'general';
          const topic = cleanStr(f.topic, 200, 'topic');
          const args = [path.join('scripts', 'ai_import.py'),
            '--count', String(count), '--category', category];
          if (topic) args.push('--topic', topic);
          const {spawn} = require('child_process');
          const py = spawn(process.env.PYTHON || 'python', args,
            {cwd: REMOTION, windowsHide: true});
          let out = '';
          let procErr = '';
          py.stdout.on('data', (d) => { out += d.toString(); });
          py.stderr.on('data', (d) => { procErr += d.toString(); });
          py.on('close', (code) => {
            try {
              const last = out.trim().split(/\r?\n/).pop() || '{}';
              const result = JSON.parse(last);
              if (!res.headersSent && !res.writableEnded) {
                send(res, 200, JSON.stringify(result));
              }
            } catch (e) {
              if (!res.headersSent && !res.writableEnded) {
                send(res, code === 0 ? 200 : 500, JSON.stringify({
                  ok: code === 0, added: 0,
                  error: procErr.slice(0, 500) || 'parse error',
                  output: out.slice(-500),
                }));
              }
            }
          });
          py.on('error', (e) => {
            if (!res.headersSent && !res.writableEnded) {
              send(res, 500, JSON.stringify({ok: false, error: String(e.message)}));
            }
          });
        });
      }, () => {});
      return true;
    }

    return false; // not handled
  };
};