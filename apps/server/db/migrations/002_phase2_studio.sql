-- V2 Phase 2 Migration 002: Content Studio columns
-- Adds thumbnail, caption, SEO, and approval workflow columns to videos table.

-- First drop the old CHECK constraint on state (SQLite doesn't support ALTER CHECK)
-- We'll recreate the table with the correct constraint
CREATE TABLE IF NOT EXISTS videos_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dua_id INTEGER NOT NULL,
    kind TEXT CHECK(kind IN ('short', 'long')) NOT NULL DEFAULT 'long',
    video_id TEXT,
    state TEXT CHECK(state IN ('not_started', 'draft', 'qc_passed', 'en_review', 'approved', 'published', 'rendered', 'uploaded')) DEFAULT 'not_started',
    render_files JSON,
    thumbs JSON DEFAULT NULL,
    caption_en TEXT DEFAULT NULL,
    seo_title TEXT DEFAULT NULL,
    seo_description TEXT DEFAULT NULL,
    seo_tags JSON DEFAULT NULL,
    seo_hashtags JSON DEFAULT NULL,
    approved_by TEXT DEFAULT NULL,
    approved_at TEXT DEFAULT NULL,
    published_at TEXT,
    schedule_at TEXT,
    FOREIGN KEY (dua_id) REFERENCES duas(id) ON DELETE CASCADE
);

INSERT INTO videos_new (id, dua_id, kind, video_id, state, render_files, published_at, schedule_at)
SELECT id, dua_id, kind, video_id, state, render_files, published_at, schedule_at FROM videos;

DROP TABLE IF EXISTS videos;
ALTER TABLE videos_new RENAME TO videos;

-- Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_videos_dua_id ON videos(dua_id);
CREATE INDEX IF NOT EXISTS idx_videos_state ON videos(state);
CREATE INDEX IF NOT EXISTS idx_review_status ON review(status);
