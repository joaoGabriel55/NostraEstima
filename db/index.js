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

// Enable WAL mode for better concurrent access performance
database.exec("PRAGMA journal_mode = WAL");
database.exec("PRAGMA synchronous = NORMAL");
database.exec("PRAGMA foreign_keys = ON");

// Create the rooms table
database.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    task_title TEXT NOT NULL,
    task_description TEXT,
    admin_token TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    revealed INTEGER DEFAULT 0,
    extension_seconds INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

// Add columns introduced after the first release to existing databases.
// (There is no migration tool; each addition is guarded here instead.)
const roomColumns = database.prepare("PRAGMA table_info(rooms)").all();
if (!roomColumns.some((column) => column.name === "extension_seconds")) {
  database.exec(
    "ALTER TABLE rooms ADD COLUMN extension_seconds INTEGER NOT NULL DEFAULT 0",
  );
}

// Create the room_members table
database.exec(`
  CREATE TABLE IF NOT EXISTS room_members (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    session_id TEXT,
    socket_id TEXT,
    name TEXT NOT NULL,
    point TEXT,
    connected INTEGER DEFAULT 1,
    joined_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE(room_id, name)
  )
`);

// Create indexes for better query performance
database.exec(`
  CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
  CREATE INDEX IF NOT EXISTS idx_room_members_session_id ON room_members(session_id);
  CREATE INDEX IF NOT EXISTS idx_room_members_socket_id ON room_members(socket_id);
  CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
`);

// Track if database is already closed
let isClosed = false;

function closeDatabase() {
  if (!isClosed) {
    try {
      database.close();
      isClosed = true;
    } catch (error) {
      // Ignore errors if database is already closed
    }
  }
}

// Close database connection on process exit
process.on("exit", closeDatabase);

process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});

export default database;
