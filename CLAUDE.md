# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — run with `node --watch` auto-reload (http://localhost:4000)
- `npm start` — run in production mode

There is no test suite, linter, or build step. `npm test` is a placeholder that exits with an error.

Requires a Node version with the built-in `node:sqlite` module (22.5+; the Dockerfile uses Node 25). The README's "Node 18+" is out of date.

## Architecture

PokerEstima is a real-time planning-poker app: Express 5 serves server-rendered EJS pages, and Socket.IO handles all in-room interaction. Everything is ES modules (`"type": "module"`).

### Request flow

1. `POST /register` (form on `new.ejs`) creates a room and an admin token, then stores `{ name, isAdmin, adminToken }` in `req.session.rooms[roomId]`.
2. `GET /play/:id` renders `join.ejs` if the session has no entry for that room. Otherwise it renders `room.ejs`.
3. `POST /play/:id/join` reserves the member row in the DB (`connected: false`, no socket yet) and writes the session entry.
4. On the room page, `public/script.js` reads room/user info from the `#room-data` element's `data-*` attributes, connects to Socket.IO, and emits `room:join`.

HTTP routes live in `src/controllers/play-controller.js`. Socket events live in `src/controllers/play-events-controller.js`, which runs once per connection from `server.js`. Both are factory functions that receive the repositories, so you can inject them.

### Session is the source of identity

`express-socket.io-session` shares the Express session with Socket.IO (`socket.handshake.session`). The server decides identity and admin status from the session, not from client-sent values. Admin-only events (`votes:reveal`, `votes:reset`, `room:end`) check that `session.rooms[roomId].isAdmin` is set and that its `adminToken` matches `room.adminToken`. Session cookies last 10 minutes and are `secure` only when `SECRET_KEY` is set.

### Persistence

- `db/index.js` opens a SQLite database (`node:sqlite`'s `DatabaseSync`, WAL mode) at `DATABASE_PATH`, defaulting to `./data/app.db`. It also creates the schema inline with `CREATE TABLE IF NOT EXISTS`. There are no migrations, so a schema change on an existing table needs manual handling.
- Repositories (`src/repositories/`) use prepared statements and map snake_case rows to camelCase objects. They convert timestamps from Unix seconds in the DB to milliseconds in JS. Votes (`point`) are stored as TEXT and converted back to a number when numeric. `getRoom()` always includes its `members`.
- `src/repositories/index.js` exports the repositories under the misspelled name `respositories`. Keep that spelling, or rename it everywhere it's used.

### Room lifecycle

Constants are in `src/constants.js`: capacity 10, lifetime 10 minutes, disconnect grace period 30 seconds. Expired rooms are removed in three ways:
- by a 60-second cleanup interval in `server.js`, which emits `room:expired`
- by lazy checks in HTTP handlers and socket handlers
- by deleting a room when its last connected member leaves and nobody reconnects within the grace period (tracked in the module-level `pendingDisconnections` map)

Votes stay hidden until reveal: always send member data to clients through `getSanitizedRoom` / `getSanitizedMembers` in `src/helpers.js`. Those functions return `point: null` while `room.revealed` is false.

### Client

`public/script.js` is a single vanilla-JS file with no bundler. It defines the card deck (0–100 with emojis), renders the UI, and handles every socket event. The Socket.IO client loads from a CDN in `layout.ejs`. The project root is served statically, so assets are referenced as `/public/...`. Views use `express-ejs-layouts` with `src/views/layout.ejs` as the layout.

## Deployment

Pushes to `main` deploy to Fly.io (`poker-estima-app`, region `gru`) through `.github/workflows/fly-deploy.yml`. SQLite persists on the `sqlite_data` volume mounted at `/data` (`DATABASE_PATH=/data/app.db`). The app listens on `PORT` (default 4000). Optional env vars: `SECRET_KEY` (session secret; also turns on secure cookies) and `CORS_ORIGIN`.
