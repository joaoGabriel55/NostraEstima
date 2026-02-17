import { randomUUID } from "node:crypto";

const RoomRepository = (database, membersRepository) => {
  const insertRoomStmt = database.prepare(`
    INSERT INTO rooms (id, task_title, task_description, admin_token, admin_name, revealed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const selectRoomStmt = database.prepare("SELECT * FROM rooms WHERE id = ?");

  const updateRoomRevealedStmt = database.prepare(`
    UPDATE rooms SET revealed = ?, updated_at = unixepoch() WHERE id = ?
  `);

  const deleteRoomStmt = database.prepare("DELETE FROM rooms WHERE id = ?");

  const selectExpiredRoomsStmt = database.prepare(`
    SELECT id FROM rooms WHERE created_at < ?
  `);

  function createRoom({ taskTitle, taskDescription, adminToken, adminName }) {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    insertRoomStmt.run(
      id,
      taskTitle,
      taskDescription || null,
      adminToken,
      adminName,
      0,
      now,
      now,
    );

    return {
      id,
      taskTitle,
      taskDescription: taskDescription || null,
      adminToken,
      adminName,
      revealed: false,
      createdAt: now * 1000, // Convert back to milliseconds for compatibility
      members: [],
    };
  }

  /**
   * Get a room by ID with its members
   */
  function getRoom(roomId) {
    const room = selectRoomStmt.get(roomId);
    if (!room) return null;

    const members = membersRepository.getMembersByRoom(roomId);

    return {
      id: room.id,
      taskTitle: room.task_title,
      taskDescription: room.task_description,
      adminToken: room.admin_token,
      adminName: room.admin_name,
      revealed: Boolean(room.revealed),
      createdAt: room.created_at * 1000, // Convert to milliseconds
      members,
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
    membersRepository.deleteMembersByRoom(roomId);
    deleteRoomStmt.run(roomId);
  }

  /**
   * Get all expired rooms (older than specified milliseconds)
   */
  function getExpiredRooms(maxAgeMs) {
    const cutoffTime = Math.floor((Date.now() - maxAgeMs) / 1000);
    return selectExpiredRoomsStmt.all(cutoffTime).map((r) => r.id);
  }

  function roomExists(roomId) {
    const room = selectRoomStmt.get(roomId);
    return room !== undefined;
  }

  return {
    createRoom,
    getRoom,
    setRoomRevealed,
    deleteRoom,
    getExpiredRooms,
    roomExists,
  };
};

export default RoomRepository;
