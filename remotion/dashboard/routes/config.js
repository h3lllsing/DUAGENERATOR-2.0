'use strict';
/**
 * Config routes — extracted from server.js (v0.11 step 4d).
 * Factory: configRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function configRoutes(deps) {
  const {CFG_PATH, fs, send, writeAtomic, log, STYLE_PRESETS, fxg} = deps;
  const {readBody} = require('./utils');

  // ── Config cache (5s TTL) ──
  let _cfgCache = null;
  let _cfgCacheTime = 0;
  const CFG_CACHE_TTL = 5000;

  function readConfigCached() {
    const now = Date.now();
    if (_cfgCache && (now - _cfgCacheTime) < CFG_CACHE_TTL) {
      return _cfgCache;
    }
    try {
      _cfgCache = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      _cfgCacheTime = now;
      return _cfgCache;
    } catch (_) {
      _cfgCache = {channelName: '', handle: ''};
      _cfgCacheTime = now;
      return _cfgCache;
    }
  }

  function invalidateConfigCache() {
    _cfgCache = null;
    _cfgCacheTime = 0;
  }


  return function handleConfig(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── GET /api/config ──
    if (method === 'GET' && p === '/api/config') {
      const cfg = readConfigCached();
      return send(res, 200, JSON.stringify(cfg));
    }

    // ── POST /api/config ──
    if (method === 'POST' && p === '/api/config') {
      readBody(req, res).then((body) => {
        try {
          const f = JSON.parse(body);
          const old = readConfigCached();
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
          invalidateConfigCache();
          log('CONFIG SAVED: ' + JSON.stringify(cfg));
          send(res, 200, JSON.stringify({ok: true}));
        } catch (e) { send(res, 400, JSON.stringify({ok: false})); }
      });
      return true;
    }

    return false; // not handled
  };
};
