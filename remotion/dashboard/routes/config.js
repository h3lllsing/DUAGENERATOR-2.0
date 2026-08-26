'use strict';
/**
 * Config routes — extracted from server.js (v0.11 step 4d).
 * Factory: configRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function configRoutes(deps) {
  const {CFG_PATH, fs, path, send, writeAtomic, log, STYLE_PRESETS, fxg} = deps;

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

  return function handleConfig(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── GET /api/config ──
    if (method === 'GET' && p === '/api/config') {
      let cfg = {channelName: '', handle: ''};
      try {
        cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')));
      } catch (_) {}
      return send(res, 200, JSON.stringify(cfg));
    }

    // ── POST /api/config ──
    if (method === 'POST' && p === '/api/config') {
      readBody(req, res, (body) => {
        try {
          const f = JSON.parse(body);
          let old = {};
          try { old = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); } catch (_) {}
          const cfg = Object.assign({}, old, {
            channelName: String(f.channelName != null ? f.channelName : old.channelName || '').trim().slice(0, 60),
            handle: String(f.handle != null ? f.handle : old.handle || '').trim().slice(0, 40),
          });
          if (f.stylePreset !== undefined) {
            cfg.stylePreset = STYLE_PRESETS.includes(f.stylePreset)
              ? f.stylePreset : 'classic';
          }
          if (f.lookMode !== undefined) {
            cfg.lookMode = f.lookMode === 'signature' ? 'signature' : 'random';
          }
          if (f.artFx !== undefined) {
            cfg.artFx = fxg.ART_SELECT.includes(f.artFx) ? f.artFx : 'auto';
          }
          if (f.skyFx !== undefined) {
            cfg.skyFx = fxg.SKY_SELECT.includes(f.skyFx) ? f.skyFx : 'auto';
          }
          if (f.borderFx !== undefined) {
            cfg.borderFx = fxg.BORDER_SELECT.includes(f.borderFx)
              ? f.borderFx : 'auto';
          }
          writeAtomic(CFG_PATH, JSON.stringify(cfg, null, 2));
          log('CONFIG SAVED: ' + JSON.stringify(cfg));
          send(res, 200, JSON.stringify({ok: true}));
        } catch (e) { send(res, 400, JSON.stringify({ok: false})); }
      });
      return true;
    }

    return false; // not handled
  };
};
