import { randomUUID } from "crypto";
import express, { json, static as serveStatic, urlencoded } from "express";
import session from "express-session";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { db } from "./db/index.js";
import sharedSession from "express-socket.io-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Socket.IO configuration optimized for production/Fly.io
const io = new Server(server, {
  // Connection settings for production reliability
  pingTimeout: 60000,
  pingInterval: 25000,
  // Upgrade timeout
  upgradeTimeout: 30000,
  // Allow reconnection
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: false,
  },
  // Transport settings
  transports: ["websocket", "polling"],
  // CORS settings (adjust for production)
  cors: {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  },
});

const PORT = process.env.PORT || 4000;
const MAX_ROOM_CAPACITY = 10;
const ROOM_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Run cleanup every minute
const DISCONNECT_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds grace period

// Check if a room is expired
function isRoomExpired(room) {
  return Date.now() - room.createdAt > ROOM_DURATION_MS;
}

// Periodic cleanup of expired rooms
function startCleanupInterval() {
  setInterval(() => {
    try {
      const expiredRoomIds = db.getExpiredRooms(ROOM_DURATION_MS);
      
      for (const roomId of expiredRoomIds) {
        // Notify all users in the room
        io.to(roomId).emit("room:expired", {
          message: "Room has expired after 10 minutes.",
        });
        
        // Delete the room
        db.deleteRoom(roomId);
        console.log(`[Cleanup] Room ${roomId} expired and deleted.`);
      }
    } catch (error) {
      console.error("[Cleanup] Error during room cleanup:", error);
    }
  }, CLEANUP_INTERVAL_MS);
}

// Check room expiration and handle cleanup
function checkRoomExpiration(roomId) {
  const room = db.getRoom(roomId);
  if (!room) return true; // Room doesn't exist

  if (isRoomExpired(room)) {
    // Notify all users in the room that it has expired
    io.to(roomId).emit("room:expired", {
      message: "Room has expired after 10 minutes.",
    });
    db.deleteRoom(roomId);
    console.log(`Room ${roomId} expired and deleted.`);
    return true;
  }
  return false;
}

const sessionMiddleware = session({
  secret: process.env.SECRET_KEY || "secret", // Use environment variable in production
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: Boolean(process.env.SECRET_KEY), // Set to true in production with HTTPS
    maxAge: 10 * 60 * 1000, // 10 minutes
  },
});

app.use(sessionMiddleware);

// Share session with Socket.IO using express-socket.io-session
io.use(sharedSession(sessionMiddleware, {
  autoSave: true,
}));

app.use(json());
app.use(urlencoded({ extended: true }));

// Serve static files
app.use(serveStatic(join(__dirname)));
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

// Route: Join existing room
app.get("/play/:id", async (req, res) => {
  const roomId = req.params.id;
  const room = db.getRoom(roomId);

  if (!room) {
    res.redirect("/play");
    return;
  }

  // Check if room is expired
  if (isRoomExpired(room)) {
    db.deleteRoom(roomId);
    console.log(`Room ${roomId} expired and deleted on access.`);
    res.redirect("/play");
    return;
  }

  const userSession = req.session.rooms?.[roomId];

  // Debug logging
  console.log(`[GET /play/${roomId}] Session ID: ${req.session.id}`);
  console.log(`[GET /play/${roomId}] User session for room:`, userSession);

  // Always render the room - the server will handle user state via session in WebSocket
  res.render("index", {
    room,
    userSession: userSession || null,
  });
});

