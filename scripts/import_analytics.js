/**
 * import_analytics.js
 *
 * Imports per-day YouTube analytics from a manual JSON file into the V2 DB
 * (data/v2.db, analytics_cache). This is the allwed way to feed analytics in
 * dev — no live YouTube API calls.
 *
 * Expected file data/analytics_manual.json:
 *   { "rows": [ { "video_yid": "xxxx", "day": "2026-09-13",
 *                 "views": 120, "likes": 8, "comments": 1, "ctr": 3.1, "retention": 45 } ] }
 * Or a bare array with the same objects.
 *
 * Idempotent (INSERT OR REPLACE by video_yid + day).
 * Usage: node scripts/import_analytics.js [path-to-json]
 */

const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'v2.db');
const MANUAL_FILE = path.join(__dirname, '..', 'data', 'analytics_manual.json');
const FILE = process.argv[2] || MANUAL_FILE;

function main() {
    if (!fs.existsSync(FILE)) {
        console.warn('⚠ Analytics file not found at ' + FILE);
        console.info('Expected: ' + JSON.stringify({ rows: [{ video_yid: 'xxxx', day: '2026-09-13', views: 0, likes: 0, comments: 0, ctr: 0, retention: 0 }] }));
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    const rows = Array.isArray(data) ? data : data.rows;
    if (!Array.isArray(rows)) {
        console.error('Malformed: expected array or {rows: []}');
        process.exit(1);
    }

    const db = new sqlite3(DB_PATH);
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO analytics_cache (video_yid, day, views, likes, comments, ctr, retention)
        VALUES (@video_yid, @day, @views, @likes, @comments, @ctr, @retention)
    `);
    let imported = 0;
    for (const r of rows) {
        if (!r.video_yid || !r.day) continue;
        stmt.run({ ...r, views: r.views || 0, likes: r.likes || 0, comments: r.comments || 0, ctr: r.ctr || 0, retention: r.retention || 0 });
        imported++;
    }
    const totals = db.prepare('SELECT COUNT(DISTINCT video_yid) as vids, COUNT(DISTINCT day) as days FROM analytics_cache').get();
    db.close();
    console.log(`✓ Imported ${imported} metric rows`);
    console.log(`📊 analytics_cache now covers ${totals.vids} videos over ${totals.days} days`);
}

main();