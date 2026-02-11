// Planning Poker card data
const cards = [
  { value: 0, emoji: "😴", label: "No effort" },
  { value: 1, emoji: "🔥", label: "Tiny" },
  { value: 2, emoji: "🚀", label: "Small" },
  { value: 3, emoji: "🦄", label: "Small-Med" },
  { value: 5, emoji: "🤓", label: "Medium" },
  { value: 8, emoji: "💪", label: "Large" },
  { value: 13, emoji: "🧙", label: "X-Large" },
  { value: 20, emoji: "🐙", label: "Huge" },
  { value: 40, emoji: "👹", label: "Massive" },
  { value: 100, emoji: "⚡💀", label: "Epic!" },
];

// State
let selectedCard = null;
let socket = null;
let isAdmin = false;
let userName = null;
let roomId = null;
let timerInterval = null;

// DOM Elements
const cardsGrid = document.getElementById("cardsGrid");
const selectionDisplay = document.getElementById("selectionDisplay");
const submitBtn = document.getElementById("submitBtn");
const validationError = document.getElementById("validationError");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const errorToast = document.getElementById("errorToast");
const errorToastMessage = document.getElementById("errorToastMessage");
const membersGrid = document.getElementById("membersGrid");
const adminControls = document.getElementById("adminControls");
const revealBtn = document.getElementById("revealBtn");
const resetBtn = document.getElementById("resetBtn");
const endBtn = document.getElementById("endBtn");
const resultsSection = document.getElementById("resultsSection");
const averageValue = document.getElementById("averageValue");
const votesBreakdown = document.getElementById("votesBreakdown");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const timerDisplay = document.getElementById("timerDisplay");
const cardsSection = document.getElementById("cardsSection");
const roomDataElement = document.getElementById("room-data");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the room page by looking for room-data element
  if (roomDataElement) {
    initializeRoom();
  }
});

// Get room data from data attributes
function getRoomData() {
  if (!roomDataElement) return null;
  
  return {
    roomId: roomDataElement.dataset.roomId,
    taskTitle: roomDataElement.dataset.taskTitle,
    taskDescription: roomDataElement.dataset.taskDescription,
    adminName: roomDataElement.dataset.adminName,
    userName: roomDataElement.dataset.userName,
    isAdmin: roomDataElement.dataset.isAdmin === "true"
  };
}

// Initialize room
function initializeRoom() {
  const roomData = getRoomData();
  if (!roomData) return;

  // Set state from data attributes
  roomId = roomData.roomId;
  userName = roomData.userName;
  isAdmin = roomData.isAdmin;

  // Setup copy button
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", copyRoomLink);
  }

  // Render cards
  if (cardsGrid) {
    renderCards();
  }

  // Setup submit button
  if (submitBtn) {
    submitBtn.addEventListener("click", handleSubmit);
  }

  // Setup admin controls
  if (revealBtn) {
    revealBtn.addEventListener("click", handleReveal);
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", handleReset);
  }
  if (endBtn) {
    endBtn.addEventListener("click", handleEndSession);
  }

  // Connect to WebSocket
  connectSocket();
}

