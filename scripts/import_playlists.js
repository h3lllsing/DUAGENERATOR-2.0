/**
 * import_playlists.js
 *
 * Ports the legacy playlist plan (H:\DuaVideoGenerator\data\playlist_plan_channel1.json)
 * into the V2 DB (data/v2.db, playlists + playlist_members tables).
 *
 * Idempotent: upserts by playlist key + member (playlist_id, dua_slug).
 * Usage: node scripts/import_playlists.js [path-to-plan.json]
 */

const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'v2.db');
const PROD_PLAN = 'H:\\DuaVideoGenerator\\data\\playlist_plan_channel1.json';
const PLAN_PATH = process.argv[2] || PROD_PLAN;

function importPlans(db, planPath) {
    if (!fs.existsSync(planPath)) {
        console.warn('⚠ Playlist plan not found at ' + planPath);
        process.exit(1);
    }
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
    const playlists = Array.isArray(plan.playlists) ? plan.playlists : [];
    console.log('📋 Loaded ' + playlists.length + ' playlists for channel "' + (plan.channel || '?') + '"');

    const upsertPlaylist = db.prepare(`
        INSERT INTO playlists (key, title, channel_id, member_count, status)
        VALUES (?, ?, NULL, ?, 'active')
        ON CONFLICT(key) DO UPDATE SET
            title = excluded.title,
            member_count = excluded.member_count,
            updated_at = datetime('now')
    `);
    const getPlaylist = db.prepare('SELECT id FROM playlists WHERE key = ?');
    const getMember = db.prepare('SELECT id FROM playlist_members WHERE playlist_id = ? AND dua_slug = ?');
    const insertMember = db.prepare(`
        INSERT INTO playlist_members (playlist_id, dua_id, dua_slug, video_yid, title, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    const updateMember = db.prepare('UPDATE playlist_members SET dua_id = ?, video_yid = ?, title = ? WHERE id = ?');
    const getDua = db.prepare('SELECT id FROM duas WHERE slug = ?');

    let plCount = 0, memCount = 0, matchedDuas = 0;
    for (const pl of playlists) {
        if (!pl.key || !pl.title) continue;
        upsertPlaylist.run(pl.key, pl.title, (pl.members || []).length);
        const plRow = getPlaylist.get(pl.key);
        plCount++;
        for (const m of pl.members || []) {
            const slug = 'dua-' + String(m.dua_id).replace(/_/g, '-');
            const duaRow = getDua.get(slug);
            if (duaRow) matchedDuas++;
            const existing = getMember.get(plRow.id, slug);
            if (existing) {
                updateMember.run(duaRow ? duaRow.id : null, m.video_id || null, m.title || null, existing.id);
            } else {
                insertMember.run(plRow.id, duaRow ? duaRow.id : null, slug, m.video_id || null, m.title || null);
            }
            memCount++;
        }
    }

    db.prepare("UPDATE playlists SET added_count = (SELECT COUNT(*) FROM playlist_members pm WHERE pm.playlist_id = playlists.id AND pm.status = 'added')").run();

    console.log(`✓ ${plCount} playlists, ${memCount} members (${matchedDuas} matched to duas)`);
}

function main() {
    console.log('=== Playlist Import ===');
    const db = new sqlite3(DB_PATH);
    importPlans(db, PLAN_PATH);
    const totalPlaylists = db.prepare('SELECT COUNT(*) as c FROM playlists').get().c;
    const totalMembers = db.prepare('SELECT COUNT(*) as c FROM playlist_members').get().c;
    console.log(`📊 Total in DB: ${totalPlaylists} playlists, ${totalMembers} members`);
    db.close();
}

main();