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
    expiresAt: getRoomExpiresAt(room),
    extended: (room.extensionMs || 0) > 0,
    average: room.revealed ? getRoomAverage(room) : null,
  };
}

// When the room closes, in milliseconds since the epoch
export function getRoomExpiresAt(room) {
  return room.createdAt + ROOM_DURATION_MS + (room.extensionMs || 0);
}

// Average of the numeric votes, to one decimal, or null when nobody voted
export function getRoomAverage(room) {
  const numericVotes = room.members
    .filter((m) => m.point !== null && typeof m.point === "number")
    .map((m) => m.point);

  return numericVotes.length > 0
    ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
    : null;
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
  return Date.now() > getRoomExpiresAt(room);
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape free text and turn http(s) URLs into links that open in a new tab.
// The result is safe to print unescaped in a view.
export function linkify(text) {
  if (!text) return "";
  const source = String(text);
  let html = "";
  let lastIndex = 0;
  for (const match of source.matchAll(URL_PATTERN)) {
    html += escapeHtml(source.slice(lastIndex, match.index));
    const url = escapeHtml(match[0]);
    html += `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    lastIndex = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(lastIndex));
}
