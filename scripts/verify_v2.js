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
