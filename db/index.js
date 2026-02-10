import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Database file path - use environment variable or default to local file
const DB_PATH = process.env.DATABASE_PATH || "./data/app.db";

// Ensure the directory exists
const dbDir = dirname(DB_PATH);
if (dbDir !== "." && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize the SQLite database
const database = new DatabaseSync(DB_PATH);

// Create the key-value store table if it doesn't exist
database.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

// Prepared statements for better performance
const insertStmt = database.prepare(`
  INSERT INTO kv_store (key, value, updated_at)
  VALUES (?, ?, unixepoch())
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = unixepoch()
`);

const selectStmt = database.prepare(`
  SELECT value FROM kv_store WHERE key = ?
`);

const deleteStmt = database.prepare(`
  DELETE FROM kv_store WHERE key = ?
`);

const existsStmt = database.prepare(`
  SELECT 1 FROM kv_store WHERE key = ? LIMIT 1
`);

const clearStmt = database.prepare(`
  DELETE FROM kv_store
`);

async function set(key, value) {
  insertStmt.run(key, value);
  return "OK";
}

async function get(key) {
  const row = selectStmt.get(key);
  return row ? row.value : null;
}

async function del(key) {
  const result = deleteStmt.run(key);
  return result.changes;
}

async function clear() {
  const result = clearStmt.run();
  return result.changes;
}

async function exists(key) {
  const row = existsStmt.get(key);
  return row ? 1 : 0;
}

// Close database connection on process exit
process.on("exit", () => {
  database.close();
});

process.on("SIGINT", () => {
  database.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  database.close();
  process.exit(0);
});

export const db = {
  set,
  get,
  del,
  clear,
  exists,
};