// Connect to WebSocket
function connectSocket() {
  socket = io();

  socket.on("connect", () => {
    console.log("Connected to server");

    // Join the room via WebSocket (session already exists on server)
    socket.emit("room:join", {
      roomId: roomId,
      name: userName
    });
  });

  // Room joined successfully
  socket.on("room:joined", (data) => {
    console.log("Joined room:", data);
    isAdmin = data.isAdmin;
    userName = data.userName;

    // Update UI with room data
    updateMembersGrid(data.room.members);

    // Show admin controls if admin
    if (isAdmin && adminControls) {
      adminControls.style.display = "flex";
    }

    // If votes were already revealed
    if (data.room.revealed) {
      showResults(data.room.members, null);
    }

    // Start timer
    startTimer();

    showToast(`Welcome, ${userName}! 👋`);
  });

  // New member joined
  socket.on("room:memberJoined", (data) => {
    console.log("Member joined:", data);
    updateMembersGrid(data.members);
    showToast(`${data.member.name} joined the room 🎉`);
  });

  // Member left
  socket.on("room:memberLeft", (data) => {
    console.log("Member left:", data);
    updateMembersGrid(data.members);
    showToast(`${data.memberName} left the room 👋`);
  });

  // Member disconnected (temporary)
  socket.on("room:memberDisconnected", (data) => {
    console.log("Member disconnected:", data);
    updateMembersGrid(data.members);
    showToast(`${data.memberName} disconnected...`);
  });

  // Member reconnected
  socket.on("room:memberReconnected", (data) => {
    console.log("Member reconnected:", data);
    updateMembersGrid(data.members);
    showToast(`${data.memberName} is back online! 🔄`);
  });

  // Vote updated
  socket.on("vote:updated", (data) => {
    console.log("Vote updated:", data);
    updateMembersGrid(data.members);
  });

  // Votes revealed
  socket.on("votes:revealed", (data) => {
    console.log("Votes revealed:", data);
    showResults(data.members, data.average);
  });

  // Votes reset
  socket.on("votes:reset", (data) => {
    console.log("Votes reset:", data);
    resetVotingUI();
    updateMembersGrid(data.members);
    showToast("New round started! 🔄");
  });

  // Room ended
  socket.on("room:ended", (data) => {
    showErrorToast(data.message);
    setTimeout(() => {
      window.location.href = "/play";
    }, 2000);
  });

  // Room expired
  socket.on("room:expired", (data) => {
    showErrorToast(data.message);
    setTimeout(() => {
      window.location.href = "/play";
    }, 2000);
  });

  // Error
  socket.on("room:error", (data) => {
    console.error("Room error:", data);
    showErrorToast(data.message);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    showErrorToast("Connection lost. Reconnecting...");
  });

  socket.on("reconnect", () => {
    console.log("Reconnected to server");
    showToast("Reconnected! ✅");
  });
}

// Generate cards
function renderCards() {
  if (!cardsGrid) return;

  cardsGrid.innerHTML = cards
    .map(
      (card, index) => `
        <div class="poker-card" data-index="${index}" data-value="${card.value}">
          <div class="card-inner">
            <div class="card-corner top-left">
              <span>${card.value}</span>
              <span class="card-corner-emoji">${card.emoji}</span>
            </div>
            <span class="card-number">${card.value}</span>
            <span class="card-emoji">${card.emoji}</span>
            <div class="card-corner bottom-right">
              <span>${card.value}</span>
              <span class="card-corner-emoji">${card.emoji}</span>
            </div>
            <div class="selected-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
    `
    )
    .join("");

  // Add click handlers
  document.querySelectorAll(".poker-card").forEach((card) => {
    card.addEventListener("click", () => selectCard(card));
  });
}

// Select card
function selectCard(cardElement) {
  const index = parseInt(cardElement.dataset.index);
  const card = cards[index];

  // Remove previous selection
  document
    .querySelectorAll(".poker-card")
    .forEach((c) => c.classList.remove("selected"));

  // Add selection to clicked card
  cardElement.classList.add("selected");
  selectedCard = card;

  // Update display
  updateSelectionDisplay();

  // Hide validation error
  if (validationError) {
    validationError.classList.remove("show");
  }
}

// Update selection display
function updateSelectionDisplay() {
  if (!selectionDisplay) return;

  if (selectedCard) {
    selectionDisplay.classList.add("has-selection");
    selectionDisplay.innerHTML = `
      <div class="selection-value">
        <span class="selection-emoji">${selectedCard.emoji}</span>
        <div class="selection-text">
          <div class="selection-points">${selectedCard.value} ${selectedCard.value === 1 ? "Point" : "Points"}</div>
          <div class="selection-label">${selectedCard.label}</div>
        </div>
      </div>
    `;
  } else {
    selectionDisplay.classList.remove("has-selection");
    selectionDisplay.innerHTML =
      '<p class="selection-placeholder">👆 Pick a card to estimate</p>';
  }
}

// Update members grid
function updateMembersGrid(members) {
  if (!membersGrid) return;

  membersGrid.innerHTML = members
    .map(
      (member) => `
      <div class="member-card ${member.hasVoted ? "voted" : ""} ${member.connected === false ? "disconnected" : ""}">
        <div class="member-avatar">
          ${member.name.charAt(0).toUpperCase()}
        </div>
        <div class="member-name">${member.name}</div>
        <div class="member-status">
          ${
            member.connected === false
              ? '<span class="vote-offline">offline</span>'
              : member.point !== null
              ? `<span class="vote-value">${member.point}</span>`
              : member.hasVoted
              ? '<span class="vote-hidden">✓</span>'
              : '<span class="vote-pending">...</span>'
          }
        </div>
      </div>
    `
    )
    .join("");
}

