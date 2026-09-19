import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'v2.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'apps', 'server', 'db', 'migrations');

let db: Database.Database | null = null;

function runMigrations(database: Database.Database): void {
  // Check if schema_migrations table exists
  const hasMigrations = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  if (!hasMigrations) {
    database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))");
  }

  const applied = database.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version);
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const version = file.replace('.sql', '');
    if (!applied.includes(version)) {
      console.log(`[DB] Applying migration ${version}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
      console.log(`[DB] Migration ${version} applied`);
    }
  }
}

export function initDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  console.log('[DB] Database ready');

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
