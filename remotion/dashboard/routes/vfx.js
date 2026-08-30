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

  const THEMES = ['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
    'ocean', 'desert', 'royal', 'ramadan', 'eid', 'qadr'];
  const DUA_ID_RE = /^[a-z0-9_\-]{1,80}$/;

  // ── Graceful errors / helpers ──
  function err(code, msg) { const e = new Error(msg); e.statusCode = code; return e; }
  function parseJson(body, label) {
    try { return JSON.parse(body || '{}'); }
    catch (_) { throw err(400, 'bad JSON payload' + (label ? ' (' + label + ')' : '')); }
  }
  function routeCatch(res, fn) {
    return Promise.resolve().then(fn).catch((e) => {
      const code = (e && e.statusCode) || 500;
      const msg = (e && e.message) || String(e);
      if (!res.headersSent && !res.writableEnded) {
        send(res, code, JSON.stringify({ok: false, error: msg}));
      } else {
        log('vfx route error after send: ' + msg);
      }
    });
  }
  function readBody(req, res) {
    return new Promise((resolve, reject) => {
      let body = '';
      let settled = false;
      const abort = () => {
        settled = true;
        if (!res.headersSent && !res.writableEnded) {
          send(res, 413, JSON.stringify({ok: false, error: 'payload too large (max 1MB)'}));
        }
        try { req.destroy(); } catch (_) {}
        reject(err(413, 'aborted'));
      };
      req.on('data', (c) => {
        if (body.length > 1e6) return abort();
        body += c;
      });
      req.on('end', () => { if (!settled) { settled = true; resolve(body); } });
      req.on('error', (e) => { if (!settled) { settled = true; reject(e); } });
      req.on('close', () => { if (!settled) { settled = true; reject(err(400, 'connection closed')); } });
    });
  }
  async function exists(p) { return F.access(p).then(() => true).catch(() => false); }
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
      p.stdout.on('data', (d) => {
        const t = String(d).trim();
        if (t) log('PREVIEW: ' + t.split(/\r?\n/).pop());
      });
      p.stderr.on('data', (d) => {
        errTail += d.toString();
        if (errTail.length > 800) errTail = errTail.slice(-800);
      });
      p.on('close', (code) => {
        if (code !== 0 && errTail.trim()) {
          log('PREVIEW FAIL: ' + errTail.trim().split(/\r?\n/).pop().slice(0, 300));
        }
        resolve(code == null ? -1 : code);
      });
      p.on('error', (e) => { log('PREVIEW SPAWN ERROR: ' + e.message); resolve(-1); });
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
          let frame = null;
          const patternId = String(f.patternId || '').trim();
          if (patternId) {
            const rec = pack && pack.patterns[patternId];
            if (!rec) throw err(404, 'pattern nahi mila: ' + patternId);
            frame = rec;
          } else if (f.frame && typeof f.frame === 'object') {
            frame = customVfx.sanitizePattern(f.frame);
            if (!frame) throw err(400, 'inline frame invalid');
          } else {
            throw err(400, 'patternId ya inline frame required');
          }
          const overrides = customVfx.sanitizeOverrides(f.styleOverrides);
          const frameNo = Math.max(0, Math.min(300, parseInt(f.frame, 10) || 75));
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

          const vfx = {frame};
          if (overrides) vfx.styleOverrides = overrides;
          look.vfx = vfx;

          const stamp = Date.now();
          const props = path.join(TEMP, 'vfx_preview_' + duaId + '_' + stamp + '.json');
          await F.writeFile(props, JSON.stringify({lookSpec: look}), 'utf8');

          const compId = duaId.replace(/_/g, '-');
          const name = 'vfx-p-' + (patternId || 'inline') + '-' + duaId + '-f' + frameNo + '-' + stamp + '.png';
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
          await F.rm(path.join(TEMP, 'vfx_preview_' + duaId + '_' + stamp + '.json'), {force: true}).catch(() => {});
          send(res, 200, JSON.stringify({ok: true,
            url: '/vfx-preview/' + name, patternId: patternId || null,
            duaId, frame: frameNo, theme,
            exists: await exists(path.join(OUT, 'previews', name))}));
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

    return false; // not handled
  };
  return handler;
};