import {
  DECK_VALUES,
  DISCONNECT_GRACE_PERIOD_MS,
  EXTEND_WINDOW_MS,
  MAX_ROOM_CAPACITY,
  ROOM_EXTENSION_MS,
} from "../constants.js";
import {
  getRoomAverage,
  getRoomExpiresAt,
  getSanitizedMembers,
  getSanitizedRoom,
  isRoomExpired,
} from "../helpers.js";

// Track pending disconnections for grace period handling
const pendingDisconnections = new Map();

// Check room expiration and handle cleanup

const PlayEventsController = (
  roomRepository,
  membersRepository,
  io,
  socket,
) => {
  function checkRoomExpiration(roomId) {
    const room = roomRepository.getRoom(roomId);
    if (!room) return true; // Room doesn't exist

    if (isRoomExpired(room)) {
      // Notify all users in the room that it has expired
      io.to(roomId).emit("room:expired", {
        message: "This room has closed.",
      });
      roomRepository.deleteRoom(roomId);
      console.log(`Room ${roomId} expired and deleted.`);
      return true;
    }
    return false;
  }

  console.log(`[Socket] User connected: ${socket.id}`);

  // Handle connection state recovery
  if (socket.recovered) {
    console.log(`[Socket] Recovered connection for: ${socket.id}`);
    // The socket automatically rejoins rooms it was in
  }

  // Join room - handles session checking server-side
  socket.on("room:join", async ({ roomId, name, adminToken }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", {
        message: "Room not found or has expired.",
      });
      return;
    }

    const room = roomRepository.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    const socketSession = socket.handshake.session;
    const sessionIdentifier = socketSession?.id;

    // Debug logging
    console.log(`[room:join] Socket ID: ${socket.id}`);
    console.log(`[room:join] Session ID: ${sessionIdentifier}`);
    console.log(
      `[room:join] Requested name: ${name}, adminToken: ${adminToken ? "provided" : "not provided"}`,
    );

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
      console.log(
        `[room:join] Cancelled pending disconnection for ${userName}`,
      );
    }

    // Look for existing member by session identifier or name
    let existingMember = membersRepository.getMemberBySession(
      roomId,
      sessionIdentifier,
    );
    if (!existingMember && userName) {
      existingMember = membersRepository.getMemberByName(roomId, userName);
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
      isReconnecting =
        existingMember.connected === true || existingMember.socketId !== null;
      isFirstConnection = !isReconnecting;

      membersRepository.updateMemberSocket(
        existingMember.id,
        socket.id,
        sessionIdentifier,
        true,
      );
      member = {
        ...existingMember,
        socketId: socket.id,
        sessionId: sessionIdentifier,
        connected: true,
      };
      console.log(
        `[room:join] User ${userName} ${isReconnecting ? "reconnected to" : "connected to"} room ${roomId}`,
      );
    } else {
      // New member
      member = membersRepository.addMember(roomId, {
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
          adminToken:
            userAdminToken === room.adminToken ? userAdminToken : null,
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
    const freshRoom = roomRepository.getRoom(roomId);

    // Send current game state
    socket.emit("room:joined", {
      room: getSanitizedRoom(freshRoom),
      isAdmin: isAdmin,
      userName: userName,
      isReconnecting: isReconnecting,
      isNewUser: isNewUser,
      previousVote: freshRoom.revealed ? member.point : member.point !== null,
      // The member's own vote, so a reload can restore their selected card.
      myVote: member.point,
      // Lets the client correct for a skewed local clock when counting down.
      serverNow: Date.now(),
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

    console.log(
      `[room:join] ${userName} joined room ${roomId}. Members: ${freshRoom.members.length}`,
    );
  });

  // Submit vote
  socket.on("vote:submit", async ({ roomId, point }, ack) => {
    // Clients that pass an ack get the outcome there; older clients get room:error.
    const reply = typeof ack === "function" ? ack : () => {};
    const fail = (message) => {
      if (typeof ack === "function") {
        ack({ ok: false, message });
      } else {
        socket.emit("room:error", { message });
      }
    };

    if (checkRoomExpiration(roomId)) {
      fail("Room not found or has expired.");
      return;
    }

    const member = membersRepository.getMemberBySocket(roomId, socket.id);
    if (!member) {
      fail("You are not a member of this room.");
      return;
    }

    if (roomRepository.getRoom(roomId).revealed) {
      fail("Votes are already revealed. Wait for the next round.");
      return;
    }

    if (!DECK_VALUES.includes(Number(point))) {
      fail("That card isn't in the deck.");
      return;
    }

    // Update the vote
    membersRepository.updateMemberPoint(member.id, Number(point));

    // Get fresh room data
    const room = roomRepository.getRoom(roomId);

    // Notify all users about the vote (without revealing the value)
    io.to(roomId).emit("vote:updated", {
      members: getSanitizedMembers(room),
      voterName: member.name,
    });

    reply({ ok: true, point: Number(point) });

    console.log(
      `[vote:submit] ${member.name} voted ${point} in room ${roomId}`,
    );
  });

  // Extend the room once, in its last minutes (admin only)
  socket.on("room:extend", async ({ roomId }, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};

    if (checkRoomExpiration(roomId)) {
      reply({ ok: false, message: "Room not found or has expired." });
      return;
    }

    const room = roomRepository.getRoom(roomId);
    if (!room) {
      reply({ ok: false, message: "Room not found." });
      return;
    }

    const userSession = socket.handshake.session?.rooms?.[roomId];
    if (!userSession?.isAdmin || userSession?.adminToken !== room.adminToken) {
      reply({ ok: false, message: "Only the facilitator can extend the room." });
      return;
    }

    if (room.extensionMs > 0) {
      reply({ ok: false, message: "This room has already been extended." });
      return;
    }

    if (getRoomExpiresAt(room) - Date.now() > EXTEND_WINDOW_MS) {
      reply({
        ok: false,
        message: "You can add time in the room's last 2 minutes.",
      });
      return;
    }

    roomRepository.extendRoom(roomId, ROOM_EXTENSION_MS / 1000);
    const freshRoom = roomRepository.getRoom(roomId);

    io.to(roomId).emit("room:extended", {
      expiresAt: getRoomExpiresAt(freshRoom),
      serverNow: Date.now(),
    });
    reply({ ok: true });

    console.log(`[room:extend] Room ${roomId} extended by 5 minutes.`);
  });

  // Reveal votes (admin only)
  socket.on("votes:reveal", async ({ roomId }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", {
        message: "Room not found or has expired.",
      });
      return;
    }

    const room = roomRepository.getRoom(roomId);
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
    roomRepository.setRoomRevealed(roomId, true);

    // Get fresh room data
    const freshRoom = roomRepository.getRoom(roomId);

    const average = getRoomAverage(freshRoom);

    // Send revealed data to all users
    io.to(roomId).emit("votes:revealed", {
      members: freshRoom.members.map((m) => ({
        name: m.name,
        point: m.point,
        hasVoted: m.point !== null,
      })),
      average: average,
    });

    console.log(
      `[votes:reveal] Votes revealed in room ${roomId}. Average: ${average}`,
    );
  });

  // Reset votes for new round (admin only)
  socket.on("votes:reset", async ({ roomId }) => {
    if (checkRoomExpiration(roomId)) {
      socket.emit("room:error", {
        message: "Room not found or has expired.",
      });
      return;
    }

    const room = roomRepository.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Room not found." });
      return;
    }

    // Verify admin status from session
    const socketSession = socket.handshake.session;
    const userSession = socketSession?.rooms?.[roomId];

    if (!userSession?.isAdmin || userSession?.adminToken !== room.adminToken) {
      socket.emit("room:error", {
        message: "Only the admin can reset votes.",
      });
      return;
    }

    // Reset all votes
    membersRepository.resetAllMemberPoints(roomId);
    roomRepository.setRoomRevealed(roomId, false);

    // Get fresh room data
    const freshRoom = roomRepository.getRoom(roomId);

    // Notify all users
    io.to(roomId).emit("votes:reset", {
      members: getSanitizedMembers(freshRoom),
    });

    console.log(`[votes:reset] Votes reset in room ${roomId}`);
  });

  // End session (admin only)
  socket.on("room:end", async ({ roomId }) => {
    const room = roomRepository.getRoom(roomId);

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
    roomRepository.deleteRoom(roomId);

    console.log(`[room:end] Room ${roomId} ended by admin.`);
  });

  // Handle disconnect with grace period
  socket.on("disconnect", async (reason) => {
    const roomId = socket.roomId;
    const userName = socket.userName;
    const memberId = socket.memberId;

    console.log(`[Socket] User disconnected: ${socket.id}, reason: ${reason}`);

    if (roomId && memberId) {
      // Mark member as disconnected immediately
      membersRepository.updateMemberConnection(memberId, null, false);

      // Notify others immediately
      const room = roomRepository.getRoom(roomId);
      if (room) {
        io.to(roomId).emit("room:memberDisconnected", {
          memberName: userName,
          members: getSanitizedMembers(room),
        });

        console.log(
          `[disconnect] ${userName} disconnected from room ${roomId}`,
        );

        // Set up grace period for room deletion if everyone is gone
        const connectedCount =
          membersRepository.getConnectedMemberCount(roomId);
        if (connectedCount === 0) {
          const pendingKey = `room:${roomId}`;

          // Clear any existing timeout for this room
          if (pendingDisconnections.has(pendingKey)) {
            clearTimeout(pendingDisconnections.get(pendingKey));
          }

          // Set a timeout to delete the room if no one reconnects
          const timeoutId = setTimeout(() => {
            const currentConnectedCount =
              membersRepository.getConnectedMemberCount(roomId);
            if (currentConnectedCount === 0) {
              roomRepository.deleteRoom(roomId);
              console.log(
                `[disconnect] Room ${roomId} deleted (all members disconnected).`,
              );
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
};

export default PlayEventsController;
