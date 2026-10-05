import { randomUUID } from "crypto";
import { MAX_NAME_LENGTH, MAX_ROOM_CAPACITY } from "../constants.js";
import { getRoomExpiresAt, isRoomExpired } from "../helpers.js";

const PlayController = (roomRepository, membersRepository) => ({
  index: (_, res) => {
    res.redirect("/play");
  },
  new: (_, res) => {
    res.render("new", { layout: "layout" });
  },
  show: async (req, res) => {
    const roomId = req.params.id;
    const room = roomRepository.getRoom(roomId);

    if (!room) {
      res.redirect("/play");
      return;
    }

    // Check if room is expired
    if (isRoomExpired(room)) {
      roomRepository.deleteRoom(roomId);
      console.log(`Room ${roomId} expired and deleted on access.`);
      res.redirect("/play");
      return;
    }

    const userSession = req.session.rooms?.[roomId];

    // Debug logging
    console.log(`[GET /play/${roomId}] Session ID: ${req.session.id}`);
    console.log(`[GET /play/${roomId}] User session for room:`, userSession);

    // If user has no session for this room, show join page
    if (!userSession) {
      res.render("join", {
        layout: "layout",
        room,
      });
      return;
    }

    // User has a session - show the room
    const roomUrl = `${req.protocol}://${req.get("host")}/play/${roomId}`;
    res.render("room", {
      layout: "layout",
      room,
      userSession,
      roomUrl,
      remainingMs: Math.max(0, getRoomExpiresAt(room) - Date.now()),
    });
  },
  join: async (req, res) => {
    const roomId = req.params.id;
    const room = roomRepository.getRoom(roomId);

    if (!room) {
      res.redirect("/play");
      return;
    }

    // Check if room is expired
    if (isRoomExpired(room)) {
      roomRepository.deleteRoom(roomId);
      console.log(`Room ${roomId} expired and deleted on access.`);
      res.redirect("/play");
      return;
    }

    const name = req.body.name?.trim();

    if (!name) {
      res.render("join", {
        layout: "layout",
        room,
        error: "Please enter your name.",
      });
      return;
    }

    if (name.length > MAX_NAME_LENGTH) {
      res.render("join", {
        layout: "layout",
        room,
        error: `Keep your name to ${MAX_NAME_LENGTH} characters or fewer.`,
      });
      return;
    }

    // Check if name is already taken in the room
    const existingMember = membersRepository.getMemberByName(roomId, name);
    if (existingMember) {
      res.render("join", {
        layout: "layout",
        room,
        error: "This name is already taken in the room.",
      });
      return;
    }

    // Check room capacity
    if (room.members.length >= MAX_ROOM_CAPACITY) {
      res.render("join", {
        layout: "layout",
        room,
        error: "Room is full. Maximum 10 users allowed.",
      });
      return;
    }

    // Add member to database so they're reserved
    const member = membersRepository.addMember(roomId, {
      sessionId: req.session.id,
      socketId: null, // Will be set when WebSocket connects
      name: name,
      point: null,
      connected: false, // Not connected via WebSocket yet
    });

    if (!member) {
      // This case should ideally not happen if getMemberByName check is robust,
      // but good to keep for defensive programming.
      res.render("join", {
        layout: "layout",
        room,
        error: "Failed to add member, perhaps the name is taken.",
      });
      return;
    }

    // Create session for this room
    if (!req.session.rooms) {
      req.session.rooms = {};
    }

    req.session.rooms[roomId] = {
      name: name,
      isAdmin: false,
      adminToken: null,
      joinedAt: Date.now(),
    };

    console.log(`[POST /play/${roomId}/join] User ${name} joining room`);

    // Save session and redirect to room
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.redirect("/play");
      }
      res.redirect(`/play/${roomId}`);
    });
  },
  register: async (req, res) => {
    const adminToken = randomUUID();
    const adminName = String(req.body.name ?? "").trim().slice(0, MAX_NAME_LENGTH);

    if (!adminName) {
      res.redirect("/play");
      return;
    }

    const room = roomRepository.createRoom({
      taskTitle: req.body.taskTitle,
      taskDescription: req.body.taskDescription,
      adminToken: adminToken,
      adminName: adminName,
    });

    if (!req.session.rooms) {
      req.session.rooms = {};
    }

    req.session.rooms[room.id] = {
      name: adminName,
      isAdmin: true,
      adminToken: adminToken,
      joinedAt: Date.now(),
    };

    console.log("Created room:", room.id);

    // Explicitly save session before redirect to ensure it persists
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.redirect("/play");
      }
      res.redirect(`/play/${room.id}`);
    });
  },
});

export default PlayController;
