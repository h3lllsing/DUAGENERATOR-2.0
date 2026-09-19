/**
 * import_legacy.js
 * 
 * Migrates legacy JSON data from H:\DuaVideoGenerator into the V2 SQLite schema.
 * Reads: duas.json, upload_state_channel1.json, shorts_state_channel1.json, en_review.json, quota_state_channel1.json
 * Writes to: data/v2.db (SQLite)
 * 
 * Usage: node scripts/import_legacy.js
 * 
 * This script is idempotent - it backs up the existing DB first and only inserts
 * records that don't already exist (based on unique constraints).
 */

const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Paths to legacy data files
const DB_PATH = path.join(__dirname, '..', 'data', 'v2.db');
const PROD_DATA = 'H:\\DuaVideoGenerator\\data';
const DUAS_PATH = path.join(PROD_DATA, 'duas.json');
const UPLOAD_STATE_PATH = path.join(PROD_DATA, 'upload_state_channel1.json');
const SHORTS_STATE_PATH = path.join(PROD_DATA, 'shorts_state_channel1.json');
const EN_REVIEW_PATH = path.join(PROD_DATA, 'en_review.json');
const QUOTA_STATE_PATH = path.join(PROD_DATA, 'quota_state_channel1.json');

// Backup existing DB if it exists
function backupDb() {
    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, `v2.db.backup.${Date.now()}.sqlite`);
    if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`✓ Backed up existing DB to ${backupPath}`);
    }
}

