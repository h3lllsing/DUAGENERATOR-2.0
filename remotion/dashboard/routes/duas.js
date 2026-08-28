'use strict';
/**
 * Dua CRUD routes — extracted from server.js (v0.11 step 4c).
 * Factory: duaRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function duaRoutes(deps) {
  const {PROJECT, TEMP, REMOTION, DATA, OUT,
    fs, path, send, writeAtomic, safeTitle, log,
    cacheStore, saveCache, qcStore, saveQc,
    duaStatus, themeMap} = deps;

  function readBody(req, res, cb) {
    let body = '';
    req.on('data', (c) => {
      if (body.length > 1e6) {
        if (!res.headersSent) send(res, 413, JSON.stringify({ok: false, error: 'payload too large (max 1MB)'}));
        setTimeout(() => { try { req.destroy(); } catch (e) {} }, 100);
        return;
      }
      body += c;
    });
    req.on('end', () => cb(body));
  }

  // ══════════════════════════════════════════════════════════════
  //  ROUTE HANDLER — returns true if request was handled
  // ══════════════════════════════════════════════════════════════
  return function handleDua(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── GET /api/duas ──
    if (method === 'GET' && p === '/api/duas') {
      const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8').replace(/^\uFEFF/, ''));
      const all = Array.isArray(raw) ? raw : raw.duas;
      const normRef = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
      return send(res, 200, JSON.stringify({duas: themed.map(duaStatus)}));
    }

    // ── POST /api/add-dua ──
    if (method === 'POST' && p === '/api/add-dua') {
      readBody(req, res, (body) => {
        try {
          const f = JSON.parse(body);
          const required = ['title', 'arabic', 'urdu'];
          for (const k of required) {
            if (!f[k] || !String(f[k]).trim()) {
              return send(res, 400, JSON.stringify({ok: false, error: k + ' zaroori hai'}));
            }
          }
          const urduWords = String(f.urdu).trim().match(/\S+/g)?.length || 0;
          if (urduWords > 75) {
            return send(res, 400, JSON.stringify({ok: false,
              error: 'Urdu tarjuma bohot lambi hai (' + urduWords + ' words, max 75). Video 40 sec se lambi banegi aur render fail hogi'}));
          }
          const dbPath = path.join(PROJECT, 'data', 'duas.json');
          if (!fs.existsSync(dbPath.replace(/duas\.json$/, 'duas.backup.json'))) {
            fs.copyFileSync(dbPath, dbPath.replace(/duas\.json$/, 'duas.backup.json'));
          }
          const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const list = Array.isArray(raw) ? raw : raw.duas;
          let id = String(f.id || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '').replace(/_{2,}/g, '_');
          if (!id) {
            id = String(f.title || '').trim().toLowerCase()
              .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          }
          if (!id) id = 'custom_' + Date.now();
          while (list.some((d) => d.id === id)) id = id + '_new';
          const entry = {
            id,
            category: String(f.category || 'general').trim() || 'general',
            title: String(f.title).trim(),
            arabic: String(f.arabic).trim(),
            urdu: String(f.urdu).trim(),
            explanation: String(f.explanation || '').trim(),
            reference: String(f.reference || 'Custom').trim() || 'Custom',
            voice_arabic: String(f.voiceArabic || 'ar-SA-HamedNeural'),
            voice_urdu: String(f.voiceUrdu || 'ur-PK-AsadNeural'),
            template: ['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
              'ocean', 'desert', 'royal', 'ramadan', 'eid',
              'qadr'].includes(f.template) ? f.template : 'dark',
            bismillah: f.bismillah !== false,
            duration: 15,
          };
          list.push(entry);
          writeAtomic(dbPath, JSON.stringify(
            Array.isArray(raw) ? list : Object.assign({}, raw, {duas: list}),
            null, 2));
          log('NEW DUA ADDED: ' + id);
          send(res, 200, JSON.stringify({ok: true, id}));
        } catch (e) {
          send(res, 500, JSON.stringify({ok: false, error: String(e.message || e)}));
        }
      });
      return true;
    }

    // ── POST /api/update-dua ──
    if (method === 'POST' && p === '/api/update-dua') {
      readBody(req, res, (body) => {
        try {
          const f = JSON.parse(body);
          if (!f.id) return send(res, 400, JSON.stringify({ok: false, error: 'id zaroori hai'}));
          if (f.urdu !== undefined && String(f.urdu).trim()) {
            const uw = String(f.urdu).trim().match(/\S+/g)?.length || 0;
            if (uw > 75) {
              return send(res, 400, JSON.stringify({ok: false,
                error: 'Urdu tarjuma bohot lambi hai (' + uw + ' words, max 75). Video 40 sec se lambi banegi aur render fail hogi'}));
            }
          }
          const dbPath = path.join(PROJECT, 'data', 'duas.json');
          const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const list = Array.isArray(raw) ? raw : raw.duas;
          const idx = list.findIndex((d) => d.id === f.id);
          if (idx < 0) return send(res, 404, JSON.stringify({ok: false, error: 'dua nahi mili'}));
          const d = list[idx];
          if (fs.existsSync(path.join(OUT, safeTitle(String(d.title || '')) + '.mp4'))) {
            return send(res, 409, JSON.stringify({ok: false,
              error: 'RENDERED video edit nahi hoti (text/voice video ke andar baked hai). Isay delete karke naya banao'}));
          }
          if (f.title && String(f.title).trim()) d.title = String(f.title).trim();
          if (f.arabic && String(f.arabic).trim()) d.arabic = String(f.arabic).trim();
          if (f.urdu && String(f.urdu).trim()) d.urdu = String(f.urdu).trim();
          if (f.reference !== undefined) d.reference = String(f.reference).trim() || d.reference;
          if (f.category) d.category = String(f.category).trim();
          d.bismillah = f.bismillah !== false;
          if (['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
            'ocean', 'desert', 'royal', 'ramadan', 'eid',
            'qadr'].includes(f.template)) d.template = f.template;
          if (f.voiceArabic) d.voice_arabic = String(f.voiceArabic);
          if (f.voiceUrdu) d.voice_urdu = String(f.voiceUrdu);
          writeAtomic(dbPath, JSON.stringify(
            Array.isArray(raw) ? list : Object.assign({}, raw, {duas: list}),
            null, 2));
          log('DUA UPDATED: ' + f.id);
          send(res, 200, JSON.stringify({ok: true, id: f.id}));
        } catch (e) {
          send(res, 500, JSON.stringify({ok: false, error: String(e.message || e)}));
        }
      });
      return true;
    }

    // ── POST /api/delete-dua ──
    if (method === 'POST' && p === '/api/delete-dua') {
      readBody(req, res, (body) => {
        try {
          const {id} = JSON.parse(body);
          const dbPath = path.join(PROJECT, 'data', 'duas.json');
          const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const list = Array.isArray(raw) ? raw : raw.duas;
          const target = list.find((d) => d.id === id);
          const next = list.filter((d) => d.id !== id);
          if (next.length === list.length) {
            return send(res, 404, JSON.stringify({ok: false, error: 'dua nahi mili'}));
          }
          try {
            ['_ar.mp3', '_ur.mp3', '_ar_timing.jsonl', '_ur_timing.jsonl',
              '_merged.wav'].forEach((s) => {
              const fp = path.join(TEMP, id + s);
              if (fs.existsSync(fp)) fs.rmSync(fp, {force: true});
            });
            const aud = path.join(REMOTION, 'public', 'audio', id + '.mp3');
            if (fs.existsSync(aud)) fs.rmSync(aud, {force: true});
            const man = path.join(DATA, id + '.json');
            if (fs.existsSync(man)) fs.rmSync(man, {force: true});
            if (target && target.title) {
              const t = safeTitle(target.title);
              [path.join(OUT, t + '.mp4'), path.join(OUT, t + '.txt'),
                path.join(OUT, 'thumbs', t + '.png')].forEach((fp) => {
                if (fs.existsSync(fp)) fs.rmSync(fp, {force: true});
              });
            }
            delete cacheStore[id];
            saveCache();
            delete qcStore[id];
            saveQc();
          } catch (e2) {
            log('cleanup warning: ' + e2.message);
          }
          writeAtomic(dbPath, JSON.stringify(
            Array.isArray(raw) ? next : Object.assign({}, raw, {duas: next}),
            null, 2));
          log('DUA DELETED (+files cleaned): ' + id);
          send(res, 200, JSON.stringify({ok: true}));
        } catch (e) {
          send(res, 500, JSON.stringify({ok: false, error: String(e.message || e)}));
        }
      });
      return true;
    }

    // ── POST /api/duplicate-dua ──
    if (method === 'POST' && p === '/api/duplicate-dua') {
      readBody(req, res, () => {
        send(res, 403, JSON.stringify({ok: false,
          error: 'Duplicate feature band kar di gayi hai'}));
      });
      return true;
    }

    // ── GET /api/ai-config ──
    if (method === 'GET' && p === '/api/ai-config') {
      const cfgPath = path.join(DATA, 'ai_api_config.json');
      try {
        const raw = fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, '');
        const cfg = JSON.parse(raw);
        send(res, 200, JSON.stringify({ok: true, config: cfg}));
      } catch (_) {
        send(res, 200, JSON.stringify({ok: true, config: null}));
      }
      return true;
    }

    // ── POST /api/ai-config (save base_url + api_keys + models) ──
    if (method === 'POST' && p === '/api/ai-config') {
      readBody(req, res, (body) => {
        try {
          const cfg = JSON.parse(body || '{}');
          const cleaned = {
            base_url: String(cfg.base_url || 'https://aihubmix.com/v1').trim(),
            api_keys: (Array.isArray(cfg.api_keys) ? cfg.api_keys : [])
              .map((k) => String(k || '').trim()).filter(Boolean),
            models: (Array.isArray(cfg.models) ? cfg.models : [])
              .map((m) => String(m || '').trim()).filter(Boolean),
          };
          if (!cleaned.api_keys.length) {
            send(res, 400, JSON.stringify({ok: false, error: 'Kam se kam 1 API key chahiye'}));
            return;
          }
          if (!cleaned.models.length) {
            cleaned.models = ['minimax-m3-free', 'gemini-3.7-flash-free'];
          }
          fs.writeFileSync(path.join(DATA, 'ai_api_config.json'),
            JSON.stringify(cleaned, null, 2), 'utf8');
          send(res, 200, JSON.stringify({ok: true, config: cleaned}));
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: String(e.message || e)}));
        }
      });
      return true;
    }

    // ── POST /api/ai-import ──
    if (method === 'POST' && p === '/api/ai-import') {
      readBody(req, res, (body) => {
        try {
          const f = JSON.parse(body || '{}');
          const count = Math.min(Math.max(parseInt(f.count, 10) || 5, 1), 10);
          const category = String(f.category || 'general').trim();
          const topic = String(f.topic || '').trim();
          const args = [path.join('scripts', 'ai_import.py'),
            '--count', String(count),
            '--category', category];
          if (topic) args.push('--topic', topic);
          const {spawn} = require('child_process');
          const py = spawn(process.env.PYTHON || 'python', args,
            {cwd: REMOTION, windowsHide: true});
          let out = '';
          let err = '';
          py.stdout.on('data', (d) => { out += d.toString(); });
          py.stderr.on('data', (d) => { err += d.toString(); });
          py.on('close', (code) => {
            try {
              const last = out.trim().split(/\r?\n/).pop() || '{}';
              const result = JSON.parse(last);
              send(res, 200, JSON.stringify(result));
            } catch (e) {
              send(res, code === 0 ? 200 : 500, JSON.stringify({
                ok: code === 0,
                added: 0,
                error: err.slice(0, 500) || 'parse error',
                output: out.slice(-500),
              }));
            }
          });
          py.on('error', (e) => {
            send(res, 500, JSON.stringify({ok: false, error: String(e.message)}));
          });
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    return false; // not handled
  };
};
