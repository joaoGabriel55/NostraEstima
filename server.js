import { randomUUID } from "crypto";
import express, { json, static as serveStatic, urlencoded } from "express";
import session from "express-session";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { db } from "./db/index.js";
import sharedSession from "express-socket.io-session";
import ejsLayouts from "express-ejs-layouts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Trust proxy for production environments (Fly.io, Heroku, etc.)
app.set('trust proxy', 1);
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
    sameSite: 'lax', // Required for cookies to work properly in modern browsers
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
app.use(ejsLayouts);
app.set("layout", "layout");

// Route: Home redirects to /play
app.get("/", (req, res) => {
  res.redirect("/play");
});

// Route: Create new room form
app.get("/play", (_, res) => {
  res.render("new", { layout: "layout" });
});

// Route: View existing room
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

  // If user has no session for this room, show join page
  if (!userSession) {
    res.render("join", { 
      layout: "layout",
      room 
    });
    return;
  }

  // User has a session - show the room
  const roomUrl = `${req.protocol}://${req.get('host')}/play/${roomId}`;
  res.render("room", { 
    layout: "layout",
    room,
    userSession,
    roomUrl
  });
});

// Route: Join room (POST)
app.post("/play/:id/join", async (req, res) => {
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

  const name = req.body.name?.trim();

  if (!name) {
    res.render("join", { 
      layout: "layout",
      room,
      error: "Please enter your name."
    });
    return;
  }

  // Check if name is already taken in the room
  const existingMember = db.getMemberByName(roomId, name);
  if (existingMember) {
    res.render("join", { 
      layout: "layout",
      room,
      error: "This name is already taken in the room."
    });
    return;
  }

  // Check room capacity
  if (room.members.length >= MAX_ROOM_CAPACITY) {
    res.render("join", { 
      layout: "layout",
      room,
      error: "Room is full. Maximum 10 users allowed."
    });
    return;
  }

  // Add member to database so they're reserved
  const member = db.addMember(roomId, {
    sessionId: req.session.id,
    socketId: null, // Will be set when WebSocket connects
    name: name,
    point: null,
    connected: false, // Not connected via WebSocket yet
  });

  if (!member) {
    res.render("join", { 
      layout: "layout",
      room,
      error: "This name is already taken in the room."
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
      console.error('Session save error:', err);
      return res.redirect("/play");
    }
    res.redirect(`/play/${roomId}`);
  });
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

  // Explicitly save session before redirect to ensure it persists
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.redirect("/play");
    }
    res.redirect(`/play/${room.id}`);
  });
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
      // No session and no name provided - this is a fallback for edge cases
      // Normal flow handles this via HTTP redirect to join page
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
    let isFirstConnection = false;

    if (existingMember) {
      // Check if this is a reconnection (was previously connected) or first WebSocket connection
      // Members created via HTTP POST have connected: false until WebSocket connects
      isReconnecting = existingMember.connected === true || existingMember.socketId !== null;
      isFirstConnection = !isReconnecting;
      
      db.updateMemberSocket(existingMember.id, socket.id, sessionIdentifier, true);
      member = { ...existingMember, socketId: socket.id, sessionId: sessionIdentifier, connected: true };
      console.log(`[room:join] User ${userName} ${isReconnecting ? 'reconnected to' : 'connected to'} room ${roomId}`);
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
    if (!isReconnecting || isFirstConnection) {
      // New member or first WebSocket connection after HTTP join
      socket.to(roomId).emit("room:memberJoined", {
        member: { name: userName, hasVoted: false },
        members: getSanitizedMembers(freshRoom),
      });
    } else {
      // Actual reconnection (was connected before, disconnected, now back)
      socket.to(roomId).emit("room:memberReconnected", {
        memberName: userName,
        members: getSanitizedMembers(freshRoom),
      });
    }

    console.log(`[room:join] ${userName} joined room ${roomId}. Members: ${freshRoom.members.length}`);
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
  socket.on("votes:reveal", async ({ roomId }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    // Verify admin status from session
    const socketSession = socket.handshake.session;
    const userSession = socketSession?.rooms?.[roomId];
    
    if (!userSession?.isAdmin || userSession?.adminToken !== room.adminToken) {
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
  socket.on("votes:reset", async ({ roomId }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    // Verify admin status from session
    const socketSession = socket.handshake.session;
    const userSession = socketSession?.rooms?.[roomId];
    
    if (!userSession?.isAdmin || userSession?.adminToken !== room.adminToken) {
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
  socket.on("room:end", async ({ roomId }) => {
    const room = db.getRoom(roomId);

    if (!room) {
      socket.emit("room:error", {
        message: "Room not found or has already ended.",
      });
      return;
    }

    // Verify admin status from session
    const socketSession = socket.handshake.session;
    const userSession = socketSession?.rooms?.[roomId];
    
    if (!userSession?.isAdmin || userSession?.adminToken !== room.adminToken) {
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
