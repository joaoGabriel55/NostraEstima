import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

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
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

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

// ============== Room Operations ==============

const insertRoomStmt = database.prepare(`
  INSERT INTO rooms (id, task_title, task_description, admin_token, admin_name, revealed, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectRoomStmt = database.prepare(`
  SELECT * FROM rooms WHERE id = ?
`);

const updateRoomRevealedStmt = database.prepare(`
  UPDATE rooms SET revealed = ?, updated_at = unixepoch() WHERE id = ?
`);

const deleteRoomStmt = database.prepare(`
  DELETE FROM rooms WHERE id = ?
`);

const selectExpiredRoomsStmt = database.prepare(`
  SELECT id FROM rooms WHERE created_at < ?
`);

// ============== Room Member Operations ==============

const insertMemberStmt = database.prepare(`
  INSERT INTO room_members (id, room_id, session_id, socket_id, name, point, connected, joined_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectMembersByRoomStmt = database.prepare(`
  SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC
`);

const selectMemberBySessionStmt = database.prepare(`
  SELECT * FROM room_members WHERE room_id = ? AND session_id = ?
`);

const selectMemberByNameStmt = database.prepare(`
  SELECT * FROM room_members WHERE room_id = ? AND name = ?
`);

const selectMemberBySocketStmt = database.prepare(`
  SELECT * FROM room_members WHERE room_id = ? AND socket_id = ?
`);

const updateMemberPointStmt = database.prepare(`
  UPDATE room_members SET point = ? WHERE id = ?
`);

const updateMemberConnectionStmt = database.prepare(`
  UPDATE room_members SET socket_id = ?, connected = ? WHERE id = ?
`);

const updateMemberSocketStmt = database.prepare(`
  UPDATE room_members SET socket_id = ?, session_id = ?, connected = ? WHERE id = ?
`);

const resetAllMemberPointsStmt = database.prepare(`
  UPDATE room_members SET point = NULL WHERE room_id = ?
`);

const deleteMemberStmt = database.prepare(`
  DELETE FROM room_members WHERE id = ?
`);

const deleteMembersByRoomStmt = database.prepare(`
  DELETE FROM room_members WHERE room_id = ?
`);

const countConnectedMembersStmt = database.prepare(`
  SELECT COUNT(*) as count FROM room_members WHERE room_id = ? AND connected = 1
`);

const countMembersStmt = database.prepare(`
  SELECT COUNT(*) as count FROM room_members WHERE room_id = ?
`);

// ============== Room Functions ==============

/**
 * Create a new room
 */
function createRoom({ taskTitle, taskDescription, adminToken, adminName }) {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  
  insertRoomStmt.run(id, taskTitle, taskDescription || null, adminToken, adminName, 0, now, now);
  
  return {
    id,
    taskTitle,
    taskDescription: taskDescription || null,
    adminToken,
    adminName,
    revealed: false,
    createdAt: now * 1000, // Convert back to milliseconds for compatibility
    members: []
  };
}

/**
 * Get a room by ID with its members
 */
function getRoom(roomId) {
  const room = selectRoomStmt.get(roomId);
  if (!room) return null;
  
  const members = selectMembersByRoomStmt.all(roomId);
  
  return {
    id: room.id,
    taskTitle: room.task_title,
    taskDescription: room.task_description,
    adminToken: room.admin_token,
    adminName: room.admin_name,
    revealed: Boolean(room.revealed),
    createdAt: room.created_at * 1000, // Convert to milliseconds
    members: members.map(m => ({
      id: m.id,
      sessionId: m.session_id,
      socketId: m.socket_id,
      name: m.name,
      point: m.point !== null ? (isNaN(Number(m.point)) ? m.point : Number(m.point)) : null,
      connected: Boolean(m.connected),
      joinedAt: m.joined_at * 1000
    }))
  };
}

/**
 * Update room revealed status
 */
function setRoomRevealed(roomId, revealed) {
  updateRoomRevealedStmt.run(revealed ? 1 : 0, roomId);
}

/**
 * Delete a room and all its members
 */
function deleteRoom(roomId) {
  // Members are deleted via CASCADE
  deleteRoomStmt.run(roomId);
}

/**
 * Get all expired rooms (older than specified milliseconds)
 */
function getExpiredRooms(maxAgeMs) {
  const cutoffTime = Math.floor((Date.now() - maxAgeMs) / 1000);
  return selectExpiredRoomsStmt.all(cutoffTime).map(r => r.id);
}

// ============== Member Functions ==============

/**
 * Add a member to a room
 */
function addMember(roomId, { sessionId, socketId, name, point = null, connected = true }) {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  
  try {
    insertMemberStmt.run(id, roomId, sessionId || null, socketId || null, name, point !== null ? String(point) : null, connected ? 1 : 0, now);
    
    return {
      id,
      sessionId,
      socketId,
      name,
      point,
      connected,
      joinedAt: now * 1000
    };
  } catch (error) {
    // Handle unique constraint violation (member with same name already exists)
    if (error.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}

/**
 * Find a member by session ID
 */
function getMemberBySession(roomId, sessionId) {
  const member = selectMemberBySessionStmt.get(roomId, sessionId);
  if (!member) return null;
  
  return {
    id: member.id,
    sessionId: member.session_id,
    socketId: member.socket_id,
    name: member.name,
    point: member.point !== null ? (isNaN(Number(member.point)) ? member.point : Number(member.point)) : null,
    connected: Boolean(member.connected),
    joinedAt: member.joined_at * 1000
  };
}

/**
 * Find a member by name
 */
function getMemberByName(roomId, name) {
  const member = selectMemberByNameStmt.get(roomId, name);
  if (!member) return null;
  
  return {
    id: member.id,
    sessionId: member.session_id,
    socketId: member.socket_id,
    name: member.name,
    point: member.point !== null ? (isNaN(Number(member.point)) ? member.point : Number(member.point)) : null,
    connected: Boolean(member.connected),
    joinedAt: member.joined_at * 1000
  };
}

/**
 * Find a member by socket ID
 */
function getMemberBySocket(roomId, socketId) {
  const member = selectMemberBySocketStmt.get(roomId, socketId);
  if (!member) return null;
  
  return {
    id: member.id,
    sessionId: member.session_id,
    socketId: member.socket_id,
    name: member.name,
    point: member.point !== null ? (isNaN(Number(member.point)) ? member.point : Number(member.point)) : null,
    connected: Boolean(member.connected),
    joinedAt: member.joined_at * 1000
  };
}

/**
 * Update member's vote
 */
function updateMemberPoint(memberId, point) {
  updateMemberPointStmt.run(point !== null ? String(point) : null, memberId);
}

/**
 * Update member's connection status
 */
function updateMemberConnection(memberId, socketId, connected) {
  updateMemberConnectionStmt.run(socketId, connected ? 1 : 0, memberId);
}

/**
 * Update member's socket and session info (for reconnection)
 */
function updateMemberSocket(memberId, socketId, sessionId, connected) {
  updateMemberSocketStmt.run(socketId, sessionId, connected ? 1 : 0, memberId);
}

/**
 * Reset all member points in a room
 */
function resetAllMemberPoints(roomId) {
  resetAllMemberPointsStmt.run(roomId);
}

/**
 * Delete a member
 */
function deleteMember(memberId) {
  deleteMemberStmt.run(memberId);
}

/**
 * Get count of connected members in a room
 */
function getConnectedMemberCount(roomId) {
  const result = countConnectedMembersStmt.get(roomId);
  return result ? result.count : 0;
}

/**
 * Get total member count in a room
 */
function getMemberCount(roomId) {
  const result = countMembersStmt.get(roomId);
  return result ? result.count : 0;
}

/**
 * Check if room exists
 */
function roomExists(roomId) {
  const room = selectRoomStmt.get(roomId);
  return room !== undefined;
}

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

export const db = {
  // Room operations
  createRoom,
  getRoom,
  setRoomRevealed,
  deleteRoom,
  getExpiredRooms,
  roomExists,
  
  // Member operations
  addMember,
  getMemberBySession,
  getMemberByName,
  getMemberBySocket,
  updateMemberPoint,
  updateMemberConnection,
  updateMemberSocket,
  resetAllMemberPoints,
  deleteMember,
  getConnectedMemberCount,
  getMemberCount,
};