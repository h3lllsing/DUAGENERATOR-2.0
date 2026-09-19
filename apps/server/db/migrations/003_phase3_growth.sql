-- V2 Phase 3 Migration 003: Growth Engine
-- Scheduler extensions, playlists, topics queue, share-kit support.

-- Extend schedules for ops tracking
ALTER TABLE schedules ADD COLUMN note TEXT DEFAULT NULL;
ALTER TABLE schedules ADD COLUMN job_id INTEGER DEFAULT NULL;
ALTER TABLE schedules ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE schedules ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- Playlists (replaces playlist_plan_channel1.json)
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    channel_id INTEGER,
    member_count INTEGER DEFAULT 0,
    added_count INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('draft', 'active', 'done')) DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
);

-- Playlist members (one row per dua in a playlist)
CREATE TABLE IF NOT EXISTS playlist_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    dua_id INTEGER,
    dua_slug TEXT NOT NULL,
    video_yid TEXT,
    title TEXT,
    status TEXT CHECK(status IN ('pending', 'added', 'skipped')) DEFAULT 'pending',
    added_at TEXT,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (dua_id) REFERENCES duas(id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_members_playlist ON playlist_members(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_members_dua ON playlist_members(dua_id);

-- Topics queue (trend radar)
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'manual',
    status TEXT CHECK(status IN ('pending', 'progress', 'done', 'ignored')) DEFAULT 'pending',
    comp_count INTEGER DEFAULT 0,
    related_dua_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);

-- Settings defaults for growth engine
INSERT OR IGNORE INTO settings (key, value) VALUES ('analytics_threshold_views', '100');
INSERT OR IGNORE INTO settings (key, value) VALUES ('publish_interval_sec', '15');