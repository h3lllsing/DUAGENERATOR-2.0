-- V2 Audit Fix Migration 004: distinguish soft-deleted duas from drafts
-- Fixes trash listing: trash currently shows every draft (delete+restore were no-ops).
ALTER TABLE duas ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_duas_deleted ON duas(deleted);