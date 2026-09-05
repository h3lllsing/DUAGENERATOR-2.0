'use strict';
/**
 * Batch processing routes — exposes Python pipeline batch system.
 * Factory: batchRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function batchRoutes(deps) {
  const {REMOTION, path, spawn, send, log} = deps;
  const {parseJson, cleanStr, readBody, routeCatch} = require('./utils');

  const BATCH_SCRIPT = path.join(REMOTION, 'scripts', 'batch_render.py');

  function runBatchCli(payload) {
    return new Promise((resolve) => {
      const p = spawn(process.env.PYTHON || 'python', [BATCH_SCRIPT],
        {cwd: REMOTION, windowsHide: true});
      let out = '';
      let procErr = '';
      p.stdout.on('data', (d) => { out += d.toString(); });
      p.stderr.on('data', (d) => { procErr += d.toString(); });
      p.on('close', (_code) => {
        try {
          const last = out.trim().split(/\r?\n/).pop() || '{}';
          const result = JSON.parse(last);
          resolve(result);
        } catch {
          resolve({ok: false, error: procErr.slice(0, 500) || 'parse error',
            output: out.slice(-500)});
        }
      });
      p.on('error', (e) => {
        resolve({ok: false, error: String(e.message)});
      });
      p.stdin.write(JSON.stringify(payload));
      p.stdin.end();
    });
  }

  return function handleBatch(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── POST /api/batch/start ──
    if (method === 'POST' && p === '/api/batch/start') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'batch-start');
          const duaIds = Array.isArray(f.dua_ids)
            ? f.dua_ids.map((x) => String(x || '').trim()).filter(Boolean)
            : null;
          const theme = cleanStr(f.theme, 40, 'theme') || 'dark';
          const effect = cleanStr(f.effect, 40, 'effect') || 'auto';
          const dryRun = !!f.dry_run;

          const result = await runBatchCli({
            cmd: 'start', dua_ids: duaIds, theme, effect, dry_run: dryRun,
          });
          log('BATCH START via Python: ' + JSON.stringify(result));
          send(res, 200, JSON.stringify(result));
        }, log);
      }, () => {});
      return true;
    }

    // ── GET /api/batch/status ──
    if (method === 'GET' && p === '/api/batch/status') {
      routeCatch(res, async () => {
        const result = await runBatchCli({cmd: 'status'});
        send(res, 200, JSON.stringify(result));
      }, log);
      return true;
    }

    // ── POST /api/batch/cancel ──
    if (method === 'POST' && p === '/api/batch/cancel') {
      routeCatch(res, async () => {
        const result = await runBatchCli({cmd: 'cancel'});
        log('BATCH CANCEL via Python: ' + JSON.stringify(result));
        send(res, 200, JSON.stringify(result));
      }, log);
      return true;
    }

    return false;
  };
};
