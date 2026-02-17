import { ROOM_DURATION_MS } from "./constants.js";

// Helper function to sanitize room data for clients
export function getSanitizedRoom(room) {
  return {
    id: room.id,
    taskTitle: room.taskTitle,
    taskDescription: room.taskDescription,
    members: getSanitizedMembers(room),
    revealed: room.revealed,
    adminName: room.adminName,
  };
}

// Helper function to sanitize members (hide votes if not revealed)
export function getSanitizedMembers(room) {
  return room.members.map((m) => ({
    name: m.name,
    hasVoted: m.point !== null,
    point: room.revealed ? m.point : null,
    connected: m.connected,
  }));
}

// Check if a room is expired
export function isRoomExpired(room) {
  return Date.now() - room.createdAt > ROOM_DURATION_MS;
}