// Initialize SQLite database with schema
function initDb() {
    const schemaPath = path.join(__dirname, '..', 'apps', 'server', 'db', 'migrations', '001_init.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    const db = sqlite3(DB_PATH);
    db.exec(schema);
    console.log('✓ SQLite database initialized with schema');
    return db;
}

// Import das.json (114 entries)
function importDuas(db) {
    if (!fs.existsSync(DUAS_PATH)) {
        console.warn(`⚠ Duas file not found at ${DUAS_PATH}, skipping`);
        return;
    }
    
    const duas = JSON.parse(fs.readFileSync(DUAS_PATH, 'utf-8'));
    console.log(`📖 Loading ${duas.length} das from legacy file`);
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO duas (slug, title, title_en, urdu, arabic, english, explanation, reference, category, part, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let imported = 0;
    const errors = [];
    
    for (const dua of duas) {
        try {
            // Build slug from id or title
            const slug = `dua-${dua.id}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            
            // Determine source from reference or default
            let source = 'unknown';
            if (dua.reference) {
                const refLower = dua.reference.toLowerCase();
                if (refLower.includes('bukhari') || refLower.includes('sahih al-bukhari')) source = 'bukhari';
                else if (refLower.includes('muslim') || refLower.includes('sahih muslim')) source = 'muslim';
                else if (refLower.includes('tirmidhi') || refLower.includes('jami at-tirmidhi')) source = 'tirmidhi';
                else if (refLower.includes('abu dawud') || refLower.includes('sunan abu dawud')) source = 'abu_dawud';
                else if (refLower.includes('nasa') || refLower.includes('sunan an-nasa')) source = 'nasa_i';
                else if (refLower.includes('ibn majah') || refLower.includes('sunan ibn majah')) source = 'ibn_majah';
                else source = 'other';
            }
            
            stmt.run(
                slug,
                dua.title || `Dua ${dua.id}`,
                dua.title_en,
                dua.urdu,
                dua.arabic,
                dua.english,
                dua.explanation,
                dua.reference,
                dua.category,
                dua.part,
                source
            );
            imported++;
        } catch (e) {
            errors.push({ duaId: dua.id, error: e.message });
        }
    }
    
    console.log(`✓ Imported/updated ${imported} das records`);
    if (errors.length > 0) {
        console.warn(`⚠ ${errors.length} errors during import`);
        errors.forEach(e => console.warn(`  - Dua ${e.duaId}: ${e.error}`));
    }
    
    return { imported, errors };
}

// Import upload_state_channel1.json
function importUploadState(db) {
    // Ensure channel1 exists (FK constraint)
    const existingChannel = db.prepare('SELECT id FROM channels WHERE name = ?').get('channel1');
    if (!existingChannel) {
        db.prepare("INSERT INTO channels (name, daily_caps, quota_used, quota_date) VALUES (?, 10, 0, date('now'))").run('channel1');
        console.log('  Created channel1');
    }
    const channelId = db.prepare('SELECT id FROM channels WHERE name = ?').get('channel1').id;

    if (!fs.existsSync(UPLOAD_STATE_PATH)) {
        console.warn(`⚠ Upload state file not found at ${UPLOAD_STATE_PATH}, skipping`);
        return;
    }
    
    const uploadState = JSON.parse(fs.readFileSync(UPLOAD_STATE_PATH, 'utf-8'));
    console.log(`📊 Loading upload state with ${Object.keys(uploadState).length} entries`);
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO ledger_entries (dua_id, channel_id, action, meta, ts)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    let imported = 0;
    
    for (const [duaSlug, entry] of Object.entries(uploadState)) {
        try {
            // Convert slug: add prefix, replace _ with -
            const normalizedSlug = 'dua-' + duaSlug.replace(/_/g, '-');
            const duaRow = db.prepare('SELECT id FROM duas WHERE slug = ?').get(normalizedSlug);
            if (!duaRow) continue;
            const duaIdNum = duaRow.id;
            const meta = JSON.stringify({ status: entry.status, video_id: entry.video_id, privacy: entry.privacy, locked: entry.locked, units_spent: entry.units_spent, uploaded_at: entry.uploaded_at });
            stmt.run(duaIdNum, channelId, 'upload', meta, entry.uploaded_at || new Date().toISOString());
            imported++;
        } catch (e) { /* skip */ }
    }
    
    console.log(`✓ Imported ${imported} upload ledger entries`);
}

// Import shorts_state_channel1.json
function importShortsState(db) {
    if (!fs.existsSync(SHORTS_STATE_PATH)) {
        console.warn(`⚠ Shorts state file not found at ${SHORTS_STATE_PATH}, skipping`);
        return;
    }
    
    const shortsState = JSON.parse(fs.readFileSync(SHORTS_STATE_PATH, 'utf-8'));
    console.log(`📊 Loading shorts state with ${Object.keys(shortsState).length} entries`);
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO ledger_entries (dua_id, channel_id, action, meta, ts)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    let imported = 0;
    const channelId = db.prepare('SELECT id FROM channels WHERE name = ?').get('channel1').id;
    
    for (const [duaSlug, entry] of Object.entries(shortsState)) {
        try {
            const normalizedSlug = 'dua-' + duaSlug.replace(/_/g, '-');
            const duaRow = db.prepare('SELECT id FROM duas WHERE slug = ?').get(normalizedSlug);
            if (!duaRow) continue;
            const duaIdNum = duaRow.id;
            const meta = JSON.stringify({ shortHref: entry.shortHref, title: entry.title, duration: entry.duration, sizeMB: entry.sizeMB, video_id: entry.video_id, privacy: entry.privacy, uploaded_at: entry.uploaded_at });
            stmt.run(duaIdNum, channelId, 'upload', meta, entry.uploaded_at || new Date().toISOString());
            imported++;
        } catch (e) { /* skip */ }
    }
    
    console.log(`✓ Imported ${imported} shorts ledger entries`);
}

// Import en_review.json
function importEnReview(db) {
    if (!fs.existsSync(EN_REVIEW_PATH)) {
        console.warn(`⚠ En review file not found at ${EN_REVIEW_PATH}, skipping`);
        return;
    }
    
    const enReview = JSON.parse(fs.readFileSync(EN_REVIEW_PATH, 'utf-8'));
    console.log(`📝 Loading en review with ${Object.keys(enReview).length} entries`);
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO review (video_id, kind, status, note, edited_text)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    let imported = 0;
    
    for (const [duaSlug, entry] of Object.entries(enReview)) {
        try {
            if (duaSlug === '_comment') continue;
            const normalizedSlug = 'dua-' + duaSlug.replace(/_/g, '-');
            const duaRow = db.prepare('SELECT id FROM duas WHERE slug = ?').get(normalizedSlug);
            if (!duaRow) continue;
            // Find the video for this dua (if it exists)
            const videoRow = db.prepare('SELECT id FROM videos WHERE dua_id = ?').get(duaRow.id);
            if (!videoRow) continue; // skip — no video yet for this dua
            stmt.run(videoRow.id, 'en', entry.status, entry.note || null, null);
            imported++;
        } catch (e) { /* skip */ }
    }
    
    console.log(`✓ Imported ${imported} review entries`);
}

// Import quota_state_channel1.json
function importQuotaState(db) {
    if (!fs.existsSync(QUOTA_STATE_PATH)) {
        console.warn(`⚠ Quota state file not found at ${QUOTA_STATE_PATH}, skipping`);
        return;
    }
    
    const quotaState = JSON.parse(fs.readFileSync(QUOTA_STATE_PATH, 'utf-8'));
    console.log(`⏱ Loading quota state with ${Object.keys(quotaState).length} entries`);
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES (?, ?)
    `);
    
    for (const [date, units] of Object.entries(quotaState)) {
        try {
            stmt.run(`quota_used_${date}`, `${units}`);
        } catch (e) {
            // console.warn(`Error importing quota for date ${date}: ${e.message}`);
        }
    }
    
    console.log(`✓ Imported ${Object.keys(quotaState).length} quota entries`);
}

// Main function
function main() {
    console.log('=== V2 Legacy Import Script ===\n');
    
    // Step 1: Backup existing DB
    backupDb();
    
    // Step 2: Initialize database with schema
    const db = initDb();
    
    // Step 3: Import each data source
    console.log('\n--- Importing Douas ---');
    importDuas(db);
    
    console.log('\n--- Importing Upload State ---');
    importUploadState(db);
    
    console.log('\n--- Importing Shorts State ---');
    importShortsState(db);
    
    console.log('\n--- Importing En Review ---');
    importEnReview(db);
    
    console.log('\n--- Importing Quota State ---');
    importQuotaState(db);
    
    // Step 4: Verify counts
    console.log('\n=== Verification ===');
    const duaCount = db.prepare('SELECT COUNT(*) as count FROM duas').get().count;
    const ledgerCount = db.prepare('SELECT COUNT(*) as count FROM ledger_entries').get().count;
    const reviewCount = db.prepare('SELECT COUNT(*) as count FROM review').get().count;
    
    console.log(`📊 Douas in DB: ${duaCount}`);
    console.log(`📊 Ledger entries: ${ledgerCount}`);
    console.log(`📊 Review entries: ${reviewCount}`);
    
    // Check against expected counts from PORTAL_REFERENCE.md
    console.log('\n--- Expected vs Actual ---');
    console.log('Douas: Expected 114, Got: ' + duaCount + (duaCount === 114 ? ' ✓' : ' ✗'));
    console.log('Ledger entries: Will vary based on prod data');
    console.log('Review entries: Will vary based on prod data');
    
    db.close();
    console.log('\n=== Import Complete ===');
}

main();