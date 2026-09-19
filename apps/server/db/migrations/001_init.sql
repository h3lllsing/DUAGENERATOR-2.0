-- V2 Phase 1 Migration 001: Initial schema
-- Migrates legacy JSON data (duas.json, upload_state, shorts_state, en_review, quota_state)
-- into SQLite single-file database `data/v2.db`

-- Douas table (replaces duplicated JSON + ledger structure)
CREATE TABLE IF NOT EXISTS duas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_en TEXT,
    urdu TEXT,
    arabic TEXT,
    english TEXT,
    explanation TEXT,
    reference TEXT NOT NULL,  -- hadith collection + reference
    category TEXT,
    part TEXT,
    status TEXT CHECK(status IN ('draft', 'qc_passed', 'en_review', 'approved', 'published')) DEFAULT 'draft',
    source TEXT,  -- Bukhari/Muslim/Tirmidhi/Abu Dawud/Nasa'i/Ibn Majah
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Videos table (replaces legacy video pipeline)
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dua_id INTEGER NOT NULL,
    kind TEXT CHECK(kind IN ('short', 'long')) NOT NULL DEFAULT 'long',
    video_id TEXT,  -- YouTube video ID when published
    state TEXT CHECK(state IN ('not_started', 'rendered', 'uploaded')) DEFAULT 'not_started',
    render_files JSON,  -- paths to mp4, thumbs, srt, metadata
    published_at TEXT,
    schedule_at TEXT,
    FOREIGN KEY (dua_id) REFERENCES duas(id) ON DELETE CASCADE
);

-- Channels table (replaces single-channel config)
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'channel1',
    token_ref TEXT,  -- reference to token file/key
    default_privacy TEXT CHECK(default_privacy IN ('public', 'private', 'unlisted')) DEFAULT 'private',
    daily_caps INTEGER DEFAULT 10,
    quota_used INTEGER DEFAULT 0,
    quota_date TEXT DEFAULT (date('now')),
    UNIQUE(name)
);

-- Ledger entries table (replaces upload_state + shorts_state)
-- Records every upload attempt with full truth
CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    dua_id INTEGER NOT NULL,
    video_yid TEXT,  -- YouTube video ID
    action TEXT NOT NULL,  -- 'upload', 'retry', 'cancel'
    meta JSON,  -- any extra metadata (privacy, units, etc.)
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (dua_id) REFERENCES duas(id)
);

-- Review table (replaces en_review.json with edit-in-place)
CREATE TABLE IF NOT EXISTS review (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    kind TEXT CHECK(kind IN ('en', 'caption', 'thumb')) NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    note TEXT,
    reviewer TEXT,
    edited_text TEXT,  -- edit-in-place content
    ts_created TEXT DEFAULT (datetime('now')),
    ts_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(video_id, kind)
);

-- Jobs table (single render worker queue, replaces JS queue + Python batch)
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    type TEXT NOT NULL,  -- 'render', 'qc', 'upload', 'seo'
    state TEXT CHECK(state IN ('queued', 'prep', 'render', 'qc', 'pass', 'retry', 'done', 'failed')) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,  -- 0-100
    payload JSON,  -- job-specific data (dua_id, config, etc.)
    worker TEXT,  -- which worker process
    created_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    error TEXT,
    UNIQUE(video_id, type)
);

-- Analytics cache (nightly refresh)
CREATE TABLE IF NOT EXISTS analytics_cache (
    video_yid TEXT NOT NULL,
    day TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    retention REAL DEFAULT 0,  -- % at 3s
    ts TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (video_yid, day)
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER,
    publish_at TEXT NOT NULL,
    channel_id INTEGER,
    status TEXT CHECK(status IN ('pending', 'scheduled', 'published', 'failed')) DEFAULT 'pending',
    FOREIGN KEY (video_id) REFERENCES videos(id),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
);

-- Audit log for all mutations
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    old_value JSON,
    new_value JSON,
    user TEXT,  -- system or user who performed action
    ts TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_duas_slug ON duas(slug);
CREATE INDEX IF NOT EXISTS idx_duas_status ON duas(status);
CREATE INDEX IF NOT EXISTS idx_videos_dua_id ON videos(dua_id);
CREATE INDEX IF NOT EXISTS idx_videos_state ON videos(state);
CREATE INDEX IF NOT EXISTS idx_ledger_dua_id ON ledger_entries(dua_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ts ON ledger_entries(ts);
CREATE INDEX IF NOT EXISTS idx_review_video_id ON review(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_schedules_publish_at ON schedules(publish_at);
CREATE INDEX IF NOT EXISTS idx_analytics_cache ON analytics_cache(video_yid, day);

-- View for active jobs
CREATE VIEW IF NOT EXISTS active_jobs AS SELECT * FROM jobs WHERE state IN ('queued', 'prep', 'render', 'qc', 'retry');

-- View for channel quota status
CREATE VIEW IF NOT EXISTS quota_status AS
SELECT 
    c.name,
    c.daily_caps,
    0 as uploads_today,
    0 as uploads_used,
    0 as quota_pct
FROM channels c;