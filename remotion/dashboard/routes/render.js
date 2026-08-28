'use strict';
/**
 * Render routes — extracted from server.js (v0.11 step 4b).
 * Factory: renderRoutes(deps) → handler(req, url, res) → boolean
 */
module.exports = function renderRoutes(deps) {
  const {PROJECT, REMOTION, TEMP, OUT, DATA, PY, CHROME, FFMPEG, CFG_PATH,
    fs, path, crypto, spawn, process, send,
    lookspec, fxg, themeMap, cacheStore, saveCache, qcStore, saveQc} = deps;

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

  // ── Helpers ──
  function log(line) {
    const ts = new Date().toLocaleTimeString();
    job.logs.push('[' + ts + '] ' + line);
    if (job.logs.length > 400) job.logs.splice(0, job.logs.length - 400);
    console.log(line);
  }

  function writeAtomic(f, data) {
    const tmp = f + '.' + Date.now() + '.tmp.json';
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, f);
  }

  function getDuaTitle(id) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.duas;
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

  function readStylePreset() {
    try {
      const c = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      return STYLE_PRESETS.includes(c.stylePreset) ? c.stylePreset : 'classic';
    } catch (_) { return 'classic'; }
  }

  function readArtFxOverride() {
    try {
      const c = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      return fxg.ART_SELECT.includes(c.artFx) && c.artFx !== 'auto' ? c.artFx : null;
    } catch (_) { return null; }
  }
  function readSkyFxOverride() {
    try {
      const c = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      return fxg.SKY_SELECT.includes(c.skyFx) && c.skyFx !== 'auto' ? c.skyFx : null;
    } catch (_) { return null; }
  }
  function readBorderFxOverride() {
    try {
      const c = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      return fxg.BORDER_SELECT.includes(c.borderFx) && c.borderFx !== 'auto' ? c.borderFx : null;
    } catch (_) { return null; }
  }

  function lookPathFor(duaId) {
    return path.join(TEMP, duaId + '_look.json');
  }

  function readLookMode() {
    try {
      const c = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      return c.lookMode === 'signature' ? 'signature' : 'random';
    } catch (_) { return 'random'; }
  }

  function ensureLookSpec(duaId, dua) {
    if (readLookMode() !== 'random') {
      try { fs.rmSync(lookPathFor(duaId), {force: true}); } catch (_) {}
      return null;
    }
    const lp = lookPathFor(duaId);
    try {
      if (fs.existsSync(lp)) {
        const j = JSON.parse(fs.readFileSync(lp, 'utf8').replace(/^\uFEFF/, ''));
        if (j && j.lookSpec) return j.lookSpec;
        try { writeAtomic(lp, JSON.stringify({lookSpec: j}, null, 2)); } catch (_) {}
        return j;
      }
    } catch (_) {}
    let theme = 'dark';
    try { theme = themeMap.resolve(dua || {id: duaId}); } catch (_) {}
    const spec = lookspec.buildLookSpec(theme);
    const overrideFx = readArtFxOverride();
    if (overrideFx) spec.artFx = overrideFx;
    const overrideSky = readSkyFxOverride();
    if (overrideSky) spec.skyFx = overrideSky;
    const overrideBorder = readBorderFxOverride();
    if (overrideBorder) spec.borderFx = overrideBorder;
    const explicitSp = readStylePreset();
    if (explicitSp && explicitSp !== 'classic' && explicitSp !== 'auto') {
      spec.preset = explicitSp;
      spec.tint = (fxg.PRESET_TINTS || {})[explicitSp] || spec.tint || null;
    }
    try { writeAtomic(lp, JSON.stringify({lookSpec: spec}, null, 2)); } catch (_) {}
    return spec;
  }

  function stylePropsArgs(duaId) {
    const sp = readStylePreset();
    if (sp && sp !== 'classic' && sp !== 'auto') {
      const f = path.join(TEMP, 'style_props.json');
      let inner = null;
      if (duaId) {
        try { inner = JSON.parse(fs.readFileSync(lookPathFor(duaId), 'utf8')).lookSpec || null; } catch (_) {}
      }
      try { fs.writeFileSync(f, JSON.stringify(inner ? {stylePreset: sp, lookSpec: inner} : {stylePreset: sp})); } catch (_) {}
      return ['--props=' + f];
    }
    if (duaId) {
      const lf = lookPathFor(duaId);
      if (fs.existsSync(lf)) return ['--props=' + lf];
    }
    return [];
  }

  function npxRender(duaId, outName, onProgress) {
    return new Promise((resolve) => {
      const compId = duaId.replace(/_/g, '-');
      const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
      const args = ['render', compId,
        'out/' + outName,
        '--browser-executable=' + CHROME,
        '--crf=18', '--jpeg-quality=100', '--log=error',
        ...stylePropsArgs(duaId)];
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
      let err = '';
      p.stderr.on('data', (d) => { err += d.toString(); });
      p.on('close', (code) => {
        if (code === 0 && fs.existsSync(tmp)) {
          try {
            fs.rmSync(vidPath, {force: true});
            fs.renameSync(tmp, vidPath);
            log('BT.709 tags applied (stream copy)');
          } catch (e) {
            try { fs.rmSync(tmp, {force: true}); } catch (_) {}
            log('bt709 rename skip: ' + e.message);
          }
        } else {
          try { fs.rmSync(tmp, {force: true}); } catch (_) {}
          log('bt709 tag skip (non-fatal): ' + err.slice(-160).trim());
        }
        resolve();
      });
      p.on('error', () => { log('ffmpeg bt709 spawn error'); resolve(); });
    });
  }

  function recordHistory(duaId, ok, extra) {
    try {
      const arr = fs.existsSync(HIST_PATH)
        ? JSON.parse(fs.readFileSync(HIST_PATH, 'utf8')) : [];
      arr.unshift(Object.assign({
        ts: new Date().toISOString(), duaId,
        title: getDuaTitle(duaId), result: ok ? 'PASS' : 'FAIL',
      }, extra || {}));
      writeAtomic(HIST_PATH, JSON.stringify(arr.slice(0, 200), null, 2));
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

  function cacheKey(dua) {
    const aud = path.join(REMOTION, 'public', 'audio', dua.id + '.mp3');
    const cfgPath = CFG_PATH;
    const sfxDir = path.join(REMOTION, 'public', 'sfx');
    const sfx = ['whoosh.mp3', 'riser.mp3', 'tick.mp3']
      .map((f) => fs.existsSync(path.join(sfxDir, f)) ? 1 : 0).join('');
    let audSig = 'none';
    try { const st = fs.statSync(aud); audSig = st.mtimeMs + ':' + st.size; } catch (_) {}
    let cfg = '';
    try { cfg = fs.readFileSync(cfgPath, 'utf8'); } catch (_) {}
    return crypto.createHash('md5').update(
      JSON.stringify(dua) + '|' + audSig + '|' + cfg + '|' + sfx).digest('hex');
  }

  async function genThumb(duaId, outName, force) {
    try {
      const tname = duaId + '.png';
      const tpath = path.join(OUT, 'thumbs', tname);
      if (!force && fs.existsSync(tpath)) return;
      if (force && fs.existsSync(tpath)) fs.rmSync(tpath, {force: true});
      const legacy = path.join(OUT, 'thumbs', outName.replace(/\.mp4$/, '.png'));
      if (!force && fs.existsSync(legacy)) {
        fs.copyFileSync(legacy, tpath);
        return;
      }
      const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
      const compId = duaId.replace(/_/g, '-');
      fs.mkdirSync(path.join(OUT, 'thumbs'), {recursive: true});
      try {
        const lf = lookPathFor(duaId);
        if (fs.existsSync(lf)) {
          const lk = JSON.parse(fs.readFileSync(lf, 'utf8')).lookSpec ||
            JSON.parse(fs.readFileSync(lf, 'utf8'));
          log('THUMB LOOK: ' + [lk.preset, lk.frame, lk.camera].filter(Boolean).join('/'));
        }
      } catch (_) {}
      await run(process.execPath, [cli, 'still', compId,
        'out/thumbs/' + tname, '--frame=100',
        '--browser-executable=' + CHROME, '--log=error',
        ...stylePropsArgs(duaId)]);
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

  function alreadyRendered(duaId) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.duas;
      const d = list.find((x) => x.id === duaId);
      if (!d) return false;
      return fs.existsSync(path.join(OUT, safeTitle(d.title) + '.mp4'));
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
    if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
    const stat = fs.statSync(file);
    const range = req.headers.range;
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = m && m[1] ? parseInt(m[1]) : 0;
      let end = m && m[2] ? parseInt(m[2]) : stat.size - 1;
      end = Math.min(end, stat.size - 1);
      res.writeHead(206, {
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file, {start, end}).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    }
  }

  // ── Core render logic ──
  async function doJob(duaId, force) {
    const duas = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8'));
    const list = Array.isArray(duas) ? duas : duas.duas;
    const dua = list.find((d) => d.id === duaId);
    const outName = safeTitle(dua && dua.title) + '.mp4';
    const vidPath = path.join(OUT, outName);

    if (!force && fs.existsSync(vidPath)) {
      const k = cacheKey(dua || {id: duaId});
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
    const haveAudio = arts.every((p) => fs.existsSync(p));

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

    try { fs.rmSync(lookPathFor(duaId), {force: true}); } catch (_) {}
    const lookSpec = ensureLookSpec(duaId, dua);
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

    if (!fs.existsSync(vidPath)) throw new Error('output missing: ' + outName);
    await tagBt709(vidPath);

    job.step = 'qc';
    job.percent = 100;
    let qc = await qcCheck(duaId, vidPath);
    if (!qc.pass && !cancelled()) {
      log('QC FAIL - ek retry render ho raha hai');
      try { fs.rmSync(vidPath, {force: true}); } catch (_) {}
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

    cacheStore[duaId] = {key: cacheKey(dua), out: outName};
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
        recordHistory(id, true, {look: job && job.lookSummary});
      } catch (e) {
        const msg = String(e.message || e);
        if (msg === 'Cancelled' || queue.cancelRequested) break;
        queue.failed.push({id, error: msg});
        recordHistory(id, false, {error: msg});
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

  function startJob(duaId, force) {
    if (job.running || queue.active) return {ok: false, error: 'Job already running'};
    if (!force && alreadyRendered(duaId)) {
      return {ok: false,
        error: 'Ye video pehle se RENDERED hai - dobara render se baked style/voice badal jayega. Force ke liye expert mode use karo'};
    }
    resetJob(duaId);
    (async () => {
      try {
        await doJob(duaId, force);
        recordHistory(duaId, true, {look: job && job.lookSummary});
      } catch (e) {
        const msg = String(e.message || e);
        job.error = msg;
        job.step = msg === 'Cancelled' ? 'cancelled' : 'failed';
        if (job.step === 'failed') recordHistory(duaId, false, {error: msg});
        log((job.step === 'cancelled' ? 'CANCELLED: ' : 'FAILED: ') + msg);
      } finally {
        job.running = false;
      }
    })();
    return {ok: true};
  }

  function startVoiceJob(duaId, force) {
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

  // ── Read body helper ──
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
  const handler = function handleRender(req, url, res) {
    const method = req.method;
    const p = url.pathname;

    // ── POST /api/voice-only ──
    if (method === 'POST' && p === '/api/voice-only') {
      readBody(req, res, (body) => {
        try {
          const {duaId, force} = JSON.parse(body);
          send(res, 200, JSON.stringify(startVoiceJob(String(duaId), !!force)));
        } catch (e) { send(res, 400, JSON.stringify({ok: false})); }
      });
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
      readBody(req, res, (body) => {
        try {
          const f = JSON.parse(body);
          const a = String(f.arabic || '').trim();
          const u = String(f.urdu || '').trim();
          if (!a && !u) return send(res, 400, JSON.stringify({ok: false, error: 'Arabic ya Urdu text do'}));
          if (a.length > 5000) return send(res, 400, JSON.stringify({ok: false,
            error: 'Arabic text bahut lamba hai (max 5000 chars)'}));
          if (u.length > 5000) return send(res, 400, JSON.stringify({ok: false,
            error: 'Urdu text bahut lamba hai (max 5000 chars)'}));
          const name = /^[a-z0-9_]{1,60}$/.test(String(f.name || '')) ? String(f.name) : 'custom_' + Date.now();
          const cdir = path.join(TEMP, 'custom');
          fs.mkdirSync(cdir, {recursive: true});
          const pf = path.join(cdir, 'payload.json');
          fs.writeFileSync(pf, JSON.stringify({arabic: a, urdu: u, name}), 'utf8');
          runQuiet(PY, ['scripts/tts_custom.py', pf]).then((code) => {
            if (code !== 0) return send(res, 500, JSON.stringify({ok: false, error: 'TTS fail hua'}));
            const savedFile = name + '.mp3';
            const savedOk = fs.existsSync(path.join(REMOTION, 'public', 'audio', savedFile));
            log('CUSTOM TTS SAVED: ' + savedFile);
            send(res, 200, JSON.stringify({ok: true, okA: !!a, okU: !!u,
              merged: !!(a && u), savedFile: savedOk ? savedFile : null, ts: Date.now()}));
          });
        } catch (e) { send(res, 400, JSON.stringify({ok: false, error: 'bad request'})); }
      });
      return true;
    }

    // ── POST /api/open-folder ──
    if (method === 'POST' && p === '/api/open-folder') {
      readBody(req, res, (body) => {
        try {
          const {which} = JSON.parse(body);
          const map = {videos: OUT, audio: path.join(REMOTION, 'public', 'audio'), temp: TEMP};
          const fp = map[which];
          if (!fp || !fs.existsSync(fp)) return send(res, 404, JSON.stringify({ok: false, error: 'folder nahi mila'}));
          spawn('explorer', [fp]);
          send(res, 200, JSON.stringify({ok: true}));
        } catch (e) { send(res, 400, JSON.stringify({ok: false})); }
      });
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
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, {'Content-Type': 'image/png', 'Cache-Control': 'no-store'});
      fs.createReadStream(file).pipe(res);
      return true;
    }

    // ── GET /api/history ──
    if (method === 'GET' && p === '/api/history') {
      try {
        const arr = fs.existsSync(HIST_PATH) ? JSON.parse(fs.readFileSync(HIST_PATH, 'utf8')) : [];
        return send(res, 200, JSON.stringify({ok: true, history: arr}));
      } catch (_) {
        return send(res, 200, JSON.stringify({ok: true, history: []}));
      }
    }

    // ── POST /api/thumbs-all ──
    if (method === 'POST' && p === '/api/thumbs-all') {
      if (job.running || queue.active) return send(res, 409, JSON.stringify({ok: false, error: 'Job already running'}));
      send(res, 200, JSON.stringify({ok: true}));
      (async () => {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8'));
          const list = Array.isArray(raw) ? raw : raw.duas;
          const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
          fs.mkdirSync(path.join(OUT, 'thumbs'), {recursive: true});
          let n = 0;
          for (const d of list) {
            const t = d.id + '.png';
            const tp = path.join(OUT, 'thumbs', t);
            if (fs.existsSync(tp)) continue;
            const leg = path.join(OUT, 'thumbs', safeTitle(d.title) + '.png');
            if (fs.existsSync(leg)) { fs.copyFileSync(leg, tp); continue; }
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

    // ── POST /api/render-all ──
    if (method === 'POST' && p === '/api/render-all') {
      if (job.running || queue.active) return send(res, 409, JSON.stringify({ok: false, error: 'Job already running'}));
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'data', 'duas.json'), 'utf8'));
        const list = Array.isArray(raw) ? raw : raw.duas;
        const items = list
          .filter((d) => !d.archived && !d.locked &&
            !fs.existsSync(path.join(OUT, safeTitle(d.title) + '.mp4')))
          .map((d) => d.id);
        queue.active = true; queue.items = items; queue.idx = 0;
        queue.done = []; queue.failed = []; queue.skipped = []; queue.cancelRequested = false;
        processQueue();
        log('BATCH START: ' + items.length + ' videos (sirf missing - rendered skip)');
        send(res, 200, JSON.stringify({ok: true, total: items.length}));
      } catch (e) {
        send(res, 500, JSON.stringify({ok: false, error: String(e.message || e)}));
      }
      return true;
    }

    // ── POST /api/cancel ──
    if (method === 'POST' && p === '/api/cancel') {
      const wasBatch = queue.active;
      queue.cancelRequested = true;
      job.cancelFlag = true;
      if (job.child && job.child.pid) {
        log('CANCEL: killing pid ' + job.child.pid);
        spawn('taskkill', ['/PID', String(job.child.pid), '/T', '/F']);
      }
      for (const pid of children) {
        log('CANCEL: killing helper pid ' + pid);
        spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
      }
      send(res, 200, JSON.stringify({ok: true, batch: wasBatch}));
      return true;
    }

    // ── POST /api/render ──
    if (method === 'POST' && p === '/api/render') {
      readBody(req, res, (body) => {
        try {
          const {duaId, force} = JSON.parse(body);
          const id = String(duaId || '').trim();
          if (!id || !/^[a-z0-9_\-]{1,80}$/.test(id)) {
            return send(res, 400, JSON.stringify({ok: false,
              error: 'duaId invalid format (a-z 0-9 _ - max 80)'}));
          }
          const result = startJob(id, !!force);
          send(res, 200, JSON.stringify(result));
        } catch (e) { send(res, 400, JSON.stringify({ok: false, error: 'bad request'})); }
      });
      return true;
    }

    return false; // not handled
  };
  handler.duaStatus = duaStatus;
  return handler;
};
