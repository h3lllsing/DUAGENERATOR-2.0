import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'db', 'migrations', '001_init.sql');

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  return db;
}
