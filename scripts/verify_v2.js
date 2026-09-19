const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:7870';
let TOKEN = null;
let passed = 0, failed = 0;

function test(name, ok) {
  if (ok) { console.log('  PASS: ' + name); passed++; }
  else { console.log('  FAIL: ' + name); failed++; }
}

function httpGet(urlPath, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.get(url, { headers: headers || {} }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body: body }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, headers || {}),
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end(payload);
  });
}

async function main() {
  console.log('=== V2 Phase 1 Smoke Test ===\n');

  // 1. Health
  console.log('1. Health:');
  try {
    const r = await httpGet('/api/v1/health');
    test('Health returns 200', r.status === 200);
    test('Health body ok=true', r.body && r.body.ok === true);
  } catch (e) { test('Health endpoint', false); }

  // 2. Auth enforcement
  console.log('\n2. Auth:');
  try {
    const r1 = await httpGet('/api/v1/duas');
    test('No token on /duas = 401', r1.status === 401);
  } catch (e) { test('Auth on /duas', false); }
  try {
    const r2 = await httpGet('/api/v1/videos');
    test('No token on /videos = 401', r2.status === 401);
  } catch (e) { test('Auth on /videos', false); }
  try {
    const r3 = await httpGet('/api/v1/status');
    test('No token on /status = 401', r3.status === 401);
  } catch (e) { test('Auth on /status', false); }

  // 3. Token
  console.log('\n3. Token:');
  try {
    const tp = path.resolve(process.cwd(), 'data', 'duav2_token.json');
    if (fs.existsSync(tp)) {
      TOKEN = JSON.parse(fs.readFileSync(tp, 'utf-8')).token;
      test('Token file exists', true);
      test('Token is non-empty string', typeof TOKEN === 'string' && TOKEN.length > 10);
    } else { test('Token file exists', false); }
  } catch (e) { test('Token loading', false); }

  // 4. Authenticated requests
  if (TOKEN) {
    console.log('\n4. Authenticated:');
    try {
      const r = await httpGet('/api/v1/duas', { Authorization: 'Bearer ' + TOKEN });
      test('GET /duas with token = 200', r.status === 200);
      test('Response has ok=true', r.body && r.body.ok === true);
    } catch (e) { test('Authenticated /duas', false); }
    try {
      const r = await httpGet('/api/v1/videos', { Authorization: 'Bearer ' + TOKEN });
      test('GET /videos with token = 200', r.status === 200);
    } catch (e) { test('Authenticated /videos', false); }
    try {
      const r = await httpGet('/api/v1/status', { Authorization: 'Bearer ' + TOKEN });
      test('GET /status with token = 200', r.status === 200);
      test('Status has stats', r.body && r.body.data && r.body.data.stats);
    } catch (e) { test('Authenticated /status', false); }
    try {
      const r = await httpGet('/api/v1/jobs', { Authorization: 'Bearer ' + TOKEN });
      test('GET /jobs with token = 200', r.status === 200);
    } catch (e) { test('Authenticated /jobs', false); }

    // Phase 2 endpoints
    console.log('\n4b. Phase 2 Content Studio:');
    try {
      const r = await httpGet('/api/v1/review/queue', { Authorization: 'Bearer ' + TOKEN });
      test('GET /review/queue = 200', r.status === 200);
      test('Review queue is array', Array.isArray(r.body.data));
    } catch (e) { test('Review queue endpoint', false); }
    try {
      const r = await httpGet('/api/v1/seo/pillars', { Authorization: 'Bearer ' + TOKEN });
      test('GET /seo/pillars = 200', r.status === 200);
      test('Pillars is array (20)', r.body.data && r.body.data.length === 20);
    } catch (e) { test('SEO pillars endpoint', false); }
    try {
      const r = await httpGet('/api/v1/seo/pillars/distribution', { Authorization: 'Bearer ' + TOKEN });
      test('GET /seo/pillars/distribution = 200', r.status === 200);
    } catch (e) { test('SEO distribution endpoint', false); }

    // Phase 3 Growth endpoints
    console.log('\n4c. Phase 3 Growth Engine:');
    const growEndpoints = [
      ['GET', '/schedules'], ['GET', '/schedules/calendar'], ['GET', '/schedules/capacity'],
      ['GET', '/analytics/overview'], ['GET', '/analytics/underperformers'],
      ['GET', '/playlists'], ['GET', '/topics'], ['GET', '/status'],
    ];
    for (const [method, p] of growEndpoints) {
      try {
        const r = await httpGet('/api/v1' + p, { Authorization: 'Bearer ' + TOKEN });
        test(method + ' ' + p + ' = 200', r.status === 200);
      } catch (e) { test(method + ' ' + p, false); }
    }
    try {
      const r = await httpPost('/api/v1/schedules/run-check', { Authorization: 'Bearer ' + TOKEN }, {});
      test('POST /schedules/run-check works', r.status === 200 && r.body.ok === true);
      if (r.body && r.body.ok) {
        let checks = 0;
        if (typeof r.body.data.dispatched === 'number') checks++;
        if (typeof r.body.data.skipped === 'number') checks++;
        if (typeof r.body.data.nextDueAt === 'string' || r.body.data.nextDueAt === null) checks++;
        test('run-check returns dispatched/skipped/nextDueAt', checks === 3);
      }
    } catch (e) { test('POST /schedules/run-check', false); }
    try {
      const r = await httpGet('/api/v1/status', { Authorization: 'Bearer ' + TOKEN });
      const stats = r.body && r.body.data && r.body.data.stats;
      test('Status includes growth counters', stats && typeof stats.schedules === 'number' && typeof stats.capacityLeft === 'number');
    } catch (e) { test('Status growth counters', false); }

// Phase 4 monitoring
    console.log('\n4d. Phase 4 Monitoring:');
    try {
      const r = await httpGet('/api/v1/monitoring', { Authorization: 'Bearer ' + TOKEN });
      test('GET /monitoring = 200', r.status === 200);
      const m = r.body && r.body.data;
      test('Monitoring has jobs.byState', m && m.jobs && typeof m.jobs.byState === 'object');
      test('Monitoring has queueDepth number', m && typeof m.queueDepth === 'number');
      test('Monitoring has disk info', m && (m.disk === null || (typeof m.disk.freeBytes === 'number' && typeof m.disk.totalBytes === 'number')));
      test('Monitoring has dbSizeBytes number', m && typeof m.dbSizeBytes === 'number');
      test('Monitoring has quota or null', m && (m.quota === null || (m.quota && typeof m.quota.remaining === 'number')));
    } catch (e) { test('Monitoring endpoint', false); }
    try {
      const r = await httpGet('/manifest.webmanifest', {});
      test('PWA manifest served (200)', r.status === 200);
    } catch (e) { test('PWA manifest', false); }
    try {
      const r = await httpGet('/sw.js', {});
      test('Service worker served (200)', r.status === 200);
    } catch (e) { test('Service worker', false); }

    // 5. Invalid token
    console.log('\n5. Security:');
    try {
      const r = await httpGet('/api/v1/duas', { Authorization: 'Bearer invalid_token_12345' });
      test('Invalid token = 401', r.status === 401);
    } catch (e) { test('Invalid token rejection', false); }
  }

  // Summary
  console.log('\n=== Results: ' + passed + '/' + (passed + failed) + ' passed ===');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
