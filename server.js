import express, { json, static as serveStatic, urlencoded } from "express";
import session from "express-session";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import sharedSession from "express-socket.io-session";
import ejsLayouts from "express-ejs-layouts";
import PlayController from "./src/controllers/play-controller.js";
import PlayEventsController from "./src/controllers/play-events-controller.js";
import { respositories } from "./src/repositories/index.js";
import { MAX_ROOM_LIFETIME_MS, ROOM_DURATION_MS } from "./src/constants.js";
import { linkify } from "./src/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Trust proxy for production environments (Fly.io, Heroku, etc.)
app.set("trust proxy", 1);
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

const { roomRepository, membersRepository } = respositories;

const PORT = process.env.PORT || 4000;

const CLEANUP_INTERVAL_MS = 60 * 1000; // Run cleanup every minute

// Periodic cleanup of expired rooms
function startCleanupInterval() {
  setInterval(() => {
    try {
      const expiredRoomIds = roomRepository.getExpiredRooms(ROOM_DURATION_MS);

      for (const roomId of expiredRoomIds) {
        // Notify all users in the room
        io.to(roomId).emit("room:expired", {
          message: "This room has closed.",
        });

        // Delete the room
        roomRepository.deleteRoom(roomId);
        console.log(`[Cleanup] Room ${roomId} expired and deleted.`);
      }
    } catch (error) {
      console.error("[Cleanup] Error during room cleanup:", error);
    }
  }, CLEANUP_INTERVAL_MS);
}

const sessionMiddleware = session({
  secret: process.env.SECRET_KEY || "secret", // Use environment variable in production
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: Boolean(process.env.SECRET_KEY), // Set to true in production with HTTPS
    sameSite: "lax", // Required for cookies to work properly in modern browsers
    maxAge: MAX_ROOM_LIFETIME_MS, // as long as the longest room (with its extension)
  },
});

app.use(sessionMiddleware);

// Share session with Socket.IO using express-socket.io-session
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

app.use(json());
app.use(urlencoded({ extended: true }));

// Serve static files
app.use(serveStatic(join(__dirname)));
app.set("view engine", "ejs");
app.set("views", join(__dirname, "src/views"));
app.use(ejsLayouts);
app.set("layout", "layout");
app.locals.linkify = linkify;

const playerController = PlayController(roomRepository, membersRepository);

// Route: Home redirects to /play
app.get("/", playerController.index);

// Route: Create new room form
app.get("/play", playerController.new);

// Route: View existing room
app.get("/play/:id", playerController.show);

// Route: Join room (POST)
app.post("/play/:id/join", playerController.join);

// Route: Register new room
app.post("/register", playerController.register);

// ============== WebSocket Handling ==============
io.on("connection", (socket) => {
  PlayEventsController(roomRepository, membersRepository, io, socket);
});

// Start the cleanup interval
startCleanupInterval();

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
