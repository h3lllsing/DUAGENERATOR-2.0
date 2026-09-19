import type Database from 'better-sqlite3';

export function suggestTopics(db: Database.Database, limit = 10): any[] {
  const counts = db.prepare(`
    SELECT lower(substr(title, 1, 40)) as word, COUNT(*) as c, GROUP_CONCAT(DISTINCT category) as cats
    FROM duas WHERE status IN ('draft','qc_passed','en_review','approved','published')
    GROUP BY word ORDER BY c DESC LIMIT 40
  `).all() as any[];

  const found = new Set();
  const suggestions: any[] = [];

  const sourceRows = db.prepare('SELECT source, COUNT(*) as c FROM duas GROUP BY source ORDER BY c DESC').all() as any[];
  for (const s of sourceRows) {
    if (!s.source || s.source === 'unknown') continue;
    const kw = s.source.replace(/_/g, ' ');
    if (!found.has(kw) && suggestions.length < limit) {
      found.add(kw);
      suggestions.push({ keyword: kw, source: 'suggest', comp_count: s.c, related_dua_id: null, matched_by: 'source' });
    }
  }

  const catRows = db.prepare('SELECT category, COUNT(*) as c FROM duas WHERE category IS NOT NULL GROUP BY category ORDER BY c DESC').all() as any[];
  for (const c of catRows) {
    if (!found.has(c.category) && suggestions.length < limit) {
      found.add(c.category);
      suggestions.push({ keyword: c.category, source: 'suggest', comp_count: c.c, related_dua_id: null, matched_by: 'category' });
    }
  }

  for (const w of counts) {
    if (!w.word || w.word.trim().length < 3 || found.has(w.word)) continue;
    if (suggestions.length >= limit) break;
    found.add(w.word);
    suggestions.push({ keyword: w.word, source: 'suggest', comp_count: w.c, related_dua_id: null, matched_by: 'keyword' });
  }

  return suggestions;
}

export function addTopic(db: Database.Database, keyword: string, source = 'manual'): any {
  const kw = keyword.trim();
  if (!kw) throw new Error('Keyword required');
  const existing = db.prepare('SELECT * FROM topics WHERE keyword = ?').get(kw) as any;
  if (existing) return existing;
  const matches = db.prepare(
    "SELECT COUNT(*) as c, MAX(id) as mid FROM duas WHERE title LIKE ? OR category LIKE ? OR urdu LIKE ?"
  ).get('%' + kw + '%', '%' + kw + '%', '%' + kw + '%') as any;
  const res = db.prepare('INSERT INTO topics (keyword, source, comp_count, related_dua_id) VALUES (?, ?, ?, ?)')
    .run(kw, source, matches?.c || 0, matches?.mid || null);
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(res.lastInsertRowid);
}

export function addSuggestedTopics(db: Database.Database, suggestions: any[]): { added: number; existing: number } {
  let added = 0;
  let existing = 0;
  const get = db.prepare('SELECT id FROM topics WHERE keyword = ?');
  const add = db.prepare('INSERT INTO topics (keyword, source, comp_count, related_dua_id) VALUES (?, ?, ?, ?)');
  for (const s of suggestions) {
    if (!s.keyword) continue;
    const row = get.get(s.keyword) as any;
    if (row) { existing++; continue; }
    add.run(s.keyword, s.source || 'suggest', s.comp_count || 0, s.related_dua_id || null);
    added++;
  }
  return { added, existing };
}

export function setTopicStatus(db: Database.Database, id: number, status: string): any {
  if (!['pending', 'progress', 'done', 'ignored'].includes(status)) throw new Error('Invalid status');
  db.prepare('UPDATE topics SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
}

export function listTopics(db: Database.Database, status?: string): any[] {
  const params: any[] = [];
  let where = '';
  if (status) { where = ' WHERE status = ?'; params.push(status); }
  return db.prepare('SELECT * FROM topics' + where + ' ORDER BY created_at DESC').all(...params) as any[];
}