// Show results
function showResults(members, average) {
  if (!resultsSection || !votesBreakdown || !averageValue) return;

  // Update members grid with revealed votes
  updateMembersGrid(members);

  // Show average
  averageValue.textContent = average || "-";

  // Calculate vote distribution
  const voteDistribution = {};
  members.forEach((m) => {
    if (m.point !== null) {
      voteDistribution[m.point] = (voteDistribution[m.point] || 0) + 1;
    }
  });

  // Display vote breakdown
  const sortedVotes = Object.entries(voteDistribution).sort(
    (a, b) => parseInt(a[0]) - parseInt(b[0])
  );
  votesBreakdown.innerHTML = sortedVotes
    .map(([value, count]) => {
      const card = cards.find((c) => c.value === parseInt(value));
      return `
        <div class="vote-item">
          <span class="vote-item-emoji">${card ? card.emoji : "🎴"}</span>
          <span class="vote-item-value">${value}</span>
          <span class="vote-item-count">×${count}</span>
        </div>
      `;
    })
    .join("");

  // Show results section
  resultsSection.style.display = "block";

  // Hide cards section
  if (cardsSection) {
    cardsSection.style.opacity = "0.5";
    cardsSection.style.pointerEvents = "none";
  }

  // Update admin controls
  if (isAdmin) {
    revealBtn.style.display = "none";
    resetBtn.style.display = "inline-flex";
  }

  // Disable submit button
  if (submitBtn) {
    submitBtn.disabled = true;
  }
}

// Reset voting UI
function resetVotingUI() {
  // Reset selection
  selectedCard = null;
  document
    .querySelectorAll(".poker-card")
    .forEach((c) => c.classList.remove("selected"));
  updateSelectionDisplay();

  // Hide results
  if (resultsSection) {
    resultsSection.style.display = "none";
  }

  // Show cards section
  if (cardsSection) {
    cardsSection.style.opacity = "1";
    cardsSection.style.pointerEvents = "auto";
  }

  // Update admin controls
  if (isAdmin) {
    revealBtn.style.display = "inline-flex";
    resetBtn.style.display = "none";
  }

  // Enable submit button
  if (submitBtn) {
    submitBtn.disabled = false;
  }
}

// Handle submit
function handleSubmit() {
  if (!selectedCard) {
    if (validationError) {
      validationError.classList.add("show");
    }
    return;
  }

  if (!socket || !roomId) {
    showErrorToast("Not connected to room");
    return;
  }

  socket.emit("vote:submit", {
    roomId: roomId,
    point: selectedCard.value,
  });

  showToast(`Vote submitted: ${selectedCard.emoji} ${selectedCard.value} points`);
}

// Handle reveal (admin only)
function handleReveal() {
  if (!socket || !roomId || !isAdmin) {
    showErrorToast("Not authorized");
    return;
  }

  socket.emit("votes:reveal", {
    roomId: roomId
  });
}

// Handle reset (admin only)
function handleReset() {
  if (!socket || !roomId || !isAdmin) {
    showErrorToast("Not authorized");
    return;
  }

  socket.emit("votes:reset", {
    roomId: roomId
  });
}

// Handle end session (admin only)
function handleEndSession() {
  if (!socket || !roomId || !isAdmin) {
    showErrorToast("Not authorized");
    return;
  }

  if (confirm("Are you sure you want to end this session?")) {
    socket.emit("room:end", {
      roomId: roomId
    });
  }
}

// Copy room link
function copyRoomLink() {
  if (roomLinkInput) {
    roomLinkInput.select();
    navigator.clipboard.writeText(roomLinkInput.value).then(() => {
      showToast("Link copied to clipboard! 📋");
    });
  }
}

// Start timer
function startTimer() {
  const ROOM_DURATION = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, ROOM_DURATION - elapsed);

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (timerDisplay) {
      timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      // Warning color when less than 2 minutes
      if (remaining < 2 * 60 * 1000) {
        timerDisplay.style.color = "#ef4444";
      }
    }

    if (remaining === 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

// Show toast
function showToast(message) {
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Show error toast
function showErrorToast(message) {
  if (!errorToast || !errorToastMessage) return;

  errorToastMessage.textContent = message;
  errorToast.classList.add("show");
  setTimeout(() => {
    errorToast.classList.remove("show");
  }, 4000);
}