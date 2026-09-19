import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run all migrations in order
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of migrationFiles) {
    const schema = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(schema);
  }
  return db;
}
