# 🃏 NostraEstima App

<img width="1346" height="677" alt="image" src="https://github.com/user-attachments/assets/6b0f8c92-d532-4576-ad4e-5e4bd32690e8" />

<img width="1059" height="1254" alt="image" src="https://github.com/user-attachments/assets/0b82ff8d-7876-4d10-b28d-8685581a0b5c" />


> Estimate your tasks with fun! A real-time planning poker application for agile teams.

![Planning Poker](https://img.shields.io/badge/Planning-Poker-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQxIDAtOC0zLjU5LTgtOHMzLjU5LTggOC04IDggMy41OSA4IDgtMy41OSA4LTggOHoiLz48L3N2Zz4=)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)

---

## ✨ Features

- 🎴 **Beautiful Card UI** - Intuitive poker cards with emoji indicators for each estimate
- ⚡ **Real-time Updates** - Powered by WebSockets for instant synchronization
- 👥 **Team Collaboration** - Support for up to 10 participants per room
- 🔒 **Hidden Votes** - Votes stay hidden until the admin reveals them (no anchoring bias!)
- 📊 **Instant Results** - Automatic average calculation and vote distribution
- 🔄 **Multiple Rounds** - Reset and start new estimations without leaving the room
- 📋 **Shareable Links** - One-click copy to invite team members
- ⏱️ **Auto Cleanup** - Rooms expire after 10 minutes to keep things tidy

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/point-point-app.git
cd point-point-app

# Install dependencies
npm install

# Start the server
npm start
```

### Development Mode

```bash
# Start with auto-reload on file changes
npm run dev
```

The app will be running at **http://localhost:4000** 🎉

---

## 🎮 How to Play

### 1. Create a Room 🏠

1. Go to `/play` or `/`
2. Enter your name and the task details
3. Click **"Start New Poker Room"**

### 2. Invite Your Team 📨

1. Copy the room link (click the 📋 button)
2. Share it with your teammates
3. They enter their names and join instantly!

### 3. Cast Your Votes 🗳️

1. Each participant selects a card (0, 1, 2, 3, 5, 8, 13, 20, 40, or 100)
2. Votes remain hidden until revealed
3. A checkmark ✓ shows who has voted

### 4. Reveal & Discuss 🎉

1. The admin clicks **"👁️ Reveal Votes"**
2. All votes are shown along with the average
3. Discuss any outliers and reach consensus

### 5. New Round 🔄

1. Click **"🔄 New Round"** to reset all votes
2. Estimate the next task!

---

## 🃏 Point Values

| Points | Emoji | Meaning |
|--------|-------|---------|
| 0 | 😴 | No effort needed |
| 1 | 🔥 | Tiny task |
| 2 | 🚀 | Small task |
| 3 | 🦄 | Small to medium |
| 5 | 🤓 | Medium effort |
| 8 | 💪 | Large task |
| 13 | 🧙 | Extra large |
| 20 | 🐙 | Huge task |
| 40 | 👹 | Massive effort |
| 100 | ⚡💀 | Epic! (Maybe split it?) |

---

## 🛠️ Tech Stack

- **Backend**: Express.js 5.x
- **Real-time**: Socket.io 4.x
- **Templating**: EJS
- **Frontend**: Vanilla JavaScript
- **Storage**: In-memory (server-side)

---

## 📁 Project Structure

```
point-point-app/
├── server.js           # Express + Socket.io server
├── views/
│   └── index.ejs       # Main template
├── public/
│   ├── script.js       # Client-side logic
│   └── styles.css      # Beautiful styles
├── package.json
└── README.md
```

---

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | Server port |
| `MAX_ROOM_CAPACITY` | 10 | Maximum users per room |
| `ROOM_DURATION_MS` | 600000 | Room lifetime (10 minutes) |

---

## 🎯 Room Rules

- **Max 10 users** per room
- **10-minute lifetime** - rooms auto-expire
- **Admin powers** - only the room creator can:
  - Reveal votes
  - Start new rounds
  - End the session
- **No anchoring** - votes are hidden until revealed

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

ISC License - feel free to use this project however you'd like!

---

## 💡 Tips for Great Estimates

1. **Don't overthink it** - Go with your gut feeling
2. **Estimate complexity, not time** - Story points measure effort
3. **Discuss outliers** - Big differences reveal knowledge gaps
4. **It's not a competition** - There are no wrong answers
5. **Have fun!** - That's why we use emojis 🎉

---

<p align="center">
  Made with ❤️ for agile teams everywhere
</p>

<p align="center">
  <sub>Now go estimate some stories! 🚀</sub>
</p>
