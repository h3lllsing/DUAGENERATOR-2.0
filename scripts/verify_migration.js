// V2 Legacy Migration Verification Report
// Writes data/migration_report.json with TRUTHFUL migration numbers (no assumptions).
// Run: node scripts/verify_migration.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROD_DATA = 'H:/DuaVideoGenerator/data';
const DB_PATH = path.join(ROOT, 'data', 'v2.db');
const REPORT_PATH = path.join(ROOT, 'data', 'migration_report.json');
const LEGACY_EN_REVIEW = path.join(ROOT, 'data', 'legacy_en_review.json');

if (!fs.existsSync(DB_PATH)) { console.error('No v2.db found at ' + DB_PATH); process.exit(1); }
const db = new Database(DB_PATH, { readonly: true });

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

// --- duas ---
const legacyDuas = readJson(path.join(PROD_DATA, 'duas.json'));
const duasTotal = db.prepare('SELECT COUNT(*) c FROM duas').get().c;

// --- ledger ---
const uploadState = readJson(path.join(PROD_DATA, 'upload_state_channel1.json')) || {};
const shortsState = readJson(path.join(PROD_DATA, 'shorts_state_channel1.json')) || {};
const ledgerRows = db.prepare('SELECT COUNT(*) c FROM ledger_entries').get().c;
const distinctDuaIds = db.prepare('SELECT COUNT(DISTINCT dua_id) c FROM ledger_entries').get().c;

const matchedBySlug = [];
const matchedByTitle = [];
const orphans = [];
const slugsInV2 = new Set(db.prepare('SELECT slug FROM duas').all().map(r => r.slug));
const tilesInV2 = new Map(db.prepare('SELECT slug, title FROM duas').all().map(r => [r.slug, String(r.title).toLowerCase()]));
const norm = (k) => 'dua-' + k.replace(/_/g, '-');
for (const key of Object.keys(uploadState)) {
  if (slugsInV2.has(norm(key))) { matchedBySlug.push(key); continue; }
  const keyTitle = key.replace(/_/g, ' ').toLowerCase();
  const hit = [...tilesInV2.entries()].find(([, t]) => t === keyTitle || t.includes(keyTitle) || keyTitle.includes(t));
  if (hit) { matchedByTitle.push(key); continue; }
  orphans.push(key);
}

// --- en_review ---
const legacyEnReview = readJson(path.join(PROD_DATA, 'en_review.json'));
let legacyReviewKeys = 0;
if (legacyEnReview && typeof legacyEnReview === 'object') {
  legacyReviewKeys = Object.keys(legacyEnReview).filter(k => k !== '_comment').length;
}
const reviewRows = db.prepare('SELECT COUNT(*) c FROM review').get().c;
const legacyAttached = db.prepare("SELECT COUNT(*) c FROM review WHERE reviewer = 'legacy-migration'").get().c;

// --- channels / quota / migrations ---
const channels = db.prepare('SELECT name, daily_caps, quota_used, quota_date FROM channels').all();
const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r => r.version);

// --- copy legacy_en_review into V2 workspace (runtime seed source) ---
let enReviewCopyStatus = 'n/a';
if (legacyEnReview) {
  if (fs.existsSync(LEGACY_EN_REVIEW)) {
    enReviewCopyStatus = 'exists (kept)';
  } else {
    try {
      fs.copyFileSync(path.join(PROD_DATA, 'en_review.json'), LEGACY_EN_REVIEW);
      enReviewCopyStatus = 'copied from prod';
    } catch { enReviewCopyStatus = 'copy failed'; }
  }
}

const report = {
  generated_at: new Date().toISOString(),
  duas: { legacy: Array.isArray(legacyDuas) ? legacyDuas.length : null, v2: duasTotal, ratio: Array.isArray(legacyDuas) ? (duasTotal / legacyDuas.length).toFixed(4) : null },
  ledger: { upload_slugs: Object.keys(uploadState).length, shorts_slugs: Object.keys(shortsState).length, v2_rows: ledgerRows, distinct_duas: distinctDuaIds, matched_by_slug: matchedBySlug.length, matched_by_title: matchedByTitle.length, unmatched_slug_list: orphans },
  en_review: { legacy_keys: legacyReviewKeys, v2_rows: reviewRows, attached_from_legacy: legacyAttached, seed_source: enReviewCopyStatus },
  channels,
  migrations,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log('Migration report written to ' + REPORT_PATH);
console.log(JSON.stringify(report, null, 2));
db.close();