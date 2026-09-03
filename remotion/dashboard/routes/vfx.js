'use strict';
/**
 * AI VFX & Preset Import routes (Phase 2).
 * Async I/O + strict input sanitization + graceful errors.
 * Factory: vfxRoutes(deps) → handler(req, url, res) → boolean
 *
 * - GET  /api/vfx/list     → active patterns/plugins + fingerprint registry
 * - POST /api/vfx/import   → batch import (dryRun=1 → preview/validate only)
 * - POST /api/vfx/preview  → on-demand Remotion still (system Chrome pipeline)
 * - GET  /vfx-preview/*.png→ serve rendered preview stills
 */
module.exports = function vfxRoutes(deps) {
  const {PROJECT, REMOTION, TEMP, OUT, CHROME,
    fs, path, spawn, process, send, lookspec, themeMap, log} = deps;
  const F = fs.promises;
  const customVfx = require('../custom-vfx');
  const {err, parseJson, readBody, routeCatch, exists} = require('./utils');

  // ── Preview cache (fingerprint-based) ──
  const previewCache = new Map(); // fp -> {url, ts}
  const PREVIEW_CACHE_TTL = 300000; // 5 min
  const PREVIEW_CACHE_MAX = 100;

  function previewFingerprint(duaId, patternId, frameNo, theme, overrides) {
    const key = [duaId, patternId || '', frameNo, theme,
      JSON.stringify(overrides || {})].join('|');
    return crypto.createHash('md5').update(key).digest('hex').slice(0, 16);
  }

  function getCachedPreview(fp) {
    const e = previewCache.get(fp);
    if (!e) return null;
    if (Date.now() - e.ts > PREVIEW_CACHE_TTL) { previewCache.delete(fp); return null; }
    return e;
  }

  function setCachedPreview(fp, url) {
    if (previewCache.size >= PREVIEW_CACHE_MAX) {
      const oldest = previewCache.keys().next().value;
      previewCache.delete(oldest);
    }
    previewCache.set(fp, {url, ts: Date.now()});
  }

  // ── Concurrency limit for preview renders ──
  const PREVIEW_MAX_CONCURRENT = 2;
  let previewRunning = 0;
  const previewQueue = [];

  function previewAcquire() {
    return new Promise((resolve) => {
      const tryRun = () => {
        if (previewRunning < PREVIEW_MAX_CONCURRENT) {
          previewRunning++;
          resolve({release: () => { previewRunning--; if (previewQueue.length) previewQueue.shift()(); }});
        } else {
          previewQueue.push(tryRun);
        }
      };
      tryRun();
    });
  }


  const THEMES = ['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
    'ocean', 'desert', 'royal', 'ramadan', 'eid', 'qadr'];
  const DUA_ID_RE = /^[a-z0-9_\-]{1,80}$/;


  // ── Graceful errors / helpers ──
  async function loadDuas() {
    try {
      const txt = (await F.readFile(path.join(PROJECT, 'data', 'duas.json'), 'utf8'))
        .replace(/^\uFEFF/, '');
      const raw = JSON.parse(txt);
      return Array.isArray(raw) ? raw : raw.duas || [];
    } catch (_) { return []; }
  }

  // single-shot remotion still (mirrors render.js genThumb pipeline)
  function runStill(cmd, args) {
    return new Promise((resolve) => {
      const p = spawn(cmd, args, {cwd: REMOTION, windowsHide: true});
      let errTail = '';
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          log('PREVIEW TIMEOUT: 60s exceeded, killing process');
          try { p.kill('SIGKILL'); } catch (_) {}
          resolve(-1);
        }
      }, 60000);
      p.stdout.on('data', (d) => {
        const t = String(d).trim();
        if (t) log('PREVIEW: ' + t.split(/\r?\n/).pop());
      });
      p.stderr.on('data', (d) => {
        errTail += d.toString();
        if (errTail.length > 800) errTail = errTail.slice(-800);
      });
      p.on('close', (code) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        if (code !== 0 && errTail.trim()) {
          log('PREVIEW FAIL: ' + errTail.trim().split(/\r?\n/).pop().slice(0, 300));
        }
        resolve(code == null ? -1 : code);
      });
      p.on('error', (e) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        log('PREVIEW SPAWN ERROR: ' + e.message);
        resolve(-1);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  ROUTE HANDLER — returns true if request was handled
  // ══════════════════════════════════════════════════════════════
  const handler = function handleVfx(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── GET /api/vfx/list ──
    if (method === 'GET' && p === '/api/vfx/list') {
      routeCatch(res, async () => {
        const pack = customVfx.load(PROJECT);
        const idx = customVfx.buildIndex(pack);
        const patterns = idx.patternRecords.map((r) => ({
          id: r.id, label: r.label, fingerprint: r.fp, descriptor: r.desc,
        }));
        const plugins = idx.pluginRecords.map((r) => ({
          id: r.id, label: r.label, fingerprint: r.fp, plugin: r.pl,
        }));
        send(res, 200, JSON.stringify({
          ok: true,
          patterns, plugins,
          master: customVfx.masterSummary(pack),
          indexes: {
            patterns: Object.fromEntries(idx.patternFps),
            plugins: Object.fromEntries(idx.pluginFps),
          },
        }));
      });
      return true;
    }

    // ── POST /api/vfx/import ──
    if (method === 'POST' && p === '/api/vfx/import') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'vfx/import');
          const items = Array.isArray(f.items) ? f.items : null;
          if (!items) throw err(400, 'items array required');
          const dryRun = f.dryRun === true || f.dryRun === 1 || String(f.dryRun) === '1';
          const r = customVfx.importBatch(PROJECT, {items, dryRun});
          send(res, 200, JSON.stringify({ok: true, dryRun,
            changed: r.changed,
            added: r.added, similar: r.similar,
            duplicates: r.duplicates, invalid: r.invalid,
            results: r.results}));
        });
      }, () => {});
      return true;
    }

    // ── POST /api/vfx/preview ──
    if (method === 'POST' && p === '/api/vfx/preview') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'vfx/preview');
          const duas = await loadDuas();
          let duaId = String(f.duaId || '').trim();
          if (!duaId || !DUA_ID_RE.test(duaId)) duaId = (duas[0] || {}).id || '';
          if (!duaId) throw err(404, 'koi dua nahi mili (preview)');
          const dua = duas.find((d) => d.id === duaId);
          if (!dua) throw err(404, 'dua nahi mili: ' + duaId);

          const pack = customVfx.load(PROJECT);
          let patternDesc = null;
          const patternId = String(f.patternId || '').trim();
          if (patternId) {
            const rec = pack && pack.patterns[patternId];
            if (!rec) throw err(404, 'pattern nahi mila: ' + patternId);
            patternDesc = rec;
          } else if (f.frame && typeof f.frame === 'object') {
            patternDesc = customVfx.sanitizePattern(f.frame);
            if (!patternDesc) throw err(400, 'inline frame invalid');
          } else if (f.themeItem && typeof f.themeItem === 'object') {
            // Theme preview - apply theme to lookSpec
            const themeSan = customVfx.sanitizeThemeItem(f.themeItem);
            if (!themeSan) throw err(400, 'theme item invalid');
            patternDesc = null; // No pattern for theme preview
          } else if (f.typographyItem && typeof f.typographyItem === 'object') {
            // Typography preview
            const typoSan = customVfx.sanitizeTypographyItem(f.typographyItem);
            if (!typoSan) throw err(400, 'typography item invalid');
            patternDesc = null;
          } else if (f.motionItem && typeof f.motionItem === 'object') {
            // Motion preview
            const motionSan = customVfx.sanitizeMotionItem(f.motionItem);
            if (!motionSan) throw err(400, 'motion item invalid');
            patternDesc = null;
          } else if (f.audioItem && typeof f.audioItem === 'object') {
            // Audio preview
            const audioSan = customVfx.sanitizeAudioItem(f.audioItem);
            if (!audioSan) throw err(400, 'audio item invalid');
            patternDesc = null;
          } else {
            throw err(400, 'patternId, inline frame, ya master item (theme/typography/motion/audio) required');
          }
          const overrides = customVfx.sanitizeOverrides(f.styleOverrides);
          const frameNo = Math.max(0, Math.min(300, parseInt(f.frameNo, 10) || 75));
          const theme = THEMES.includes(String(f.theme || '')) ? String(f.theme) : 'dark';

          let look = null;
          try {
            const lf = path.join(TEMP, duaId + '_look.json');
            if (await exists(lf)) {
              const j = JSON.parse((await F.readFile(lf, 'utf8')).replace(/^\uFEFF/, ''));
              look = (j && j.lookSpec) || null;
            }
          } catch (_) { look = null; }
          if (!look) look = lookspec.buildLookSpec(theme);

          // Apply VFX based on type
          if (patternDesc) {
            const vfx = {frame: patternDesc};
            if (overrides) vfx.styleOverrides = overrides;
            look.vfx = vfx;
          } else if (f.themeItem) {
            // Apply theme decor and grade
            const themeSan = customVfx.sanitizeThemeItem(f.themeItem);
            if (themeSan && themeSan.payload) {
              if (themeSan.payload.decor) look.decor = themeSan.payload.decor;
              if (themeSan.payload.grade) {
                look.grade = Object.assign(look.grade || {}, themeSan.payload.grade);
              }
            }
          } else if (f.typographyItem) {
            // Apply typography settings
            const typoSan = customVfx.sanitizeTypographyItem(f.typographyItem);
            if (typoSan) {
              look.typography = Object.assign(look.typography || {}, typoSan);
            }
          } else if (f.motionItem) {
            // Apply motion settings
            const motionSan = customVfx.sanitizeMotionItem(f.motionItem);
            if (motionSan) {
              look.motion = Object.assign(look.motion || {}, motionSan);
            }
          } else if (f.audioItem) {
            // Apply audio settings
            const audioSan = customVfx.sanitizeAudioItem(f.audioItem);
            if (audioSan) {
              look.audio = Object.assign(look.audio || {}, audioSan);
            }
          }

          // Check fingerprint cache first
          const fp = previewFingerprint(duaId, patternId, frameNo, theme, overrides);
          const cached = getCachedPreview(fp);
          if (cached && await exists(path.join(OUT, 'previews', path.basename(cached.url)))) {
            return send(res, 200, JSON.stringify({ok: true,
              url: cached.url, patternId: patternId || null,
              duaId, frame: frameNo, theme, cached: true,
              exists: true}));
          }

          // Acquire concurrency slot
          const lock = await previewAcquire();
          try {
            const stamp = Date.now();
            const props = path.join(TEMP, 'vfx_preview_' + duaId + '_' + stamp + '.json');
            await F.writeFile(props, JSON.stringify({lookSpec: look}), 'utf8');

            const compId = duaId.replace(/_/g, '-');
            const itemType = patternId ? patternId : (f.themeItem ? 'theme' : (f.typographyItem ? 'typography' : (f.motionItem ? 'motion' : 'audio')));
            const name = 'vfx-p-' + itemType + '-' + duaId + '-f' + frameNo + '-' + stamp + '.png';
            await F.mkdir(path.join(OUT, 'previews'), {recursive: true});
            const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
            const code = await runStill(process.execPath, [
              cli, 'still', compId, 'out/previews/' + name,
              '--frame=' + frameNo, '--browser-executable=' + CHROME,
              '--log=error', '--props=' + props,
            ]);
            try { await F.rm(props, {force: true}); } catch (_) {}

            if (code !== 0) {
              throw err(502, 'preview render fail (exit ' + code +
                ') — dua ka manifest/audio present hona chahiye');
            }
            const previewUrl = '/vfx-preview/' + name;
            setCachedPreview(fp, previewUrl);
            send(res, 200, JSON.stringify({ok: true,
              url: previewUrl, patternId: patternId || null,
              duaId, frame: frameNo, theme,
              exists: await exists(path.join(OUT, 'previews', name))}));
          } finally {
            lock.release();
          }
        });
      }, () => {});
      return true;
    }

    // ── GET /vfx-preview/*.png ──
    if (method === 'GET' && p.startsWith('/vfx-preview/')) {
      const base = p.slice('/vfx-preview/'.length);
      if (!/^[\w.-]+\.png$/.test(base)) return send(res, 404, 'bad name', 'text/plain');
      const file = path.join(OUT, 'previews', path.basename(base));
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'image/png', 'Cache-Control': 'no-store'});
      fs.createReadStream(file).pipe(res);
      return true;
    }

    // ── GET /api/vfx/weights ──
    if (method === 'GET' && p === '/api/vfx/weights') {
      routeCatch(res, async () => {
        const wPath = path.join(PROJECT, 'data', 'vfx_weights.json');
        let weights = {};
        try { weights = JSON.parse((await F.readFile(wPath, 'utf8'))); } catch (_) {}
        send(res, 200, JSON.stringify({ok: true, weights}));
      });
      return true;
    }

    // ── POST /api/vfx/weights ──
    if (method === 'POST' && p === '/api/vfx/weights') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'vfx/weights');
          const weights = {};
          const validKeys = ['neon_glow', 'metallic_gold', 'typewriter', 'wave',
            'glitch', 'vignette', 'grain', 'breathing', 'gold_shimmer',
            'rtl_reveal', 'word_pulse'];
          for (const [k, v] of Object.entries(f.weights || {})) {
            if (validKeys.includes(k) && typeof v === 'number' && v >= 0 && v <= 10) {
              weights[k] = Math.round(v * 10) / 10;
            }
          }
          const wPath = path.join(PROJECT, 'data', 'vfx_weights.json');
          await F.writeFile(wPath, JSON.stringify(weights, null, 2), 'utf8');
          send(res, 200, JSON.stringify({ok: true, weights}));
        });
      }, () => {});
      return true;
    }

    return false; // not handled
  };
  return handler;
};