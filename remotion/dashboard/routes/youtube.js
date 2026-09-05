'use strict';
/**
 * YouTube routes — extracted from server.js (v0.11 step 4a).
 * Factory: ytRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function ytRoutes(deps) {
  const {PROJECT, REMOTION, PY, fs, path, spawn, getDuaTitle, send} = deps;

  const {readBody} = require('./utils');
  const duaStatusStore = require('./status_store');

  const YT_CANCEL_FLAG = path.join(PROJECT, 'data', '.yt_cancel');
  const SECRET_PATH    = path.join(PROJECT, 'client_secret.json');
  const DATA_SECRET_PATH = path.join(PROJECT, 'data', 'client_secret.json');

  // ── Upload job state ──
  let ytJob = {running: false, logs: [], channel: null, mode: null,
    privacy: null, code: null, startedAt: null, finishedAt: null,
    videos: [], child: null};
  let ytLastUploadReq = 0;
  let ytLastAuthReq = 0;

  // ── Auth job state ──
  let ytauth = {running: false, logs: [], channel: null, code: null,
    startedAt: null, finishedAt: null, child: null};

  // ── Auth status cache (30s TTL) — avoid re-running youtube_auth.py on every poll ──
  const AUTH_CACHE_TTL = 30000;
  const _authCache = {};
  const _authCacheTime = {};

  async function getCachedAuthStatus(ch, tokPath) {
    const now = Date.now();
    if (_authCache[ch] && (now - (_authCacheTime[ch] || 0)) < AUTH_CACHE_TTL) {
      return _authCache[ch];
    }
    const cap = await ytCapture(['scripts/youtube_auth.py', 'status',
      '--token', tokPath]);
    _authCache[ch] = cap;
    _authCacheTime[ch] = now;
    return cap;
  }

  // ── Helpers ──
  function ytFileLog(line) {
    try {
      const p = path.join(PROJECT, 'data', 'upload_log.txt');
      // Rotate if file exceeds 1MB
      if (fs.existsSync(p) && fs.statSync(p).size > 1024 * 1024) {
        const backup = p + '.old';
        try { fs.renameSync(p, backup); } catch (_) {}
      }
      fs.appendFileSync(p,
        new Date().toISOString().replace('T', ' ').slice(0, 19) +
        '  ' + line + '\n');
    } catch (_) {}
  }

  function ytLog(line) {
    const ts = new Date().toLocaleTimeString();
    ytJob.logs.push('[' + ts + '] ' + line);
    if (ytJob.logs.length > 400) ytJob.logs.splice(0, ytJob.logs.length - 400);
    console.log('[YT] ' + line);
    ytFileLog('[YT] ' + line);
  }

  function ytTokenPath(ch) {
    return path.join(PROJECT, 'data', 'yt_token_' + ch + '.json');
  }
  function ytLedgerPath(ch) {
    return path.join(PROJECT, 'data', 'upload_state_' + ch + '.json');
  }
  function ytQuotaPath(ch) {
    return path.join(PROJECT, 'data', 'quota_state_' + ch + '.json');
  }

  function ytClientSecretExists() {
    try {
      return fs.readdirSync(PROJECT)
        .some((f) => /^client_secret.*\.json$/i.test(f));
    } catch (_) { return false; }
  }

  function ytReadLedger(ch) {
    try {
      const txt = fs.readFileSync(ytLedgerPath(ch), 'utf8')
        .replace(/^\uFEFF/, '');
      const raw = JSON.parse(txt);
      return Object.entries(raw)
        .filter(([, v]) => v && v.status === 'uploaded')
        .map(([duaId, v]) => ({
          duaId, videoId: v.video_id || null,
          privacy: v.privacy || null,
          uploadedAt: v.uploaded_at || null,
          url: v.video_id ? 'https://youtu.be/' + v.video_id : null,
          title: getDuaTitle(duaId),
        }))
        .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
        .slice(0, 8);
    } catch (_) { return []; }
  }

  function ytAllUploadedIds() {
    const ids = [];
    for (const ch of ['channel1', 'channel2']) {
      try {
        const txt = fs.readFileSync(ytLedgerPath(ch), 'utf8')
          .replace(/^\uFEFF/, '');
        const raw = JSON.parse(txt);
        Object.entries(raw).forEach(([duaId, v]) => {
          if (v && v.status === 'uploaded' && ids.indexOf(duaId) < 0) {
            ids.push(duaId);
          }
        });
      } catch (_) {}
    }
    return ids;
  }

  function ytCapture(args) {
    return new Promise((resolve) => {
      const p = spawn(PY, args, {cwd: REMOTION, windowsHide: true});
      let out = '';
      p.stdout.on('data', (d) => out += d.toString());
      p.stderr.on('data', () => {});
      p.on('close', (code) => resolve({code, out}));
      p.on('error', (e) => resolve({code: -1, out: String(e.message)}));
    });
  }

  const DAILY_UPLOAD_CAP = 10;  // max uploads per channel per day
  const DAILY_QUOTA_CAP = 9000; // stay under 10K YouTube quota limit

  function ytStartUploadJob(opts) {
    if (ytJob.running) return {ok: false, error: 'Upload pehle se chal raha hai'};
    if (!opts.only || !opts.only.length) {
      return {ok: false,
        error: 'selectedDuas required - pehle 1-6 duas choose karo'};
    }
    const ch = opts.channel;

    // Quota gate: check daily cap
    let quotaUnits = 0;
    let dailyUploads = 0;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const q = JSON.parse(fs.readFileSync(ytQuotaPath(ch), 'utf8')
        .replace(/^\uFEFF/, ''));
      quotaUnits = parseInt(q[today], 10) || 0;
    } catch (_) {}
    try {
      const ledger = ytReadLedger(ch);
      dailyUploads = ledger.filter((e) =>
        String(e.uploadedAt || '').startsWith(today)).length;
    } catch (_) {}
    if (dailyUploads + opts.only.length > DAILY_UPLOAD_CAP) {
      return {ok: false, error:
        `Daily upload cap reached (${dailyUploads}/${DAILY_UPLOAD_CAP}). ` +
        `Tried to add ${opts.only.length} more. Try tomorrow.`};
    }
    if (quotaUnits >= DAILY_QUOTA_CAP) {
      return {ok: false, error:
        `YouTube quota cap reached (${quotaUnits}/${DAILY_QUOTA_CAP} units). ` +
        `Try tomorrow.`};
    }
    const args = [path.join('scripts', 'upload.py')];
    if (opts.mode === 'live') args.push('--live');
    args.push('--only', opts.only.join(','));
    args.push('--privacy', opts.privacy,
      '--token', path.relative(REMOTION, ytTokenPath(ch)),
      '--ledger', path.relative(REMOTION, ytLedgerPath(ch)));
    ytJob = {running: true, logs: [], channel: ch, mode: opts.mode,
      privacy: opts.privacy, code: null, startedAt: Date.now(),
      finishedAt: null, videos: [], child: null,
      total: opts.only.length, done: 0};
    ytLog('START channel=' + ch + ' mode=' + opts.mode +
      ' privacy=' + opts.privacy +
      ' manual=[' + opts.only.length + ' dua]');
    const p = spawn(PY, args, {cwd: REMOTION, windowsHide: true});
    ytJob.child = p;
    ytJob.timedOut = false;
    try { fs.unlinkSync(YT_CANCEL_FLAG); } catch (e) {}
    ytJob.watchdog = setTimeout(() => {
      ytJob.timedOut = true;
      ytLog('WATCHDOG: 10min timeout - process hang, killing');
      try { p.kill('SIGKILL'); } catch (e) {}
    }, 10 * 60 * 1000);
    let buf = '';
    const pump = (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach((l) => {
        const t = l.trim();
        if (!t) return;
        ytLog(t);
        const m = /https:\/\/youtu\.be\/([\w-]+)/.exec(t);
        if (m && !ytJob.videos.some((v) => v.videoId === m[1])) {
          ytJob.videos.push({videoId: m[1], url: m[0], duaId: null});
          ytJob.done = ytJob.videos.length;
          ytLog('PROGRESS ' + ytJob.done + '/' + ytJob.total);
        }
      });
    };
    p.stdout.on('data', pump);
    p.stderr.on('data', pump);
    p.on('close', (code) => {
      if (ytJob.watchdog) { clearTimeout(ytJob.watchdog); ytJob.watchdog = null; }
      ytJob.running = false;
      ytJob.code = code;
      ytJob.finishedAt = Date.now();
      ytJob.child = null;
      try { fs.unlinkSync(YT_CANCEL_FLAG); } catch (e) {}
      const led = ytReadLedger(ch);
      ytJob.videos.forEach((v) => {
        const hit = led.find((e) => e.videoId === v.videoId);
        if (hit) { v.duaId = hit.duaId; v.title = hit.title; }
      });
      // Mark uploaded in persistent status store (per-channel)
      // (survives local file deletion)
      try {
        duaStatusStore.setUploadedBatch(
          ytJob.videos.filter((v) => v.duaId && v.videoId),
          ytJob.channel || 'channel1'
        );
      } catch (_) {}
      ytLog(code === 0 ? 'DONE (exit 0)' : 'FINISHED exit=' + code);
    });
    p.on('error', (e) => {
      if (ytJob.watchdog) { clearTimeout(ytJob.watchdog); ytJob.watchdog = null; }
      ytJob.running = false;
      ytLog('SPAWN ERROR: ' + e.message);
    });
    return {ok: true};
  }

  // ── Auth helpers ──
  function ytMaskId(id) {
    const s = String(id || '');
    if (!s) return '';
    return s.length > 32 ? 'xxxx...' + s.slice(-28) : 'xxxx...(set)';
  }

  function ytReadSettings() {
    const sources = {data: fs.existsSync(DATA_SECRET_PATH),
      root: fs.existsSync(SECRET_PATH)};
    const present = sources.data || sources.root;
    let maskedClientId = '';
    let clientSecretMasked = '';
    let srcPath = null;
    for (const p of [DATA_SECRET_PATH, SECRET_PATH]) {
      if (!fs.existsSync(p)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const blk = raw.installed || raw.web || {};
        maskedClientId = ytMaskId(blk.client_id);
        clientSecretMasked = blk.client_secret ? '(saved)' : '';
        srcPath = p;
        break;
      } catch (_) {}
    }
    return {present, maskedClientId, clientSecretMasked, path: srcPath,
      sources};
  }

  function ytAuthLog(line) {
    const ts = new Date().toLocaleTimeString();
    ytauth.logs.push('[' + ts + '] ' + line);
    if (ytauth.logs.length > 300) {
      ytauth.logs.splice(0, ytauth.logs.length - 300);
    }
    console.log('[YT-AUTH] ' + line);
  }

  function ytSecretProjectName() {
    try {
      const raw = JSON.parse(fs.readFileSync(SECRET_PATH, 'utf8'));
      const blk = raw.installed || raw.web || {};
      return blk.project_id || 'google-cloud-project';
    } catch (_) { return null; }
  }

  function ytSaveSecret(contentStr) {
    let parsed;
    try { parsed = JSON.parse(contentStr); } catch (_) {
      return {ok: false, error: 'File valid JSON nahi hai'};
    }
    if (!parsed || typeof parsed !== 'object' ||
        (!parsed.installed && !parsed.web)) {
      return {ok: false,
        error: 'Ye client_secret file nahi lagti (installed/web key missing)'};
    }
    const tmp = SECRET_PATH + '.tmp.json';
    fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2), 'utf8');
    fs.renameSync(tmp, SECRET_PATH);
    return {ok: true};
  }

  function ytStartAuthJob(ch) {
    if (ytauth.running) {
      return {ok: false, error: 'Auth pehle se chal raha hai (' +
        ytauth.channel + ')'};
    }
    if (!ytClientSecretExists()) {
      return {ok: false, error: 'Pehle client_secret.json save karo'};
    }
    const args = [path.join('scripts', 'youtube_auth.py'), 'login',
      '--token', path.relative(REMOTION, ytTokenPath(ch))];
    ytauth = {running: true, logs: [], channel: ch, code: null,
      startedAt: Date.now(), finishedAt: null, child: null};
    ytAuthLog('LOGIN START channel=' + ch +
      ' - Google consent window browser me khul rahi hai...');
    const p = spawn(PY, args, {cwd: REMOTION, windowsHide: true});
    ytauth.child = p;
    let buf = '';
    const pump = (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach((l) => l.trim() && ytAuthLog(l.trim()));
    };
    p.stdout.on('data', pump);
    p.stderr.on('data', pump);
    p.on('close', (code) => {
      ytauth.running = false;
      ytauth.code = code;
      ytauth.finishedAt = Date.now();
      ytauth.child = null;
      ytAuthLog(code === 0 ? 'AUTH DONE - token saved'
        : 'AUTH FAILED exit=' + code);
    });
    p.on('error', (e) => {
      ytauth.running = false;
      ytAuthLog('SPAWN ERROR: ' + e.message);
    });
    return {ok: true};
  }


  // ══════════════════════════════════════════════════════════════
  //  ROUTE HANDLER — returns true if request was handled
  // ══════════════════════════════════════════════════════════════
  const handleYouTube = function handleYouTube(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── GET /api/youtube/status ──
    if (method === 'GET' && p === '/api/youtube/status') {
      (async () => {
        const secretOk = ytClientSecretExists();
        const channels = {};
        for (const ch of ['channel1', 'channel2']) {
          const tokPath = ytTokenPath(ch);
          let tokenExists = false;
          let hasRefresh = false;
          try {
            const raw = JSON.parse(fs.readFileSync(tokPath, 'utf8'));
            tokenExists = true;
            hasRefresh = !!raw.refresh_token;
          } catch (_) {}
          const cap = await getCachedAuthStatus(ch, tokPath);
          const ledger = ytReadLedger(ch);
          let quotaUnits = 0;
          try {
            const today = new Date().toISOString().slice(0, 10);
            const q = JSON.parse(fs.readFileSync(ytQuotaPath(ch), 'utf8')
              .replace(/^\uFEFF/, ''));
            quotaUnits = parseInt(q[today], 10) || 0;
          } catch (_) {}
          const quploads = Math.floor(quotaUnits / 1600);
          const today2 = new Date().toISOString().slice(0, 10);
          channels[ch] = {
            tokenExists, hasRefresh,
            auth: tokenExists ? (cap.code === 0 ? 'ok' : 'unverified')
              : 'missing',
            authNote: (cap.out || '').trim().split(/\r?\n/)[0] || '',
            uploadsToday: Math.max(
              ledger.filter((e) =>
                String(e.uploadedAt || '').startsWith(today2)).length,
              quploads),
            quotaUnitsToday: quotaUnits,
            quotaUploadsToday: quploads,
            recent: ledger,
          };
        }
        send(res, 200, JSON.stringify({
          ok: true,
          uploadedIds: ytAllUploadedIds(),
          clientSecret: secretOk,
          secretInfo: ytSecretProjectName(),
          creds: ytReadSettings(),
          channels,
          auth: {running: ytauth.running, channel: ytauth.channel,
            code: ytauth.code, startedAt: ytauth.startedAt,
            finishedAt: ytauth.finishedAt,
            logTail: ytauth.logs.slice(-40)},
          job: {running: ytJob.running, channel: ytJob.channel,
            mode: ytJob.mode, privacy: ytJob.privacy, code: ytJob.code,
            startedAt: ytJob.startedAt, finishedAt: ytJob.finishedAt,
            videos: ytJob.videos,
            total: ytJob.total || 0, done: ytJob.done || 0,
            logTail: ytJob.logs.slice(-40)},
        }));
      })();
      return true;
    }

    // ── POST /api/youtube/settings ──
    if (method === 'POST' && p === '/api/youtube/settings') {
      readBody(req, res).then((body) => {
        try {
          const f = JSON.parse(body || '{}');
          const clientId = typeof f.clientId === 'string'
            ? f.clientId.trim() : '';
          const clientSecret = typeof f.clientSecret === 'string'
            ? f.clientSecret.trim() : '';
          if (!clientId || !clientSecret) {
            return send(res, 400, JSON.stringify({ok: false,
              error: 'Client ID aur Client Secret dono zaroori hain'}));
          }
          const payload = {installed: {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: ['http://localhost:8080/',
              'http://127.0.0.1:8080/'],
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
          }};
          fs.mkdirSync(path.dirname(DATA_SECRET_PATH), {recursive: true});
          const tmp = DATA_SECRET_PATH + '.tmp.json';
          fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
          fs.renameSync(tmp, DATA_SECRET_PATH);
          console.log('[YT] SETTINGS SAVED (text inputs): ' + ytMaskId(clientId));
          send(res, 200, JSON.stringify({ok: true,
            maskedClientId: ytMaskId(clientId)}));
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    // ── POST /api/youtube/secret ──
    if (method === 'POST' && p === '/api/youtube/secret') {
      readBody(req, res).then((body) => {
        try {
          const f = JSON.parse(body || '{}');
          const r = ytSaveSecret(String(f.content || ''));
          if (!r.ok) return send(res, 400, JSON.stringify(r));
          console.log('[YT] CLIENT SECRET SAVED: ' + SECRET_PATH);
          send(res, 200, JSON.stringify({ok: true,
            project: ytSecretProjectName()}));
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    // ── POST /api/youtube/auth ──
    if (method === 'POST' && p === '/api/youtube/auth') {
      const now = Date.now();
      if (now - (ytLastAuthReq || 0) < 10000) {
        return send(res, 429, JSON.stringify({ok: false,
          error: 'auth cooldown active (10s)'}));
      }
      ytLastAuthReq = now;
      readBody(req, res).then((body) => {
        try {
          const f = JSON.parse(body || '{}');
          const channel = String(f.channel || '');
          if (!/^channel[12]$/.test(channel)) {
            return send(res, 400, JSON.stringify({ok: false,
              error: 'channel channel1 ya channel2 hona chahiye'}));
          }
          const r = ytStartAuthJob(channel);
          if (!r.ok) return send(res, 409, JSON.stringify(r));
          console.log('[YT] AUTH STARTED: ' + channel);
          send(res, 200, JSON.stringify({ok: true, started: true,
            channel}));
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    // ── POST /api/youtube/upload ──
    if (method === 'POST' && p === '/api/youtube/upload') {
      const now = Date.now();
      ytFileLog('>> UPLOAD POST received' +
        (now - (ytLastUploadReq || 0) < 5000
          ? ' (within cooldown)' : ''));
      if (now - (ytLastUploadReq || 0) < 5000) {
        return send(res, 429, JSON.stringify({ok: false,
          error: 'thoda ruk kar koshish karein (5s cooldown)'}));
      }
      ytLastUploadReq = now;
      readBody(req, res).then((body) => {
        ytFileLog('   body: ' + body.slice(0, 300));
        try {
          const f = JSON.parse(body || '{}');
          const channel = String(f.channel || '');
          const privacy = String(f.privacy || 'unlisted');
          const mode = String(f.mode || 'dry-run');
          if (!/^channel[12]$/.test(channel)) {
            ytFileLog('   ERROR: bad channel=' + channel);
            return send(res, 400, JSON.stringify({ok: false,
              error: 'channel channel1 ya channel2 hona chahiye'}));
          }
          if (['private', 'public', 'unlisted'].indexOf(privacy) < 0) {
            ytFileLog('   ERROR: bad privacy=' + privacy);
            return send(res, 400, JSON.stringify({ok: false,
              error: 'privacy invalid'}));
          }
          if (['live', 'dry-run'].indexOf(mode) < 0) {
            ytFileLog('   ERROR: bad mode=' + mode);
            return send(res, 400, JSON.stringify({ok: false,
              error: 'mode live ya dry-run hona chahiye'}));
          }
          let only = null;
          if (Array.isArray(f.selectedDuas)) {
            const seen = {};
            only = [];
            let bad = 0;
            for (const raw of f.selectedDuas) {
              const s = String(raw == null ? '' : raw).trim();
              if (!/^[a-z0-9_]{1,80}$/.test(s)) { bad++; continue; }
              if (!seen[s]) { seen[s] = true; only.push(s); }
              if (only.length >= 6) break;
            }
            if (bad) {
              ytFileLog('   ERROR: ' + bad + ' bad ids');
              return send(res, 400, JSON.stringify({ok: false,
                error: bad + ' selectedDuas invalid id format me hain '
                  + '(sirf a-z 0-9 _ allowed)'}));
            }
          }
          if (!only || !only.length) {
            ytFileLog('   ERROR: no selectedDuas given');
            return send(res, 400, JSON.stringify({ok: false,
              error: 'selectedDuas zaroori hai - 1 se 6 duas choose karo '
                + '(auto picking band hai)'}));
          }
          if (!f.force) {
            // Per-channel duplicate check
            const alreadyUploaded = only.filter(function(id) {
              return duaStatusStore.isUploadedToChannel(id, channel);
            });
            if (alreadyUploaded.length) {
              ytFileLog('   BLOCKED (per-channel): ' + alreadyUploaded.join(','));
              return send(res, 409, JSON.stringify({ok: false,
                error: alreadyUploaded.length + ' dua(s) is channel pe pehle se upload ho chuki hain: '
                  + alreadyUploaded.join(', ')
                  + ' — Ye dua already ' + channel + ' pe hai. Re-upload ke liye pehle RE-UPLOAD button dabao.'}));
            }
            // Also check ledger (belt-and-suspenders for pre-v2 data)
            const ledgerBlocked = only.filter(function(id) {
              return ytAllUploadedIds().indexOf(id) >= 0;
            });
            if (ledgerBlocked.length) {
              ytFileLog('   BLOCKED (ledger): ' + ledgerBlocked.join(','));
              return send(res, 409, JSON.stringify({ok: false,
                error: ledgerBlocked.length + ' video(s) ledger mein hain: '
                  + ledgerBlocked.join(', ')
                  + ' — Re-upload ke liye pehle ledger se hatao.'}));
            }
          }
          ytFileLog('   -> start: ch=' + channel + ' mode=' + mode +
            ' privacy=' + privacy + ' only=' + only.join(','));
          const r = ytStartUploadJob({channel, privacy, mode, only});
          if (!r.ok) return send(res, r.error.indexOf('chal raha') >= 0
            ? 409 : 400, JSON.stringify(r));
          console.log('[YT] UPLOAD STARTED: ' + channel + ' ' + mode +
            ' manual(' + only.length + ')');
          send(res, 200, JSON.stringify({ok: true, started: true,
            channel, mode, privacy,
            selectedCount: only.length, selected: only}));
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    // ── POST /api/yt-cancel ──
    if (method === 'POST' && p === '/api/yt-cancel') {
      if (!ytJob.running) {
        return send(res, 409, JSON.stringify({ok: false,
          error: 'koi upload chal nahi raha'}));
      }
      try {
        fs.writeFileSync(YT_CANCEL_FLAG, String(Date.now()));
        ytLog('CANCEL requested - graceful stop after current video');
        send(res, 200, JSON.stringify({ok: true}));
      } catch (e) {
        send(res, 500, JSON.stringify({ok: false, error: String(e.message || e)}));
      }
      return true;
    }

    // ── GET /api/youtube/uploaded ──
    if (method === 'GET' && p === '/api/youtube/uploaded') {
      const items = [];
      for (const ch of ['channel1', 'channel2']) {
        try {
          const ledger = JSON.parse(fs.readFileSync(ytLedgerPath(ch), 'utf8').replace(/^\uFEFF/, ''));
          for (const [duaId, v] of Object.entries(ledger)) {
            if (v && v.status === 'uploaded') {
              items.push({
                duaId, channel: ch,
                videoId: v.video_id || null,
                privacy: v.privacy || null,
                uploadedAt: v.uploaded_at || null,
                url: v.video_id ? 'https://youtu.be/' + v.video_id : null,
                title: getDuaTitle(duaId),
              });
            }
          }
        } catch (_) {}
      }
      items.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
      send(res, 200, JSON.stringify({ok: true, items}));
      return true;
    }

    // ── POST /api/youtube/sync — sync dua_status.json from ledger files ──
    if (method === 'POST' && p === '/api/youtube/sync') {
      readBody(req, res).then((body) => {
        try {
          const f = JSON.parse(body || '{}');
          const mode = String(f.mode || 'ledger'); // 'ledger' or 'youtube_api'
          if (mode === 'youtube_api') {
            // YouTube API sync — call Python script
            const channel = String(f.channel || 'channel1');
            if (!/^channel[12]$/.test(channel)) {
              return send(res, 400, JSON.stringify({ok: false,
                error: 'channel channel1 ya channel2 hona chahiye'}));
            }
            const args = [path.join('scripts', 'youtube_sync.py'),
              '--channel', channel];
            const cap = ytCapture(args);
            cap.then((result) => {
              try {
                const parsed = JSON.parse(result.out.trim().split(/\r?\n/).pop() || '{}');
                if (parsed.ok && parsed.matches && parsed.matches.length) {
                  const backfilled = duaStatusStore.syncFromYouTubeApi(
                    parsed.matches.map((m) => ({
                      duaId: m.duaId,
                      videoId: m.videoId,
                      channel: channel,
                      uploadedAt: m.publishedAt || null,
                    }))
                  );
                  send(res, 200, JSON.stringify({ok: true, mode: 'youtube_api',
                    channel, found: parsed.matches.length,
                    backfilled: backfilled.backfilled,
                    matches: parsed.matches}));
                } else {
                  send(res, 200, JSON.stringify({ok: true, mode: 'youtube_api',
                    channel, found: 0, backfilled: 0,
                    error: parsed.error || 'No matching videos found'}));
                }
              } catch (e) {
                send(res, 500, JSON.stringify({ok: false,
                  error: 'YouTube API sync failed: ' + String(e.message || e)}));
              }
            });
          } else {
            // Ledger sync — read local upload_state files
            const result = duaStatusStore.syncFromLedgers();
            send(res, 200, JSON.stringify({ok: true, mode: 'ledger',
              backfilled: result.backfilled, channels: result.channels}));
          }
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    // ── GET /api/youtube/stats ──
    if (method === 'GET' && p === '/api/youtube/stats') {
      const urlObj = new URL(url.href, 'http://localhost');
      const idsParam = urlObj.searchParams.get('ids') || '';
      const channelParam = urlObj.searchParams.get('channel') || 'channel1';
      (async () => {
        try {
          const args = [path.join('scripts', 'youtube_stats.py'),
            '--channel', channelParam];
          if (idsParam) args.push('--ids', idsParam);
          const cap = await ytCapture(args);
          const parsed = JSON.parse(cap.out.trim().split(/\r?\n/).pop() || '{}');
          send(res, 200, JSON.stringify(parsed));
        } catch (e) {
          send(res, 500, JSON.stringify({ok: false, error: String(e.message || e)}));
        }
      })();
      return true;
    }

    // ── POST /api/youtube/re-upload ──
    if (method === 'POST' && p === '/api/youtube/re-upload') {
      if (ytJob.running) {
        return send(res, 409, JSON.stringify({ok: false, error: 'Upload chal raha hai - pehle ruko'}));
      }
      readBody(req, res).then((body) => {
        try {
          const f = JSON.parse(body || '{}');
          const duaId = String(f.duaId || '').trim();
          const channel = String(f.channel || '').trim();
          if (!duaId || !/^channel[12]$/.test(channel)) {
            return send(res, 400, JSON.stringify({ok: false, error: 'duaId aur channel zaroori hain'}));
          }
          const ledgerPath = ytLedgerPath(channel);
          try {
            const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^\uFEFF/, ''));
            if (ledger[duaId]) {
              delete ledger[duaId];
              const tmpPath = ledgerPath + '.tmp';
              fs.writeFileSync(tmpPath, JSON.stringify(ledger, null, 2), 'utf8');
              fs.promises.rename(tmpPath, ledgerPath).then(() => {
                ytLog('RE-UPLOAD: ledger entry removed for ' + duaId + ' (' + channel + ')');
                send(res, 200, JSON.stringify({ok: true, duaId, channel}));
              }).catch((e) => {
                try { fs.unlinkSync(tmpPath); } catch (_) {}
                ytLog('RE-UPLOAD: ledger rename fail: ' + e.message);
                send(res, 500, JSON.stringify({ok: false, error: 'Ledger save fail'}));
              });
            } else {
              send(res, 404, JSON.stringify({ok: false, error: 'Ledger mein ye dua nahi mili'}));
            }
          } catch (e) {
            send(res, 404, JSON.stringify({ok: false, error: 'Ledger file nahi mili'}));
          }
        } catch (e) {
          send(res, 400, JSON.stringify({ok: false, error: 'bad request'}));
        }
      });
      return true;
    }

    return false; // not handled
  };
  handleYouTube.shutdown = function ytShutdown() {
    const targets = [];
    if (ytJob.child && ytJob.child.pid) targets.push(ytJob.child.pid);
    if (ytauth.child && ytauth.child.pid) targets.push(ytauth.child.pid);
    if (!targets.length) return;
    for (const pid of targets) {
      ytLog('SHUTDOWN: killing pid ' + pid);
      const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
      k.on('error', () => {});
      k.unref();
    }
  };
  return handleYouTube;
};
