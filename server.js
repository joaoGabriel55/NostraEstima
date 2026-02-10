import { randomUUID } from "crypto";
import express, { json, static as serveStatic, urlencoded } from "express";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import serverless from "serverless-http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;
const MAX_ROOM_CAPACITY = 10;
const ROOM_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const planPokerSessions = {};

// Check if a room is expired
function isRoomExpired(room) {
  return Date.now() - room.createdAt > ROOM_DURATION_MS;
}

// Check room expiration and handle cleanup
function checkRoomExpiration(roomId, socket) {
  const room = planPokerSessions[roomId];
  if (!room) return true; // Room doesn't exist

  if (isRoomExpired(room)) {
    // Notify all users in the room that it has expired
    io.to(roomId).emit("room:expired", {
      message: "Room has expired after 10 minutes.",
    });
    delete planPokerSessions[roomId];
    console.log(`Room ${roomId} expired and deleted.`);
    return true;
  }
  return false;
}

app.use(json());
app.use(urlencoded({ extended: true }));

// Serve static files
app.use(serveStatic(join(__dirname)));
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

// Route: Join existing room
app.get("/play/:id", (req, res) => {
  const roomId = req.params.id;
  const room = planPokerSessions[roomId];

  if (!room) {
    res.redirect("/play");
    return;
  }

  // Check if room is expired
  if (isRoomExpired(room)) {
    delete planPokerSessions[roomId];
    console.log(`Room ${roomId} expired and deleted on access.`);
    res.redirect("/play");
    return;
  }
  res.render("index", {
    room: room,
    isNewUser: true, // User needs to enter their name to join
  });
});

app.get("/", (req, res) => {
  res.redirect("/play");
});

// Route: Create new room form
app.get("/play", (_, res) => {
  res.render("index", { room: null, isNewUser: false });
});

// Route: Register new room
app.post("/register", async (req, res) => {
  const roomId = randomUUID();
  const adminToken = randomUUID(); // Token to identify the admin

  planPokerSessions[roomId] = {
    id: roomId,
    taskTitle: req.body.taskTitle,
    taskDescription: req.body.taskDescription,
    adminToken: adminToken,
    adminName: req.body.name,
    members: [],
    revealed: false,
    createdAt: Date.now(),
  };

  console.log("Created room:", roomId);

  // Redirect with admin token in query param (will be stored in sessionStorage)
  res.redirect(
    `/play/${roomId}?admin=${adminToken}&name=${encodeURIComponent(req.body.name)}`,
  );
});

// WebSocket handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join room
  socket.on("room:join", ({ roomId, name, adminToken }) => {
    // Check if room exists and is not expired
    if (checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = planPokerSessions[roomId];

    // Check capacity
    if (room.members.length >= MAX_ROOM_CAPACITY) {
      socket.emit("room:error", {
        message: "Room is full. Maximum 10 users allowed.",
      });
      return;
    }

    // Check if user already exists (reconnection)
    const existingMember = room.members.find((m) => m.name === name);
    if (existingMember) {
      // Update socket id for reconnection
      existingMember.socketId = socket.id;
    } else {
      // Add new member
      room.members.push({
        socketId: socket.id,
        name: name,
        point: null,
      });
    }

    // Join the socket room
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = name;

    // Determine if this user is admin
    const isAdmin = adminToken === room.adminToken;

    // Send room state to the joining user
    socket.emit("room:joined", {
      room: getSanitizedRoom(room),
      isAdmin: isAdmin,
      userName: name,
    });

    // Notify others about new member
    socket.to(roomId).emit("room:memberJoined", {
      member: { name: name, hasVoted: false },
      members: getSanitizedMembers(room),
    });

    console.log(
      `${name} joined room ${roomId}. Members: ${room.members.length}`,
    );
  });

  // Submit vote
  socket.on("vote:submit", ({ roomId, point }) => {
    // Check if room exists and is not expired
    if (checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = planPokerSessions[roomId];

    const member = room.members.find((m) => m.socketId === socket.id);
    if (!member) {
      socket.emit("room:error", {
        message: "You are not a member of this room.",
      });
      return;
    }

    member.point = point;

    // Notify all users about the vote (without revealing the value)
    io.to(roomId).emit("vote:updated", {
      members: getSanitizedMembers(room),
      voterName: member.name,
    });

    console.log(`${member.name} voted ${point} in room ${roomId}`);
  });

  // Reveal votes (admin only)
  socket.on("votes:reveal", ({ roomId, adminToken }) => {
    // Check if room exists and is not expired
    if (checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = planPokerSessions[roomId];

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", {
        message: "Only the admin can reveal votes.",
      });
      return;
    }

    room.revealed = true;

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
  socket.on("votes:reset", ({ roomId, adminToken }) => {
    // Check if room exists and is not expired
    if (checkRoomExpiration(roomId, socket)) {
      socket.emit("room:error", { message: "Room not found or has expired." });
      return;
    }

    const room = planPokerSessions[roomId];

    if (adminToken !== room.adminToken) {
      socket.emit("room:error", { message: "Only the admin can reset votes." });
      return;
    }

    // Reset all votes
    room.members.forEach((m) => {
      m.point = null;
    });
    room.revealed = false;

    // Notify all users
    io.to(roomId).emit("votes:reset", {
      members: getSanitizedMembers(room),
    });

    console.log(`Votes reset in room ${roomId}`);
  });

  // End session (admin only)
  socket.on("room:end", ({ roomId, adminToken }) => {
    const room = planPokerSessions[roomId];

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
    delete planPokerSessions[roomId];

    console.log(`Room ${roomId} ended by admin.`);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const userName = socket.userName;

    if (roomId && planPokerSessions[roomId]) {
      const room = planPokerSessions[roomId];

      // Remove member from room
      room.members = room.members.filter((m) => m.socketId !== socket.id);

      // Notify others
      io.to(roomId).emit("room:memberLeft", {
        memberName: userName,
        members: getSanitizedMembers(room),
      });

      console.log(
        `${userName} left room ${roomId}. Members: ${room.members.length}`,
      );

      // If room is empty, delete it
      if (room.members.length === 0) {
        delete planPokerSessions[roomId];
        console.log(`Room ${roomId} deleted (empty).`);
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

export const handler = serverless(app);
