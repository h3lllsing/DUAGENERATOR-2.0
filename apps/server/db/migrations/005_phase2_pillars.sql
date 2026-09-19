-- V2 Phase 2 Completion Migration 005: categorize the 43 'general' duas
-- Owner directive (V2_GOALS.md Phase 2 DoD): "kill the 43 general dupes into real theme buckets".
-- Buckets reuse the categories.json pillar taxonomy (occasions covers rain/moon/grave/etiquette/life events).
UPDATE duas SET category = 'occasions'     WHERE id IN (16,24,27,37,48,55,56,60,64,76,85,89,90,100,101,106,108,110);
UPDATE duas SET category = 'guidance'      WHERE id IN (18,47,49,51,57,59,63,65,73,74,75,87,88);
UPDATE duas SET category = 'family'        WHERE id IN (52,78,79,91);
UPDATE duas SET category = 'anxiety_relief' WHERE id IN (71,86,114);
UPDATE duas SET category = 'gratitude'     WHERE id IN (26,94);
UPDATE duas SET category = 'health'        WHERE id IN (72);
UPDATE duas SET category = 'protection'    WHERE id IN (92);
UPDATE duas SET category = 'forgiveness'   WHERE id IN (77);