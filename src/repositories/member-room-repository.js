import { randomUUID } from "node:crypto";

const MemberRoomRepository = (database) => {
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

  /**
   * Helper to format member data consistently.
   */
  function formatMember(member) {
    if (!member) return null;
    return {
      id: member.id,
      sessionId: member.session_id,
      socketId: member.socket_id,
      name: member.name,
      point:
        member.point !== null
          ? isNaN(Number(member.point))
            ? member.point
            : Number(member.point)
          : null,
      connected: Boolean(member.connected),
      joinedAt: member.joined_at * 1000,
    };
  }

  /**
   * Add a member to a room
   */
  function addMember(
    roomId,
    { sessionId, socketId, name, point = null, connected = true },
  ) {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    try {
      insertMemberStmt.run(
        id,
        roomId,
        sessionId || null,
        socketId || null,
        name,
        point !== null ? String(point) : null,
        connected ? 1 : 0,
        now,
      );

      return formatMember({
        id,
        session_id: sessionId,
        socket_id: socketId,
        name,
        point,
        connected,
        joined_at: now,
      });
    } catch (error) {
      // Handle unique constraint violation (member with same name already exists)
      if (error.message.includes("UNIQUE constraint failed")) {
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
    return formatMember(member);
  }

  /**
   * Find a member by name
   */
  function getMemberByName(roomId, name) {
    const member = selectMemberByNameStmt.get(roomId, name);
    return formatMember(member);
  }

  /**
   * Find a member by socket ID
   */
  function getMemberBySocket(roomId, socketId) {
    const member = selectMemberBySocketStmt.get(roomId, socketId);
    return formatMember(member);
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
    updateMemberSocketStmt.run(
      socketId,
      sessionId,
      connected ? 1 : 0,
      memberId,
    );
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
   * Delete all members in a room
   */
  function deleteMembersByRoom(roomId) {
    deleteMembersByRoomStmt.run(roomId);
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
   * Get all members for a given room.
   */
  function getMembersByRoom(roomId) {
    const members = selectMembersByRoomStmt.all(roomId);
    return members.map(formatMember);
  }

  return {
    addMember,
    getMemberBySession,
    getMemberByName,
    getMemberBySocket,
    updateMemberPoint,
    updateMemberConnection,
    updateMemberSocket,
    resetAllMemberPoints,
    deleteMember,
    deleteMembersByRoom,
    getConnectedMemberCount,
    getMemberCount,
    getMembersByRoom,
  };
};

export default MemberRoomRepository;
