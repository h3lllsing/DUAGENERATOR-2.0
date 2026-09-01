'use strict';
/**
 * Shared utilities for dashboard routes.
 * Extracted from render.js, vfx.js, duas.js to eliminate duplication.
 */

function err(code, msg) {
  const e = new Error(msg);
  e.statusCode = code;
  return e;
}

function parseJson(body, label) {
  try { return JSON.parse(body || '{}'); }
  catch (_) { throw err(400, 'bad JSON payload' + (label ? ' (' + label + ')' : '')); }
}

function cleanStr(v, max, label) {
  if (v == null) return '';
  const s = String(v).trim().slice(0, max || 200);
  if (!s) throw err(400, label + ' is required');
  return s;
}

function readBody(req, res) {
  return new Promise((resolve, reject) => {
    let body = '';
    let settled = false;
    const abort = () => {
      settled = true;
      if (!res.headersSent && !res.writableEnded) {
        res.writeHead(413, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ok: false, error: 'payload too large (max 1MB)'}));
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

function routeCatch(res, fn, logFn) {
  return Promise.resolve().then(fn).catch((e) => {
    const code = (e && e.statusCode) || 500;
    const msg = (e && e.message) || String(e);
    if (!res.headersSent && !res.writableEnded) {
      res.writeHead(code, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ok: false, error: msg}));
    } else if (logFn) {
      logFn('route error after send: ' + msg);
    }
  });
}

async function exists(p, fs) {
  try {
    await fs.access(p);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {err, parseJson, cleanStr, readBody, routeCatch, exists};
