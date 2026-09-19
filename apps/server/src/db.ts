import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'v2.db');
const SCHEMA_PATH = path.resolve(process.cwd(), 'apps', 'server', 'db', 'migrations', '001_init.sql');

let db: Database.Database | null = null;

export function initDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='duas'").get();
  if (!tableCheck) {
    console.log('[DB] Initializing schema...');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
    console.log('[DB] Schema initialized');
  } else {
    console.log('[DB] Schema already exists');
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Connection closed');
  }
}

export function backupDb(): string {
  const backupDir = path.join(DB_DIR, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, 'v2_' + timestamp + '.sqlite');
  if (db) db.backup(backupPath);
  console.log('[DB] Backup created:', backupPath);
  return backupPath;
}

export function selectAll(sql: string, params: any[] = []): any[] {
  return getDb().prepare(sql).all(...params);
}

export function selectOne(sql: string, params: any[] = []): any | null {
  return getDb().prepare(sql).get(...params) || null;
}

export function run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  const result = getDb().prepare(sql).run(...params);
  return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
}
