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
const io = new Server(server);

const PORT = process.env.PORT || 4000;
const MAX_ROOM_CAPACITY = 10;
const ROOM_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Helper functions for Valkey storage
const ROOM_PREFIX = "planpoker:room:";

async function getRoom(roomId) {
  const data = await db.get(`${ROOM_PREFIX}${roomId}`);
  if (!data) return null;
  return JSON.parse(data);
}

async function setRoom(roomId, room) {
  await db.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room));
}

async function deleteRoom(roomId) {
  await db.del(`${ROOM_PREFIX}${roomId}`);
}

// Check if a room is expired
function isRoomExpired(room) {
  return Date.now() - room.createdAt > ROOM_DURATION_MS;
}

// Check room expiration and handle cleanup
async function checkRoomExpiration(roomId, socket) {
  const room = await getRoom(roomId);
  if (!room) return true; // Room doesn't exist

  if (isRoomExpired(room)) {
    // Notify all users in the room that it has expired
    io.to(roomId).emit("room:expired", {
      message: "Room has expired after 10 minutes.",
    });
    await deleteRoom(roomId);
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
// This properly handles session synchronization between HTTP and WebSocket
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
  const room = await getRoom(roomId);

  if (!room) {
    res.redirect("/play");
    return;
  }

  // Check if room is expired
  if (isRoomExpired(room)) {
    await deleteRoom(roomId);
    console.log(`Room ${roomId} expired and deleted on access.`);
    res.redirect("/play");
    return;
  }

  const userSession = req.session.rooms?.[roomId];

  // Debug logging
  console.log(`[GET /play/${roomId}] Session ID: ${req.session.id}`);
  console.log(`[GET /play/${roomId}] Session rooms:`, req.session.rooms);
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
  const room = await getRoom(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  if (isRoomExpired(room)) {
    await deleteRoom(roomId);
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
  const roomId = randomUUID();
  const adminToken = randomUUID(); // Token to identify the admin

  const room = {
    id: roomId,
    taskTitle: req.body.taskTitle,
    taskDescription: req.body.taskDescription,
    adminToken: adminToken,
    adminName: req.body.name,
    members: [],
    revealed: false,
    createdAt: Date.now(),
  };

  await setRoom(roomId, room);

  if (!req.session.rooms) {
    req.session.rooms = {};
  }

  req.session.rooms[roomId] = {
    name: req.body.name,
    isAdmin: true,
    adminToken: adminToken,
    joinedAt: Date.now(),
  };

  console.log("Created room:", roomId);

  res.redirect(`/play/${roomId}`);
});

// WebSocket handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join room - now handles session checking server-side
  socket.on("room:join", async ({ roomId, name, adminToken }) => {
    if (await checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = await getRoom(roomId);
    const socketSession = socket.handshake.session;

    // Debug logging
    console.log(`[room:join] Socket ID: ${socket.id}`);
    console.log(`[room:join] Session ID from socket: ${socketSession?.id}`);
    console.log(`[room:join] Session rooms from socket:`, socketSession?.rooms);
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

    // Look for existing member by session identifier or name
    const sessionIdentifier = socketSession?.id;
    const existingMember = room.members.find(
      (m) => m.sessionId === sessionIdentifier || m.name === userName,
    );

    if (!existingMember && room.members.length >= MAX_ROOM_CAPACITY) {
      socket.emit("room:error", {
        message: "Room is full. Maximum 10 users allowed.",
      });
      return;
    }

    let member;
    let isReconnecting = false;

    // Check if user already exists (reconnection)
    if (existingMember) {
      // Reconnection - update socket ID
      isReconnecting = true;
      existingMember.socketId = socket.id;
      existingMember.sessionId = sessionIdentifier;
      existingMember.connected = true;
      member = existingMember;
    } else {
      // New member
      member = {
        odentifier: randomUUID(),
        sessionId: sessionIdentifier,
        socketId: socket.id,
        name: userName,
        point: null,
        connected: true,
        joinedAt: Date.now(),
      };
      room.members.push(member);

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
        await new Promise((resolve, reject) => {
          socketSession.save((err) => {
            if (err) {
              console.error("Failed to save session:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }
    }

    await setRoom(roomId, room);

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.sessionId = sessionIdentifier;

    const isAdmin = userAdminToken === room.adminToken;

    // Send current game state
    socket.emit("room:joined", {
      room: getSanitizedRoom(room),
      isAdmin: isAdmin,
      userName: userName,
      isReconnecting: isReconnecting,
      isNewUser: isNewUser,
      // Include current vote state if user had voted before
      previousVote: room.revealed ? member.point : member.point !== null,
    });

    // Only notify others if it's a new member (not reconnection)
    if (!isReconnecting) {
      socket.to(roomId).emit("room:memberJoined", {
        member: { name: userName, hasVoted: false },
        members: getSanitizedMembers(room),
      });
    } else {
      // For reconnections, notify that user is back online
      socket.to(roomId).emit("room:memberReconnected", {
        memberName: userName,
        members: getSanitizedMembers(room),
      });
    }

    console.log(
      `${userName} joined room ${roomId}. Members: ${room.members.length}`,
    );
  });

  // Handle new user joining with name
  socket.on("room:joinWithName", async ({ roomId, name }) => {
    if (await checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = await getRoom(roomId);

    if (!name || !name.trim()) {
      socket.emit("room:error", { message: "Please enter your name." });
      return;
    }

    const trimmedName = name.trim();

    // Check if name is already taken in the room
    const existingMember = room.members.find((m) => m.name === trimmedName);
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

    // Store in session and wait for save to complete
    const socketSession = socket.handshake.session;
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
      console.log(`[room:joinWithName] Session ID: ${socketSession.id}`);
      console.log(`[room:joinWithName] Session rooms before save:`, socketSession.rooms);
      
      await new Promise((resolve, reject) => {
        socketSession.save((err) => {
          if (err) {
            console.error("Failed to save session:", err);
            reject(err);
          } else {
            console.log(`[room:joinWithName] Session saved successfully`);
            resolve();
          }
        });
      });
    } else {
      console.error(`[room:joinWithName] No session available for socket`);
    }

    // Now join the room with the name
    const sessionIdentifier = session?.id;
    const member = {
      odentifier: randomUUID(),
      sessionId: sessionIdentifier,
      socketId: socket.id,
      name: trimmedName,
      point: null,
      connected: true,
      joinedAt: Date.now(),
    };
    room.members.push(member);

    await setRoom(roomId, room);

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = trimmedName;
    socket.sessionId = sessionIdentifier;

    // Send current game state
    socket.emit("room:joined", {
      room: getSanitizedRoom(room),
      isAdmin: false,
      userName: trimmedName,
      isReconnecting: false,
      isNewUser: false,
      previousVote: null,
    });

    // Notify others
    socket.to(roomId).emit("room:memberJoined", {
      member: { name: trimmedName, hasVoted: false },
      members: getSanitizedMembers(room),
    });

    console.log(
      `${trimmedName} joined room ${roomId}. Members: ${room.members.length}`,
    );
  });

  // Submit vote
  socket.on("vote:submit", async ({ roomId, point }) => {
    // Check if room exists and is not expired
    if (await checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = await getRoom(roomId);

    const memberIndex = room.members.findIndex((m) => m.socketId === socket.id);
    if (memberIndex === -1) {
      socket.emit("room:error", {
        message: "You are not a member of this room.",
      });
      return;
    }

    room.members[memberIndex].point = point;
    await setRoom(roomId, room);

    // Notify all users about the vote (without revealing the value)
    io.to(roomId).emit("vote:updated", {
      members: getSanitizedMembers(room),
      voterName: room.members[memberIndex].name,
    });

    console.log(
      `${room.members[memberIndex].name} voted ${point} in room ${roomId}`,
    );
  });

  // Reveal votes (admin only)
  socket.on("votes:reveal", async ({ roomId, adminToken }) => {
    // Check if room exists and is not expired
    if (await checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = await getRoom(roomId);

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", {
        message: "Only the admin can reveal votes.",
      });
      return;
    }

    room.revealed = true;
    await setRoom(roomId, room);

    // Calculate average (only for numeric votes)
    const numericVotes = room.members
      .filter((m) => m.point !== null && typeof m.point === "number")
      .map((m) => m.point);

    const average =
      numericVotes.length > 0
        ? (
            numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
          ).toFixed(1)
        : null;

    // Send revealed data to all users
    io.to(roomId).emit("votes:revealed", {
      members: room.members.map((m) => ({
        name: m.name,
        point: m.point,
        hasVoted: m.point !== null,
      })),
      average: average,
    });

    console.log(`Votes revealed in room ${roomId}. Average: ${average}`);
  });

  // Reset votes for new round (admin only)
  socket.on("votes:reset", async ({ roomId, adminToken }) => {
    // Check if room exists and is not expired
    if (await checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = await getRoom(roomId);

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", { message: "Only the admin can reset votes." });
      return;
    }

    // Reset all votes
    room.members.forEach((m) => {
      m.point = null;
    });
    room.revealed = false;
    await setRoom(roomId, room);

    // Notify all users
    io.to(roomId).emit("votes:reset", {
      members: getSanitizedMembers(room),
    });

    console.log(`Votes reset in room ${roomId}`);
  });

  // End session (admin only)
  socket.on("room:end", async ({ roomId, adminToken }) => {
    const room = await getRoom(roomId);

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
    await deleteRoom(roomId);

    console.log(`Room ${roomId} ended by admin.`);
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const roomId = socket.roomId;
    const userName = socket.userName;
    const sessionId = socket.sessionId;

    if (roomId) {
      const room = await getRoom(roomId);

      if (room) {
        // Mark member as disconnected but don't remove them immediately
        // This allows for reconnection
        const member = room.members.find(
          (m) => m.socketId === socket.id || m.sessionId === sessionId
        );

        if (member) {
          member.connected = false;
          member.socketId = null;
          await setRoom(roomId, room);

          // Notify others
          io.to(roomId).emit("room:memberDisconnected", {
            memberName: userName,
            members: getSanitizedMembers(room),
          });

          console.log(
            `${userName} disconnected from room ${roomId}. Members: ${room.members.length}`,
          );

          // Check if all members are disconnected
          const connectedMembers = room.members.filter((m) => m.connected);
          if (connectedMembers.length === 0) {
            // Set a timeout to delete the room if no one reconnects
            setTimeout(async () => {
              const currentRoom = await getRoom(roomId);
              if (currentRoom) {
                const stillConnected = currentRoom.members.filter((m) => m.connected);
                if (stillConnected.length === 0) {
                  await deleteRoom(roomId);
                  console.log(`Room ${roomId} deleted (all members disconnected).`);
                }
              }
            }, 30000); // 30 seconds grace period
          }
        }
      }
    }

    console.log("User disconnected:", socket.id);
  });
});

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
  }));
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
