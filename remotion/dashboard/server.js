// Dua Video Studio v0.10
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {spawn} = require('child_process');

const PROJECT = 'H:\\DuaVideoGenerator';
const REMOTION = path.join(PROJECT, 'remotion');
const TEMP = path.join(PROJECT, 'temp');
const OUT = path.join(REMOTION, 'out');
const DATA = path.join(REMOTION, 'src', 'data');
const PY = path.join(os.homedir(), 'AppData', 'Local', 'Programs',
  'Python', 'Python312', 'python.exe');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG = path.join(REMOTION, 'node_modules', '@remotion',
  'compositor-win32-x64-msvc', 'ffmpeg.exe');
const PORT = 7860;
const CFG_PATH = path.join(__dirname, 'config.json');

function send(res, code, body, type) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(code, {'Content-Type': type || 'application/json; charset=utf-8'});
  res.end(body);
}
function writeAtomic(f, data) {
  const tmp = f + '.' + Date.now() + '.tmp.json';
  fs.writeFileSync(tmp, data, 'utf8');
  fs.renameSync(tmp, f);
}
function safeTitle(t) {
  return String(t || 'Dua').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
    .trim().replace(/\.mp4$/i, '').replace(/[. ]+$/, '') || 'Dua';
}
function log(line) { console.log(line); }

const CACHE_PATH = path.join(__dirname, 'cache.json');
const QC_PATH2 = path.join(__dirname, 'qc.json');
let cacheStore = {};
try { cacheStore = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (_) {}
let qcStore = {};
try { qcStore = JSON.parse(fs.readFileSync(QC_PATH2, 'utf8')); } catch (_) {}
function saveCache() {
  try { writeAtomic(CACHE_PATH, JSON.stringify(cacheStore, null, 2)); } catch (_) {}
}
function saveQc() {
  try { writeAtomic(QC_PATH2, JSON.stringify(qcStore, null, 2)); } catch (_) {}
}

const PUBLIC_DIR = path.join(__dirname, 'public');
let HTML_CACHE = '';
try { HTML_CACHE = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8'); } catch (_) {}

const fxg = require('./fx-guardrails');
const STYLE_PRESETS = fxg.STYLE_PRESETS || ['auto', 'classic', 'royal', 'minimal',
  'cinematic', 'masterpiece', 'volumetric', 'raytrace', 'embernight',
  'glitterroyal', 'desertmirage', 'waterripple', 'silkmarble', 'cinemafocus',
  'auroranova', 'qadrtilt'];

const deps = {
  PROJECT, REMOTION, TEMP, OUT, DATA, PY, CHROME, FFMPEG, CFG_PATH,
  fs, path, crypto, spawn, process, send, writeAtomic, safeTitle, log,
  cacheStore, saveCache, qcStore, saveQc, fxg, STYLE_PRESETS,
  lookspec: require('./look-spec'), themeMap: require('./theme-map'),
};

const ytHandler = require('./routes/youtube')(Object.assign({}, deps, {
  getDuaTitle: function(id) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.duas;
      const d = list.find((x) => x.id === id);
      return d ? d.title : id;
    } catch (_) { return id; }
  },
}));
const renderHandler = require('./routes/render')(deps);
const duaHandler = require('./routes/duas')(Object.assign({}, deps, {
  duaStatus: renderHandler.duaStatus,
}));
const configHandler = require('./routes/config')(deps);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin || '';
  if (origin && url.pathname.startsWith('/api/') &&
      !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin)) {
    return send(res, 403, JSON.stringify({ok: false, error: 'cross-origin blocked'}));
  }
  if (ytHandler(req, url, res)) return;
  if (renderHandler(req, url, res)) return;
  if (duaHandler(req, url, res)) return;
  if (configHandler(req, url, res)) return;
  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, HTML_CACHE, 'text/html; charset=utf-8');
  }
  const ext = path.extname(url.pathname);
  if (ext && ['.css', '.js', '.png', '.jpg', '.ico', '.svg', '.json'].includes(ext)) {
    const fp = path.join(PUBLIC_DIR, url.pathname.slice(1));
    if (fs.existsSync(fp)) {
      const types = {'.css':'text/css','.js':'application/javascript','.png':'image/png',
        '.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
      return send(res, 200, fs.readFileSync(fp), types[ext] || 'application/octet-stream');
    }
  }
  send(res, 404, '{"error":"not found"}');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Server already running on port ' + PORT + ' - exiting.');
  } else {
    console.error('Server error:', e.message);
  }
});

function crashAppend(msg) {
  try {
    const f = path.join(__dirname, 'crash.log');
    try {
      const st = fs.statSync(f);
      if (st.size > 2 * 1024 * 1024) {
        const stamp = new Date().toISOString().slice(0, 10);
        try { fs.renameSync(f, path.join(__dirname, 'crash-' + stamp + '.log')); } catch (e) {}
        try {
          const olds = fs.readdirSync(__dirname)
            .filter((n) => /^crash-\d{4}-\d{2}-\d{2}\.log$/.test(n)).sort();
          while (olds.length > 3) {
            try { fs.unlinkSync(path.join(__dirname, olds.shift())); } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {}
    fs.appendFileSync(f, msg);
  } catch (_) {}
}

process.on('uncaughtException', (e) => {
  const msg = new Date().toISOString() + ' UNCAUGHT: ' + (e && e.stack || e) + '\n';
  console.error(msg); crashAppend(msg);
});
process.on('unhandledRejection', (e) => {
  const msg = new Date().toISOString() + ' REJECTION: ' + (e && e.stack || e) + '\n';
  console.error(msg); crashAppend(msg);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Dua Video Studio v0.10 -> http://127.0.0.1:${PORT}`);
});
