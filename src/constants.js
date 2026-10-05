export const MAX_ROOM_CAPACITY = 10;
export const DISCONNECT_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds grace period
export const ROOM_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const ROOM_EXTENSION_MS = 5 * 60 * 1000; // one facilitator extension
export const EXTEND_WINDOW_MS = 2 * 60 * 1000; // extension allowed in the last 2 minutes
export const MAX_ROOM_LIFETIME_MS = ROOM_DURATION_MS + ROOM_EXTENSION_MS;
export const DECK_VALUES = [0, 1, 2, 3, 5, 8, 13, 20, 40, 100];
export const MAX_NAME_LENGTH = 40;
