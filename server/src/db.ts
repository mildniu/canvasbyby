import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword } from './crypto.js';

export type Db = Database.Database;

export function openDb(dataDir: string): { db: Db; mediaDir: string } {
  const mediaDir = dataDir === ':memory:dir:' ? join('/tmp', `aigc-test-${process.pid}`) : join(dataDir, 'media');
  mkdirSync(mediaDir, { recursive: true });
  const dbFile = dataDir === ':memory:dir:' ? ':memory:' : join(dataDir, 'aigc.db');
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
      status INTEGER NOT NULL DEFAULT 1, -- 1 active, 0 disabled
      credits INTEGER NOT NULL DEFAULT 20, -- 用户积分余额，默认 20
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'admin',
      kind TEXT NOT NULL DEFAULT 'image',
      status TEXT NOT NULL DEFAULT 'pending',
      prompt TEXT NOT NULL,
      params_json TEXT NOT NULL DEFAULT '{}',
      result_path TEXT,
      error TEXT,
      credits_cost INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      done_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS inspirations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      category TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      cover_path TEXT,
      source TEXT DEFAULT '',
      likes INTEGER NOT NULL DEFAULT 0,
      is_own INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // 检查 tasks 表是否有 user_id 列，没有则迁移添加
  try {
    const info = db.pragma('table_info(tasks)') as any[];
    if (!info.some((col) => col.name === 'user_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT 'admin'`);
    }
    if (!info.some((col) => col.name === 'credits_cost')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN credits_cost INTEGER NOT NULL DEFAULT 0`);
    }
  } catch {}

  // 检查 users 表是否有 credits 列，没有则迁移添加
  try {
    const uInfo = db.pragma('table_info(users)') as any[];
    if (!uInfo.some((col) => col.name === 'credits')) {
      db.exec(`ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 20`);
    }
  } catch {}

  // 初始化默认 admin 用户
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const adminHash = hashPassword('woshiniu2');
    db.prepare('INSERT INTO users(id, username, password_hash, role, status, credits, created_at) VALUES(?,?,?,?,?,?,?)').run(
      'admin',
      'admin',
      adminHash,
      'admin',
      1,
      999999,
      Date.now()
    );
  }

  return { db, mediaDir };
}
