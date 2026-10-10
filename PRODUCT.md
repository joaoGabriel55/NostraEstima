# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Agile/Scrum teams estimating stories together during a live remote call (refinement or sprint planning). One person (the facilitator) creates a room and pastes the link into the call chat; everyone else opens it, types a name, and votes. Participants arrive mid-call, often on a laptop beside a video window, and expect to be voting within seconds.

## Product Purpose

PokerEstima runs a single round-based planning-poker session in real time: the facilitator names the task, the team picks cards privately, the facilitator reveals, the team discusses outliers and re-votes or moves on. Success is a team reaching an estimate without anyone signing up, installing anything, or being anchored by someone else's vote.

## Positioning

Zero-friction and ephemeral. No accounts, no workspace, no history: one link, a name, and a room that destroys itself after 10 minutes (or 30 seconds after the last person leaves). There is nothing to set up, manage, or leak afterwards.

## Operating Context

- Used alongside a video call (Meet, Zoom, Teams, etc.); the room link is shared in that call's chat.
- Task context comes from elsewhere (Jira tickets, links); the room holds a title and a free-text description/links field.
- The facilitator is the room creator (admin) and is the only one who can reveal votes, start a new round, and end the session.
- Rooms are short-lived; a session is expected to cover a handful of rounds, not a whole backlog.

## Capabilities and Constraints

- Create room (name, task title, optional description/links) → shareable `/play/:id` link → join with a name.
- Real-time member list with "has voted" indicators; votes hidden server-side until reveal (no anchoring).
- Fixed deck: 0, 1, 2, 3, 5, 8, 13, 20, 40, 100, each with an emoji and label (😴 No effort … 💀 Epic!).
- Reveal shows every vote, the average, and the distribution; New Round resets votes; End closes the room.
- Max 10 participants per room; 10-minute room lifetime with a visible countdown; 30-second reconnect grace period.
- The facilitator can add 5 minutes once, in the room's last 2 minutes (decided 2026-10-05), so a room lives 15 minutes at most. Ephemeral stays the default.
- One tap is the vote; votes can change until the reveal and are locked after it.
- Keyboard: type a card's number to vote; the facilitator reveals with Shift+R and starts a round with Shift+N.
- Links in the task description are clickable.
- Identity is session-cookie based (no login); session cookies last 10 minutes.
- Server-rendered EJS + vanilla JS, no bundler; deployed on Fly.io with SQLite.
- No advertising: the AdSense sidebar was removed (2026-10-04) so the room stays usable beside a video call.
- Open: whether the task title can be edited per round (currently fixed at room creation); no custom decks.

## Brand Commitments

- Canonical name is **PokerEstima**; the UI, page title and README use it.
- The flag logo (`public/flag.svg`, yellow field with red horizontal stripes) is a kept brand asset.
- The emoji card meanings stay on the cards (as a secondary mark); the tagline is "Estimate your tasks with fun!"
- Catalan identity: the visual world draws on Barcelona/Catalan references, kept minimal (user commitment, 2026-10-04).

## Evidence on Hand

- README screenshots of the current UI (GitHub user-attachments links in `README.md`).
- No testimonials, user counts, customers, or usage metrics exist; do not fabricate them.

## Product Principles

1. **Seconds to first vote.** Every step between clicking the link and picking a card is a cost; never add sign-up, setup, or configuration to the join path.
2. **Ephemeral by design.** Rooms expire and leave nothing behind; communicate the timer and expiry honestly rather than hiding them.
3. **Protect independent judgment.** Votes stay hidden until the facilitator reveals; nothing should hint at others' values before reveal.
4. **The facilitator steers, everyone sees.** Admin-only actions are clear to the admin and their effects are instantly visible to all.
5. **Built for the side of a call.** Must stay legible and usable in a narrow window next to a video meeting.