app.post("/play/:id/join", async (req, res) => {
  const roomId = req.params.id;
  const { name } = req.body;
  const room = db.getRoom(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  if (isRoomExpired(room)) {
    db.deleteRoom(roomId);
    return res.status(410).json({ error: "Room expired" });
  }

  if (room.members.length >= MAX_ROOM_CAPACITY) {
    return res.status(403).json({ error: "Room is full" });
  }

  // Store in session
  if (!req.session.rooms) {
    req.session.rooms = {};
  }

  req.session.rooms[roomId] = {
    name: name,
    isAdmin: false,
    joinedAt: Date.now(),
  };

  res.json({ success: true, userName: name });
});

app.get("/", (req, res) => {
  res.redirect("/play");
});

// Route: Create new room form
app.get("/play", (_, res) => {
  res.render("index", { room: null, userSession: null });
});

// Route: Register new room
app.post("/register", async (req, res) => {
  const adminToken = randomUUID();

  const room = db.createRoom({
    taskTitle: req.body.taskTitle,
    taskDescription: req.body.taskDescription,
    adminToken: adminToken,
    adminName: req.body.name,
  });

  if (!req.session.rooms) {
    req.session.rooms = {};
  }

  req.session.rooms[room.id] = {
    name: req.body.name,
    isAdmin: true,
    adminToken: adminToken,
    joinedAt: Date.now(),
  };

  console.log("Created room:", room.id);

  res.redirect(`/play/${room.id}`);
});

// ============== WebSocket Handling ==============

// Track pending disconnections for grace period handling
const pendingDisconnections = new Map();

io.on("connection", (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Handle connection state recovery
  if (socket.recovered) {
    console.log(`[Socket] Recovered connection for: ${socket.id}`);
    // The socket automatically rejoins rooms it was in
  }

  // Join room - handles session checking server-side
  socket.on("room:join", async ({ roomId, name, adminToken }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    const socketSession = socket.handshake.session;
    const sessionIdentifier = socketSession?.id;

    // Debug logging
    console.log(`[room:join] Socket ID: ${socket.id}`);
    console.log(`[room:join] Session ID: ${sessionIdentifier}`);
    console.log(`[room:join] Requested name: ${name}, adminToken: ${adminToken ? 'provided' : 'not provided'}`);

    // Get user session data for this room
    const userSession = socketSession?.rooms?.[roomId];

    // Determine the user's name and admin status from session or request
    let userName = name;
    let userAdminToken = adminToken;
    let isNewUser = true;

    if (userSession) {
      // User has an existing session for this room
      userName = userSession.name;
      userAdminToken = userSession.adminToken || null;
      isNewUser = false;
    } else if (!name) {
      // No session and no name provided - user needs to join first
      socket.emit("room:needsJoin", {
        roomId: roomId,
        taskTitle: room.taskTitle,
        adminName: room.adminName,
      });
      return;
    }

    // Cancel any pending disconnection for this session
    const pendingKey = `${roomId}:${sessionIdentifier}`;
    if (pendingDisconnections.has(pendingKey)) {
      clearTimeout(pendingDisconnections.get(pendingKey));
      pendingDisconnections.delete(pendingKey);
      console.log(`[room:join] Cancelled pending disconnection for ${userName}`);
    }

    // Look for existing member by session identifier or name
    let existingMember = db.getMemberBySession(roomId, sessionIdentifier);
    if (!existingMember && userName) {
      existingMember = db.getMemberByName(roomId, userName);
    }

    // Check room capacity for new members
    if (!existingMember && room.members.length >= MAX_ROOM_CAPACITY) {
      socket.emit("room:error", {
        message: "Room is full. Maximum 10 users allowed.",
      });
      return;
    }

    let member;
    let isReconnecting = false;

    if (existingMember) {
      // Reconnection - update socket and session info
      isReconnecting = true;
      db.updateMemberSocket(existingMember.id, socket.id, sessionIdentifier, true);
      member = { ...existingMember, socketId: socket.id, sessionId: sessionIdentifier, connected: true };
      console.log(`[room:join] User ${userName} reconnected to room ${roomId}`);
    } else {
      // New member
      member = db.addMember(roomId, {
        sessionId: sessionIdentifier,
        socketId: socket.id,
        name: userName,
        point: null,
        connected: true,
      });

      if (!member) {
        socket.emit("room:error", {
          message: "This name is already taken in the room.",
        });
        return;
      }

      // Store in session if not already there
      if (socketSession && !userSession) {
        if (!socketSession.rooms) {
          socketSession.rooms = {};
        }
        socketSession.rooms[roomId] = {
          name: userName,
          isAdmin: userAdminToken === room.adminToken,
          adminToken: userAdminToken === room.adminToken ? userAdminToken : null,
          joinedAt: Date.now(),
        };
        
        socketSession.save((err) => {
          if (err) {
            console.error("[room:join] Failed to save session:", err);
          }
        });
      }
    }

    // Join the Socket.IO room
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.sessionId = sessionIdentifier;
    socket.memberId = member.id;

    const isAdmin = userAdminToken === room.adminToken;

    // Get fresh room data
    const freshRoom = db.getRoom(roomId);

    // Send current game state
    socket.emit("room:joined", {
      room: getSanitizedRoom(freshRoom),
      isAdmin: isAdmin,
      userName: userName,
      isReconnecting: isReconnecting,
      isNewUser: isNewUser,
      previousVote: freshRoom.revealed ? member.point : member.point !== null,
    });

    // Notify others
    if (!isReconnecting) {
      socket.to(roomId).emit("room:memberJoined", {
        member: { name: userName, hasVoted: false },
        members: getSanitizedMembers(freshRoom),
      });
    } else {
      socket.to(roomId).emit("room:memberReconnected", {
        memberName: userName,
        members: getSanitizedMembers(freshRoom),
      });
    }

    console.log(`[room:join] ${userName} joined room ${roomId}. Members: ${freshRoom.members.length}`);
  });

  // Handle new user joining with name
  socket.on("room:joinWithName", async ({ roomId, name }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    if (!name || !name.trim()) {
      socket.emit("room:error", { message: "Please enter your name." });
      return;
    }

    const trimmedName = name.trim();

    // Check if name is already taken in the room
    const existingMember = db.getMemberByName(roomId, trimmedName);
    if (existingMember) {
      socket.emit("room:error", { message: "This name is already taken in the room." });
      return;
    }

    if (room.members.length >= MAX_ROOM_CAPACITY) {
      socket.emit("room:error", {
        message: "Room is full. Maximum 10 users allowed.",
      });
      return;
    }

    const socketSession = socket.handshake.session;
    const sessionIdentifier = socketSession?.id;

    // Store in session
    if (socketSession) {
      if (!socketSession.rooms) {
        socketSession.rooms = {};
      }
      socketSession.rooms[roomId] = {
        name: trimmedName,
        isAdmin: false,
        joinedAt: Date.now(),
      };

      console.log(`[room:joinWithName] Saving session for ${trimmedName} in room ${roomId}`);

      socketSession.save((err) => {
        if (err) {
          console.error("[room:joinWithName] Failed to save session:", err);
        } else {
          console.log(`[room:joinWithName] Session saved successfully`);
        }
      });
    }

    // Add member to database
    const member = db.addMember(roomId, {
      sessionId: sessionIdentifier,
      socketId: socket.id,
      name: trimmedName,
      point: null,
      connected: true,
    });

    if (!member) {
      socket.emit("room:error", {
        message: "This name is already taken in the room.",
      });
      return;
    }

    // Join the Socket.IO room
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = trimmedName;
    socket.sessionId = sessionIdentifier;
    socket.memberId = member.id;

    // Get fresh room data
    const freshRoom = db.getRoom(roomId);

    // Send current game state
    socket.emit("room:joined", {
      room: getSanitizedRoom(freshRoom),
      isAdmin: false,
      userName: trimmedName,
      isReconnecting: false,
      isNewUser: false,
      previousVote: null,
    });

    // Notify others
    socket.to(roomId).emit("room:memberJoined", {
      member: { name: trimmedName, hasVoted: false },
      members: getSanitizedMembers(freshRoom),
    });

    console.log(`[room:joinWithName] ${trimmedName} joined room ${roomId}. Members: ${freshRoom.members.length}`);
  });

  // Submit vote
  socket.on("vote:submit", async ({ roomId, point }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const member = db.getMemberBySocket(roomId, socket.id);
    if (!member) {
      socket.emit("room:error", {
        message: "You are not a member of this room.",
      });
      return;
    }

    // Update the vote
    db.updateMemberPoint(member.id, point);

    // Get fresh room data
    const room = db.getRoom(roomId);

    // Notify all users about the vote (without revealing the value)
    io.to(roomId).emit("vote:updated", {
      members: getSanitizedMembers(room),
      voterName: member.name,
    });

    console.log(`[vote:submit] ${member.name} voted ${point} in room ${roomId}`);
  });

  // Reveal votes (admin only)
  socket.on("votes:reveal", async ({ roomId, adminToken }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", {
        message: "Only the admin can reveal votes.",
      });
      return;
    }

    // Update room state
    db.setRoomRevealed(roomId, true);

    // Get fresh room data
    const freshRoom = db.getRoom(roomId);

    // Calculate average (only for numeric votes)
    const numericVotes = freshRoom.members
      .filter((m) => m.point !== null && typeof m.point === "number")
      .map((m) => m.point);

    const average =
      numericVotes.length > 0
        ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
        : null;

    // Send revealed data to all users
    io.to(roomId).emit("votes:revealed", {
      members: freshRoom.members.map((m) => ({
        name: m.name,
        point: m.point,
        hasVoted: m.point !== null,
      })),
      average: average,
    });

    console.log(`[votes:reveal] Votes revealed in room ${roomId}. Average: ${average}`);
  });

  // Reset votes for new round (admin only)
  socket.on("votes:reset", async ({ roomId, adminToken }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", { message: "Only the admin can reset votes." });
      return;
    }

    // Reset all votes
    db.resetAllMemberPoints(roomId);
    db.setRoomRevealed(roomId, false);

    // Get fresh room data
    const freshRoom = db.getRoom(roomId);

    // Notify all users
    io.to(roomId).emit("votes:reset", {
      members: getSanitizedMembers(freshRoom),
    });

    console.log(`[votes:reset] Votes reset in room ${roomId}`);
  });

  // End session (admin only)
  socket.on("room:end", async ({ roomId, adminToken }) => {
    const room = db.getRoom(roomId);

    if (!room) {
      socket.emit("room:error", {
        message: "Room not found or has already ended.",
      });
      return;
    }

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", {
        message: "Only the admin can end the session.",
      });
      return;
    }

    // Notify all users
    io.to(roomId).emit("room:ended", {
      message: "The session has been ended by the admin.",
    });

    // Delete the room
    db.deleteRoom(roomId);

    console.log(`[room:end] Room ${roomId} ended by admin.`);
  });

  // Handle disconnect with grace period
  socket.on("disconnect", async (reason) => {
    const roomId = socket.roomId;
    const userName = socket.userName;
    const sessionId = socket.sessionId;
    const memberId = socket.memberId;

    console.log(`[Socket] User disconnected: ${socket.id}, reason: ${reason}`);

    if (roomId && memberId) {
      // Mark member as disconnected immediately
      db.updateMemberConnection(memberId, null, false);

      // Notify others immediately
      const room = db.getRoom(roomId);
      if (room) {
        io.to(roomId).emit("room:memberDisconnected", {
          memberName: userName,
          members: getSanitizedMembers(room),
        });

        console.log(`[disconnect] ${userName} disconnected from room ${roomId}`);

        // Set up grace period for room deletion if everyone is gone
        const connectedCount = db.getConnectedMemberCount(roomId);
        if (connectedCount === 0) {
          const pendingKey = `room:${roomId}`;
          
          // Clear any existing timeout for this room
          if (pendingDisconnections.has(pendingKey)) {
            clearTimeout(pendingDisconnections.get(pendingKey));
          }

          // Set a timeout to delete the room if no one reconnects
          const timeoutId = setTimeout(() => {
            const currentConnectedCount = db.getConnectedMemberCount(roomId);
            if (currentConnectedCount === 0) {
              db.deleteRoom(roomId);
              console.log(`[disconnect] Room ${roomId} deleted (all members disconnected).`);
            }
            pendingDisconnections.delete(pendingKey);
          }, DISCONNECT_GRACE_PERIOD_MS);

          pendingDisconnections.set(pendingKey, timeoutId);
        }
      }
    }
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`[Socket] Error for socket ${socket.id}:`, error);
  });
});

// ============== Helper Functions ==============

// Helper function to sanitize room data for clients
function getSanitizedRoom(room) {
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
function getSanitizedMembers(room) {
  return room.members.map((m) => ({
    name: m.name,
    hasVoted: m.point !== null,
    point: room.revealed ? m.point : null,
    connected: m.connected,
  }));
}

// Start the cleanup interval
startCleanupInterval();

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});