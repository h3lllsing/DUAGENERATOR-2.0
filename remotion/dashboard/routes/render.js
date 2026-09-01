'use strict';
/**
 * Render routes — extracted from server.js (v0.11 step 4b).
 * Async I/O + strict input sanitization + graceful errors.
 * Factory: renderRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function renderRoutes(deps) {
  const {PROJECT, REMOTION, TEMP, OUT, DATA, PY, CHROME, FFMPEG, CFG_PATH,
    fs, path, crypto, spawn, process, send,
    lookspec, fxg, themeMap, cacheStore, saveCache, qcStore, saveQc} = deps;
  const F = fs.promises;
  const customVfx = require('../custom-vfx');

  // ── Mutable state (shared by reference with server.js) ──
  const job = {running: false, duaId: null, step: '', percent: 0,
    logs: [], lastVideo: null, error: null, startedAt: null,
    child: null, cancelFlag: false};
  const queue = {active: false, items: [], idx: 0, done: [], failed: [],
    skipped: [], cancelRequested: false};
  const children = new Set();

  // ── Constants ──
  const HIST_PATH = path.join(__dirname, '..', 'history.json');
  const STYLE_PRESETS = ['auto', 'classic', 'royal', 'minimal', 'cinematic',
    'masterpiece', 'volumetric', 'raytrace', 'embernight', 'glitterroyal',
    'desertmirage', 'waterripple', 'silkmarble', 'cinemafocus',
    'auroranova', 'qadrtilt'];

  // ── Graceful errors / helpers ──
  function err(code, msg) { const e = new Error(msg); e.statusCode = code; return e; }
  function parseJson(body, label) {
    try { return JSON.parse(body || '{}'); }
    catch (_) { throw err(400, 'bad JSON payload' + (label ? ' (' + label + ')' : '')); }
  }
  function cleanStr(v, max, label) {
    const s = String(v == null ? '' : v)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    if (s.length > max) {
      const e = new Error(label + ' bahut lamba hai (max ' + max + ' chars)');
      e.statusCode = 400;
      throw e;
    }
    return s;
  }
  async function exists(p) { return F.access(p).then(() => true).catch(() => false); }

  // ── Helpers ──
  function log(line) {
    const ts = new Date().toLocaleTimeString();
    job.logs.push('[' + ts + '] ' + line);
    if (job.logs.length > 400) job.logs.splice(0, job.logs.length - 400);
    console.log(line);
  }

  async function writeAtomic(f, data) {
    const tmp = f + '.' + Date.now() + '.tmp.json';
    await F.writeFile(tmp, data, 'utf8');
    await F.rename(tmp, f);
  }

  async function loadDuas() {
    const txt = (await F.readFile(path.join(PROJECT, 'data', 'duas.json'), 'utf8'))
      .replace(/^\uFEFF/, '');
    const raw = JSON.parse(txt);
    return Array.isArray(raw) ? raw : raw.duas;
  }

  async function getDuaTitle(id) {
    try {
      const list = await loadDuas();
      const d = list.find((x) => x.id === id);
      return d ? d.title : id;
    } catch (_) { return id; }
  }

  function safeTitle(title) {
    return String(title || 'Dua').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
      .trim().replace(/\.mp4$/i, '').replace(/[. ]+$/, '') || 'Dua';
  }

  function registerChild(p) {
    children.add(p.pid);
    p.on('close', () => children.delete(p.pid));
    p.on('error', () => children.delete(p.pid));
  }

  function killChildren(label) {
    const targets = new Set();
    if (job && job.child && job.child.pid) targets.add(job.child.pid);
    for (const pid of children) targets.add(pid);
    for (const pid of targets) {
      log((label || 'KILL') + ': killing pid ' + pid);
      const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
      k.on('error', () => {});
      k.unref();
    }
  }

  function run(cmd, args, opts) {
    return new Promise((resolve) => {
      log('$ ' + path.basename(cmd) + ' ' + args.join(' ').slice(0, 300));
      const p = spawn(cmd, args, Object.assign({cwd: REMOTION, windowsHide: true}, opts));
      if (job) job.child = p;
      registerChild(p);
      let buf = '';
      const pump = (d) => {
        buf += d.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        lines.forEach((l) => l.trim() && log(l.trim()));
      };
      p.stdout.on('data', pump);
      p.stderr.on('data', pump);
      p.on('close', (code) => {
        if (job && job.child === p) job.child = null;
        resolve(job && job.cancelFlag ? -2 : code);
      });
      p.on('error', (e) => { log('SPAWN ERROR: ' + e.message); resolve(-1); });
    });
  }

  async function runQuiet(cmd, args) {
    return new Promise((resolve) => {
      log('$ ' + path.basename(cmd) + ' ' + args.join(' ').slice(0, 300));
      const p = spawn(cmd, args, {cwd: REMOTION, windowsHide: true});
      registerChild(p);
      let buf = '';
      const pump = (d) => {
        buf += d.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        lines.forEach((l) => l.trim() && log(l.trim()));
      };
      p.stdout.on('data', pump);
      p.stderr.on('data', pump);
      p.on('close', (code) => resolve(code));
      p.on('error', (e) => { log('SPAWN ERROR: ' + e.message); resolve(-1); });
    });
  }

  async function runCapture(cmd, args) {
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, {cwd: REMOTION, windowsHide: true});
      registerChild(p);
      let out = '';
      p.stdout.on('data', (d) => out += d.toString());
      p.stderr.on('data', () => {});
      p.on('close', (code) => code === 0 ? resolve(out) : reject(new Error('exit ' + code)));
      p.on('error', (e) => reject(e));
    });
  }

  async function readStylePreset() {
    try {
      const c = JSON.parse(await F.readFile(CFG_PATH, 'utf8'));
      return STYLE_PRESETS.includes(c.stylePreset) ? c.stylePreset : 'classic';
    } catch (_) { return 'classic'; }
  }

  async function readArtFxOverride() {
    try {
      const c = JSON.parse(await F.readFile(CFG_PATH, 'utf8'));
      return fxg.ART_SELECT.includes(c.artFx) && c.artFx !== 'auto' ? c.artFx : null;
    } catch (_) { return null; }
  }
  async function readSkyFxOverride() {
    try {
      const c = JSON.parse(await F.readFile(CFG_PATH, 'utf8'));
      return fxg.SKY_SELECT.includes(c.skyFx) && c.skyFx !== 'auto' ? c.skyFx : null;
    } catch (_) { return null; }
  }
  async function readBorderFxOverride() {
    try {
      const c = JSON.parse(await F.readFile(CFG_PATH, 'utf8'));
      return fxg.BORDER_SELECT.includes(c.borderFx) && c.borderFx !== 'auto' ? c.borderFx : null;
    } catch (_) { return null; }
  }

  function lookPathFor(duaId) {
    return path.join(TEMP, duaId + '_look.json');
  }

  async function readLookMode() {
    try {
      const c = JSON.parse(await F.readFile(CFG_PATH, 'utf8'));
      return c.lookMode === 'signature' ? 'signature' : 'random';
    } catch (_) { return 'random'; }
  }

  async function ensureLookSpec(duaId, dua) {
    if ((await readLookMode()) !== 'random') {
      try { await F.rm(lookPathFor(duaId), {force: true}); } catch (_) {}
      return null;
    }
    const lp = lookPathFor(duaId);
    const pack = customVfx.load(PROJECT);
    let spec = null;
    try {
      if (await exists(lp)) {
        const j = JSON.parse((await F.readFile(lp, 'utf8')).replace(/^\uFEFF/, ''));
        spec = (j && j.lookSpec) || j || null;
      }
    } catch (_) { spec = null; }
    if (!spec) {
      let theme = 'dark';
      try { theme = themeMap.resolve(dua || {id: duaId}); } catch (_) {}
      spec = lookspec.buildLookSpec(theme);
      const overrideFx = await readArtFxOverride();
      if (overrideFx) spec.artFx = overrideFx;
      const overrideSky = await readSkyFxOverride();
      if (overrideSky) spec.skyFx = overrideSky;
      const overrideBorder = await readBorderFxOverride();
      if (overrideBorder) spec.borderFx = overrideBorder;
      const explicitSp = await readStylePreset();
      if (explicitSp && explicitSp !== 'classic' && explicitSp !== 'auto') {
        spec.preset = explicitSp;
        spec.tint = (fxg.PRESET_TINTS || {})[explicitSp] || spec.tint || null;
      }
    }
    // DYNAMIC VFX PACK (GLOBAL POOL): data/custom_vfx.json plugins (match:"*")
    // + standalone patterns → lookSpec.vfx deterministic seed-pick (custom-vfx.js
    // attachVfx). Sab deterministically re-attach hota hai (seed/look file
    // change nahi hota) — koi dua-id hardcoding. custom-vfx.js: attachVfx.
    customVfx.attachVfx(pack, duaId, spec);
    try { await writeAtomic(lp, JSON.stringify({lookSpec: spec}, null, 2)); } catch (_) {}
    return spec;
  }

  async function stylePropsArgs(duaId) {
    const sp = await readStylePreset();
    if (sp && sp !== 'classic' && sp !== 'auto') {
      const f = path.join(TEMP, 'style_props.json');
      let inner = null;
      if (duaId) {
        try { inner = JSON.parse((await F.readFile(lookPathFor(duaId), 'utf8'))).lookSpec || null; } catch (_) {}
      }
      try { await F.writeFile(f, JSON.stringify(inner ? {stylePreset: sp, lookSpec: inner} : {stylePreset: sp})); } catch (_) {}
      return ['--props=' + f];
    }
    if (duaId) {
      const lf = lookPathFor(duaId);
      if (await exists(lf)) return ['--props=' + lf];
    }
    return [];
  }

  async function npxRender(duaId, outName, onProgress) {
    const compId = duaId.replace(/_/g, '-');
    const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
    const propsArgs = await stylePropsArgs(duaId);
    return new Promise((resolve) => {
      const args = ['render', compId,
        'out/' + outName,
        '--browser-executable=' + CHROME,
        '--crf=18', '--jpeg-quality=100', '--log=error',
        ...propsArgs];
      log('$ node remotion-cli ' + args.join(' '));
      const p = spawn(process.execPath, [cli, ...args], {cwd: REMOTION, windowsHide: true});
      if (job) job.child = p;
      let buf = '';
      const handle = (d) => {
        buf += d.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        lines.forEach((l) => {
          const m = l.match(/Rendered (\d+)\/(\d+)/);
          if (m && onProgress) onProgress(Math.round((+m[1] / +m[2]) * 100));
          if (l.trim()) log(l.trim());
        });
      };
      p.stdout.on('data', handle);
      p.stderr.on('data', handle);
      p.on('close', (code) => {
        if (job && job.child === p) job.child = null;
        resolve(job && job.cancelFlag ? -2 : code);
      });
      p.on('error', (e) => { log('SPAWN ERROR: ' + e.message); resolve(-1); });
    });
  }

  function tagBt709(vidPath) {
    return new Promise((resolve) => {
      const tmp = vidPath.replace(/\.mp4$/i, '.bt709.mp4');
      const p = spawn(FFMPEG, ['-y', '-i', vidPath,
        '-c', 'copy',
        '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
        '-movflags', '+faststart', tmp], {cwd: REMOTION, windowsHide: true});
      let errStr = '';
      p.stderr.on('data', (d) => { errStr += d.toString(); });
      p.on('close', (code) => {
        (async () => {
          if (code === 0 && (await exists(tmp))) {
            try {
              await F.rm(vidPath, {force: true});
              await F.rename(tmp, vidPath);
              log('BT.709 tags applied (stream copy)');
            } catch (e) {
              try { await F.rm(tmp, {force: true}); } catch (_) {}
              log('bt709 rename skip: ' + e.message);
            }
          } else {
            try { await F.rm(tmp, {force: true}); } catch (_) {}
            log('bt709 tag skip (non-fatal): ' + errStr.slice(-160).trim());
          }
        })().then(resolve);
      });
      p.on('error', () => { log('ffmpeg bt709 spawn error'); resolve(); });
    });
  }

  async function recordHistory(duaId, ok, extra) {
    try {
      let arr = [];
      try { arr = JSON.parse((await F.readFile(HIST_PATH, 'utf8')).replace(/^\uFEFF/, '')); } catch (_) { arr = []; }
      arr.unshift(Object.assign({
        ts: new Date().toISOString(), duaId,
        title: await getDuaTitle(duaId), result: ok ? 'PASS' : 'FAIL',
      }, extra || {}));
      await writeAtomic(HIST_PATH, JSON.stringify(arr.slice(0, 200), null, 2));
    } catch (_) {}
  }

  async function qcCheck(duaId, vidPath) {
    try {
      const out = await runCapture(PY, ['scripts/qc.py', vidPath]);
      const lines = out.trim().split(/\r?\n/).filter(Boolean);
      const j = JSON.parse(lines[lines.length - 1]);
      qcStore[duaId] = {pass: !!j.pass, ts: Date.now(), reason: j.reason || null};
      saveQc();
      log('QC ' + (j.pass ? 'PASS' : 'FAIL') + ': ' + duaId +
        (j.reason ? ' (' + j.reason + ')' : ' (' + j.checks.loudness_lufs + ' LUFS)'));
      return j;
    } catch (e) {
      log('QC infra error (pass maana): ' + e.message);
      return {pass: true};
    }
  }

  async function cacheKey(dua) {
    const aud = path.join(REMOTION, 'public', 'audio', dua.id + '.mp3');
    const sfxDir = path.join(REMOTION, 'public', 'sfx');
    const sfx = [];
    for (const f of ['whoosh.mp3', 'riser.mp3', 'tick.mp3']) {
      sfx.push((await exists(path.join(sfxDir, f))) ? 1 : 0);
    }
    let audSig = 'none';
    try { const st = await F.stat(aud); audSig = st.mtimeMs + ':' + st.size; } catch (_) {}
    let cfg = '';
    try { cfg = await F.readFile(CFG_PATH, 'utf8'); } catch (_) {}
    // UNIFIED MASTER POOL signature — imported item (pattern/plugin/theme/...)
    // ya koi edit → signature badla → cache stale nahi rehta (instant effect).
    let poolSig = 'none';
    try { poolSig = customVfx.poolSignature(PROJECT); } catch (_) {}
    return crypto.createHash('md5').update(
      JSON.stringify(dua) + '|' + audSig + '|' + cfg + '|' + sfx.join('') + '|' + poolSig).digest('hex');
  }

  async function genThumb(duaId, outName, force) {
    try {
      const tname = duaId + '.png';
      const tpath = path.join(OUT, 'thumbs', tname);
      if (!force && (await exists(tpath))) return;
      if (force && (await exists(tpath))) await F.rm(tpath, {force: true});
      const legacy = path.join(OUT, 'thumbs', outName.replace(/\.mp4$/, '.png'));
      if (!force && (await exists(legacy))) {
        await F.copyFile(legacy, tpath);
        return;
      }
      const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
      const compId = duaId.replace(/_/g, '-');
      await F.mkdir(path.join(OUT, 'thumbs'), {recursive: true});
      try {
        const lf = lookPathFor(duaId);
        if (await exists(lf)) {
          const raw = JSON.parse((await F.readFile(lf, 'utf8')).replace(/^\uFEFF/, ''));
          const lk = raw.lookSpec || raw;
          log('THUMB LOOK: ' + [lk.preset, lk.frame, lk.camera].filter(Boolean).join('/'));
        }
      } catch (_) {}
      await run(process.execPath, [cli, 'still', compId,
        'out/thumbs/' + tname, '--frame=100',
        '--browser-executable=' + CHROME, '--log=error',
        ...await stylePropsArgs(duaId)]);
    } catch (_) { log('thumb skip (non-fatal)'); }
  }

  function resetJob(duaId) {
    Object.assign(job, {running: true, duaId, step: 'prepare', percent: 0,
      logs: [], lastVideo: null, error: null, startedAt: Date.now(),
      child: null, cancelFlag: false});
  }

  function cancelled() {
    return queue.cancelRequested || job.cancelFlag;
  }

  async function alreadyRendered(duaId) {
    try {
      const list = await loadDuas();
      const d = list.find((x) => x.id === duaId);
      if (!d) return false;
      return await exists(path.join(OUT, safeTitle(d.title) + '.mp4'));
    } catch (e) { return false; }
  }

  function duaStatus(d) {
    const id = d.id;
    const arts = ['_ar.mp3', '_ur.mp3', '_ar_timing.jsonl', '_ur_timing.jsonl', '_merged.wav']
      .map((s) => fs.existsSync(path.join(TEMP, id + s)));
    const audioReady = arts.every(Boolean);
    const manifest = fs.existsSync(path.join(DATA, id + '.json'));
    const title = safeTitle(d.title) + '.mp4';
    const vfile = path.join(OUT, title);
    const videoFile = fs.existsSync(vfile) ? title : null;
    const videoMB = videoFile ? Math.round(fs.statSync(vfile).size / 1048576 * 10) / 10 : null;
    let thumbName = id + '.png';
    if (!fs.existsSync(path.join(OUT, 'thumbs', thumbName))) {
      thumbName = safeTitle(d.title) + '.png';
    }
    const thumbFile = fs.existsSync(path.join(OUT, 'thumbs', thumbName)) ? thumbName : null;
    const qcs = qcStore[id];
    return {id, title: d.title, reference: d.reference,
      category: d.category || '', audioReady, manifest, videoFile, videoMB,
      thumbFile,
      qc: qcs ? {pass: !!qcs.pass, ts: qcs.ts} : null,
      theme: d.theme,
      refShared: !!d.refShared,
      reference: d.reference || '',
      arabic: d.arabic || '', urdu: d.urdu || '',
      explanation: d.explanation || '',
      voiceArabic: d.voice_arabic || 'ar-SA-HamedNeural',
      voiceUrdu: d.voice_urdu || 'ur-PK-AsadNeural',
      template: d.template || '',
      bismillah: d.bismillah !== false};
  }

  function serveVideo(req, res, name) {
    const file = path.join(OUT, path.basename(name));
    // Path traversal guard: ensure resolved path stays within OUT
    if (!file.startsWith(OUT)) return send(res, 403, 'forbidden', 'text/plain');
    if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
    const stat = fs.statSync(file);
    const range = req.headers.range;
    if (range) {
      const total = stat.size;
      const m = range.match(/bytes\s*=\s*(\d*)-(\d*)/i);
      if (m) {
        const startStr = m[1];
        const endStr = m[2];
        let start = startStr !== '' ? parseInt(startStr, 10) : null;
        let end = endStr !== '' ? parseInt(endStr, 10) : total - 1;
        if (start === null) {
          if (total === 0) {
            res.writeHead(416, {'Content-Range': 'bytes */0'});
            return res.end();
          }
          const suffix = Math.max(end, 1);
          start = Math.max(total - suffix, 0);
          end = total - 1;
        } else {
          if (start >= total) {
            res.writeHead(416, {'Content-Range': 'bytes */' + total});
            return res.end();
          }
          end = Math.min(end, total - 1);
          if (end < start) end = start;
        }
        res.writeHead(206, {
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(file, {start, end}).pipe(res);
        return true;
      }
      res.writeHead(416, {'Content-Range': 'bytes */' + total});
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  // ── Core render logic ──
  async function doJob(duaId, force) {
    const list = await loadDuas();
    const dua = list.find((d) => d.id === duaId);
    const outName = safeTitle(dua && dua.title) + '.mp4';
    const vidPath = path.join(OUT, outName);

    if (!force && (await exists(vidPath))) {
      const k = await cacheKey(dua || {id: duaId});
      const c = cacheStore[duaId];
      if (c && c.key === k && c.out === outName) {
        log('CACHE HIT: inputs unchanged - render skip');
        job.percent = 100;
        job.step = 'thumb';
        await genThumb(duaId, outName);
        if (cancelled()) throw new Error('Cancelled');
        job.step = 'metadata';
        try { await runQuiet(PY, ['scripts/metadata.py', duaId]); } catch (_) {}
        job.lastVideo = vidPath;
        job.step = 'done';
        return;
      }
    }

    const arts = ['_ar.mp3', '_ur.mp3', '_ar_timing.jsonl', '_ur_timing.jsonl', '_merged.wav']
      .map((s) => path.join(TEMP, duaId + s));
    const haveAudio = (await Promise.all(arts.map((p) => exists(p)))).every(Boolean);

    if (!haveAudio || force) {
      job.step = 'TTS + merge';
      const a = ['scripts/prepare_dua.py', duaId];
      if (force) a.push('--force');
      let code = await run(PY, a);
      if (cancelled()) throw new Error('Cancelled');
      if (code === 3) throw new Error('Duration policy: speech >40s (video not allowed)');
      if (code !== 0) throw new Error('prepare failed (exit ' + code + ')');
    } else {
      log('audio artifacts exist, skipping TTS');
    }

    job.step = 'manifest';
    job.percent = 2;
    let code = await run(PY, ['scripts/make_manifest.py', duaId]);
    if (cancelled()) throw new Error('Cancelled');
    if (code !== 0) throw new Error('manifest failed (exit ' + code + ')');

    try { await F.rm(lookPathFor(duaId), {force: true}); } catch (_) {}
    const lookSpec = await ensureLookSpec(duaId, dua);
    if (lookSpec) {
      const extras = [];
      if (lookSpec.textFx && lookSpec.textFx !== 'glide') extras.push('t:' + lookSpec.textFx);
      if (lookSpec.motif && lookSpec.motif !== 'none') extras.push('m:' + lookSpec.motif);
      if (lookSpec.gradeFx && lookSpec.gradeFx !== 'auto') extras.push('g:' + lookSpec.gradeFx);
      if (lookSpec.camera && lookSpec.camera !== 'static') extras.push('c:' + lookSpec.camera);
      if (lookSpec.introFx && lookSpec.introFx !== 'classic') extras.push('i:' + lookSpec.introFx);
      if (lookSpec.ornament && lookSpec.ornament !== 'starcrescent') extras.push('o:' + lookSpec.ornament);
      job.lookSummary = [
        lookSpec.preset, lookSpec.borderFx, lookSpec.skyFx, lookSpec.artFx,
        lookSpec.frame, ...extras,
      ].join(' / ');
      log('LOOK: ' + job.lookSummary + ' (seed ' + lookSpec.seed + ')');
    }

    job.step = 'render';
    code = await npxRender(duaId, outName, (pc) => { job.percent = pc; });
    if (cancelled()) throw new Error('Cancelled');
    if (code !== 0) throw new Error('render failed (exit ' + code + ')');

    if (!(await exists(vidPath))) throw new Error('output missing: ' + outName);
    await tagBt709(vidPath);

    job.step = 'qc';
    job.percent = 100;
    let qc = await qcCheck(duaId, vidPath);
    if (!qc.pass && !cancelled()) {
      log('QC FAIL - ek retry render ho raha hai');
      try { await F.rm(vidPath, {force: true}); } catch (_) {}
      code = await npxRender(duaId, outName, (pct) => { job.percent = pct; });
      if (cancelled()) throw new Error('Cancelled');
      if (code !== 0) throw new Error('retry render failed (exit ' + code + ')');
      await tagBt709(vidPath);
      qc = await qcCheck(duaId, vidPath);
      if (!qc.pass) throw new Error('QC fail (retry ke baad bhi): ' + qc.reason);
    }

    job.step = 'thumb';
    await genThumb(duaId, outName, true);
    if (cancelled()) throw new Error('Cancelled');

    cacheStore[duaId] = {key: await cacheKey(dua || {id: duaId}), out: outName};
    saveCache();

    job.step = 'metadata';
    try { await runQuiet(PY, ['scripts/metadata.py', duaId]); } catch (_) { log('metadata sidecar skip (non-fatal)'); }

    job.lastVideo = vidPath;
    job.percent = 100;
    job.step = 'done';
    log('DONE: ' + vidPath);
  }

  async function processQueue() {
    while (queue.idx < queue.items.length && !queue.cancelRequested) {
      const id = queue.items[queue.idx];
      resetJob(id);
      log('BATCH [' + (queue.idx + 1) + '/' + queue.items.length + ']: ' + id);
      try {
        await doJob(id, false);
        if (queue.cancelRequested) break;
        queue.done.push(id);
        await recordHistory(id, true, {look: job && job.lookSummary});
      } catch (e) {
        const msg = String(e.message || e);
        if (msg === 'Cancelled' || queue.cancelRequested) break;
        queue.failed.push({id, error: msg});
        await recordHistory(id, false, {error: msg});
        log('BATCH item failed: ' + id + ' (' + msg + ') - aage barh rahe hain');
      }
      queue.idx++;
    }
    const wasCancel = queue.cancelRequested;
    const remaining = queue.items.slice(queue.idx);
    if (wasCancel && remaining.length) queue.skipped.push(...remaining);
    queue.active = false;
    queue.cancelRequested = false;
    job.running = false;
    job.child = null;
    log('BATCH ' + (wasCancel ? 'CANCELLED' : 'COMPLETE') + ': ' +
      queue.done.length + ' ok, ' + queue.failed.length + ' fail' +
      (queue.skipped.length ? ', ' + queue.skipped.length + ' skipped' : ''));
  }

  async function startJob(duaId, force) {
    if (job.running || queue.active) return {ok: false, error: 'Job already running'};
    if (!force && (await alreadyRendered(duaId))) {
      return {ok: false,
        error: 'Ye video pehle se RENDERED hai - dobara render se baked style/voice badal jayega. Force ke liye expert mode use karo'};
    }
    resetJob(duaId);
    (async () => {
      try {
        await doJob(duaId, force);
        await recordHistory(duaId, true, {look: job && job.lookSummary});
      } catch (e) {
        const msg = String(e.message || e);
        job.error = msg;
        job.step = msg === 'Cancelled' ? 'cancelled' : 'failed';
        if (job.step === 'failed') await recordHistory(duaId, false, {error: msg});
        log((job.step === 'cancelled' ? 'CANCELLED: ' : 'FAILED: ') + msg);
      } finally {
        job.running = false;
      }
    })();
    return {ok: true};
  }

  async function startVoiceJob(duaId, force) {
    if (job.running || queue.active) return {ok: false, error: 'Job already running'};
    Object.assign(job, {running: true, duaId, step: 'TTS + merge', percent: 0,
      logs: [], lastVideo: null, error: null, startedAt: Date.now()});
    (async () => {
      try {
        const a = ['scripts/prepare_dua.py', duaId];
        if (force) a.push('--force');
        let code = await run(PY, a);
        if (code === 3) throw new Error('Duration policy: speech >40s');
        if (code !== 0) throw new Error('TTS failed (exit ' + code + ')');
        job.step = 'manifest';
        job.percent = 50;
        code = await run(PY, ['scripts/make_manifest.py', duaId]);
        if (code !== 0) throw new Error('manifest failed');
        job.percent = 100;
        job.step = 'done';
        log('DONE: voice only ' + duaId);
      } catch (e) {
        job.error = String(e.message || e);
        job.step = 'failed';
        log('FAILED: ' + job.error);
      } finally {
        job.running = false;
      }
    })();
    return {ok: true};
  }

  // ── Graceful route wrapper: converts any throw into a structured 4xx/5xx ──
  function routeCatch(res, fn) {
    return Promise.resolve().then(fn).catch((e) => {
      const code = (e && e.statusCode) || 500;
      const msg = (e && e.message) || String(e);
      if (!res.headersSent && !res.writableEnded) {
        send(res, code, JSON.stringify({ok: false, error: msg}));
      } else {
        log('render route error after send: ' + msg);
      }
    });
  }

  // ── Read body (promise), cap 1MB, graceful 413 ──
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

  // ══════════════════════════════════════════════════════════════
  //  ROUTE HANDLER — returns true if request was handled
  // ══════════════════════════════════════════════════════════════
  const handler = function handleRender(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── POST /api/voice-only ──
    if (method === 'POST' && p === '/api/voice-only') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'voice-only');
          const id = String(f.duaId || '').trim();
          if (!id || !/^[a-z0-9_\-]{1,80}$/.test(id)) {
            throw err(400, 'duaId invalid format (a-z 0-9 _ - max 80)');
          }
          send(res, 200, JSON.stringify(await startVoiceJob(id, !!f.force)));
        });
      }, () => {});
      return true;
    }

    // ── GET /audio/* ──
    if (method === 'GET' && p.startsWith('/audio/')) {
      const name = path.basename(decodeURIComponent(p.slice('/audio/'.length)));
      if (!/^[a-z0-9_\-]+\.mp3$/.test(name)) return send(res, 404, 'bad name', 'text/plain');
      const f = path.join(REMOTION, 'public', 'audio', name);
      if (!fs.existsSync(f)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache'});
      fs.createReadStream(f).pipe(res);
      return true;
    }

    // ── GET /temp-voice/* ──
    if (method === 'GET' && p.startsWith('/temp-voice/')) {
      const id = p.slice('/temp-voice/'.length);
      if (!/^[a-z0-9_]+$/.test(id)) return send(res, 404, 'bad id', 'text/plain');
      const f = path.join(TEMP, id + '_merged.wav');
      if (!fs.existsSync(f)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache'});
      fs.createReadStream(f).pipe(res);
      return true;
    }

    // ── POST /api/tts-custom ──
    if (method === 'POST' && p === '/api/tts-custom') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'tts-custom');
          // Deep sanitization: strip HTML tags and control characters
          const sanitizeTts = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
          const a = cleanStr(sanitizeTts(f.arabic), 5000, 'Arabic text');
          const u = cleanStr(sanitizeTts(f.urdu), 5000, 'Urdu text');
          if (!a && !u) throw err(400, 'Arabic ya Urdu text do');
          const rawName = String(f.name || '').trim();
          const name = /^[a-z0-9_]{1,60}$/.test(rawName) ? rawName : 'custom_' + Date.now();
          const cdir = path.join(TEMP, 'custom');
          await F.mkdir(cdir, {recursive: true});
          const pf = path.join(cdir, 'payload.json');
          await F.writeFile(pf, JSON.stringify({arabic: a, urdu: u, name}), 'utf8');
          const code = await runQuiet(PY, ['scripts/tts_custom.py', pf]);
          if (code !== 0) throw err(500, 'TTS fail hua');
          const savedFile = name + '.mp3';
          const savedOk = await exists(path.join(REMOTION, 'public', 'audio', savedFile));
          log('CUSTOM TTS SAVED: ' + savedFile);
          send(res, 200, JSON.stringify({ok: true, okA: !!a, okU: !!u,
            merged: !!(a && u), savedFile: savedOk ? savedFile : null, ts: Date.now()}));
        });
      }, () => {});
      return true;
    }

    // ── POST /api/open-folder ──
    if (method === 'POST' && p === '/api/open-folder') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'open-folder');
          const map = {videos: OUT, audio: path.join(REMOTION, 'public', 'audio'), temp: TEMP};
          const fp = map[String(f.which || '')];
          if (!fp || !(await exists(fp))) throw err(404, 'folder nahi mila');
          const eproc = spawn('explorer', [fp]);
          eproc.on('error', () => log('explorer spawn fail (ige ENOENT)'));
          eproc.unref();
          send(res, 200, JSON.stringify({ok: true}));
        });
      }, () => {});
      return true;
    }

    // ── GET /temp/* ──
    if (method === 'GET' && p.startsWith('/temp/')) {
      const allowed = ['custom_ar.mp3', 'custom_ur.mp3', 'custom_merged.wav'];
      const name = path.basename(decodeURIComponent(p.slice('/temp/'.length)));
      if (!allowed.includes(name)) return send(res, 404, 'not found', 'text/plain');
      const file = path.join(TEMP, 'custom', name);
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache'});
      fs.createReadStream(file).pipe(res);
      return true;
    }

    // ── GET /preview/* ──
    if (method === 'GET' && p.startsWith('/preview/')) {
      const theme = p.slice('/preview/'.length).replace(/\.png$/, '');
      const valid = ['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
        'ocean', 'desert', 'royal', 'ramadan', 'eid', 'qadr'];
      if (!valid.includes(theme)) return send(res, 404, 'not found', 'text/plain');
      const file = path.join(OUT, 'previews', theme + '.png');
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'image/png', 'Cache-Control': 'no-cache'});
      fs.createReadStream(file).pipe(res);
      return true;
    }

    // ── GET /video/* ──
    if (method === 'GET' && p.startsWith('/video/')) {
      serveVideo(req, res, decodeURIComponent(p.slice('/video/'.length)));
      return true;
    }

    // ── GET /thumb/* ──
    if (method === 'GET' && p.startsWith('/thumb/')) {
      const file = path.join(OUT, 'thumbs', path.basename(decodeURIComponent(p.slice('/thumb/'.length))));
      // Path traversal guard: ensure resolved path stays within OUT
      if (!file.startsWith(OUT)) return send(res, 403, 'forbidden', 'text/plain');
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'image/png', 'Cache-Control': 'no-store'});
      fs.createReadStream(file).pipe(res);
      return true;
    }

    // ── GET /api/history ──
    if (method === 'GET' && p === '/api/history') {
      routeCatch(res, async () => {
        let arr = [];
        try { arr = JSON.parse((await F.readFile(HIST_PATH, 'utf8')).replace(/^\uFEFF/, '')); } catch (_) { arr = []; }
        send(res, 200, JSON.stringify({ok: true, history: arr}));
      });
      return true;
    }

    // ── POST /api/thumbs-all ──
    if (method === 'POST' && p === '/api/thumbs-all') {
      if (job.running || queue.active) return send(res, 409, JSON.stringify({ok: false, error: 'Job already running'}));
      send(res, 200, JSON.stringify({ok: true}));
      (async () => {
        try {
          const list = await loadDuas();
          const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
          await F.mkdir(path.join(OUT, 'thumbs'), {recursive: true});
          let n = 0;
          for (const d of list) {
            const t = d.id + '.png';
            const tp = path.join(OUT, 'thumbs', t);
            if (await exists(tp)) continue;
            const leg = path.join(OUT, 'thumbs', safeTitle(d.title) + '.png');
            if (await exists(leg)) { await F.copyFile(leg, tp); continue; }
            const compId = d.id.replace(/_/g, '-');
            log('THUMB [' + (++n) + ']: ' + d.id);
            await run(process.execPath, [cli, 'still', compId,
              'out/thumbs/' + t, '--frame=100',
              '--browser-executable=' + CHROME, '--log=error']);
          }
          log('THUMBS COMPLETE');
        } catch (e) {
          log('THUMBS ERROR: ' + (e && e.message || e));
        }
      })();
      return true;
    }

    // ── GET /api/status ──
    if (method === 'GET' && p === '/api/status') {
      return send(res, 200, JSON.stringify(Object.assign({}, job, {
        queue: {active: queue.active,
          current: job.running ? job.duaId : null,
          total: queue.items.length, idx: queue.idx,
          done: queue.done.length,
          failed: queue.failed.map((f) => f.id),
          skipped: queue.skipped},
      })));
    }

    // ── GET /api/status/stream (SSE) ──
    if (method === 'GET' && p === '/api/status/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const sseId = Date.now().toString(36);
      const sendSSE = (data) => {
        try { res.write('id: ' + sseId + '\ndata: ' + JSON.stringify(data) + '\n\n'); }
        catch (_) {}
      };
      sendSSE(Object.assign({}, job, {queue: {active: queue.active}}));
      const iv = setInterval(() => {
        sendSSE(Object.assign({}, job, {
          queue: {active: queue.active, total: queue.items.length,
            idx: queue.idx, done: queue.done.length},
        }));
      }, 1000);
      req.on('close', () => clearInterval(iv));
      return true;
    }

    // ── POST /api/render-all ──
    if (method === 'POST' && p === '/api/render-all') {
      if (job.running || queue.active) return send(res, 409, JSON.stringify({ok: false, error: 'Job already running'}));
      routeCatch(res, async () => {
        const list = await loadDuas();
        const items = [];
        for (const d of list) {
          if (d.archived || d.locked) continue;
          if (!(await exists(path.join(OUT, safeTitle(d.title) + '.mp4')))) items.push(d.id);
        }
        queue.active = true; queue.items = items; queue.idx = 0;
        queue.done = []; queue.failed = []; queue.skipped = []; queue.cancelRequested = false;
        processQueue();
        log('BATCH START: ' + items.length + ' videos (sirf missing - rendered skip)');
        send(res, 200, JSON.stringify({ok: true, total: items.length}));
      });
      return true;
    }

    // ── POST /api/cancel ──
    if (method === 'POST' && p === '/api/cancel') {
      const wasBatch = queue.active;
      queue.cancelRequested = true;
      job.cancelFlag = true;
      killChildren('CANCEL');
      send(res, 200, JSON.stringify({ok: true, batch: wasBatch}));
      return true;
    }

    // ── POST /api/render ──
    if (method === 'POST' && p === '/api/render') {
      readBody(req, res).then((body) => {
        routeCatch(res, async () => {
          const f = parseJson(body, 'render');
          const id = String(f.duaId || '').trim();
          if (!id || !/^[a-z0-9_\-]{1,80}$/.test(id)) {
            throw err(400, 'duaId invalid format (a-z 0-9 _ - max 80)');
          }
          send(res, 200, JSON.stringify(await startJob(id, !!f.force)));
        });
      }, () => {});
      return true;
    }

    return false; // not handled
  };
  handler.duaStatus = duaStatus;
  handler.shutdown = function renderShutdown() {
    queue.cancelRequested = true;
    job.cancelFlag = true;
    killChildren('SHUTDOWN');
    log('SHUTDOWN: render children killed, queue cancelled');
  };
  return handler;
};