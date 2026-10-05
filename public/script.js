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
  { value: 100, emoji: "💀", label: "Epic!" },
];

const LOW_TIME_MS = 2 * 60 * 1000; // also the window in which the room can be extended
const SHORTCUT_PAUSE_MS = 600;

const VOTE_TIMEOUT_MS = 5000;

// State
let votedCard = null; // the card the server has confirmed for this round
let pendingCard = null; // the card being sent right now
let voteError = false;
let socket = null;
let isAdmin = false;
let userName = null;
let adminName = null;
let roomId = null;
let timerInterval = null;
let revealed = false;
let roomExtended = false;

// DOM Elements
const cardsGrid = document.getElementById("cardsGrid");
const selectionDisplay = document.getElementById("selectionDisplay");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const errorToast = document.getElementById("errorToast");
const errorToastMessage = document.getElementById("errorToastMessage");
const membersGrid = document.getElementById("membersGrid");
const tableMeta = document.getElementById("tableMeta");
const adminControls = document.getElementById("adminControls");
const revealBtn = document.getElementById("revealBtn");
const resetBtn = document.getElementById("resetBtn");
const endBtn = document.getElementById("endBtn");
const revealCount = document.getElementById("revealCount");
const endDialog = document.getElementById("endDialog");
const extendPrompt = document.getElementById("extendPrompt");
const extendBtn = document.getElementById("extendBtn");
const resultsSection = document.getElementById("resultsSection");
const averageValue = document.getElementById("averageValue");
const averageNearest = document.getElementById("averageNearest");
const announcer = document.getElementById("announcer");
const votesBreakdown = document.getElementById("votesBreakdown");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const roomTimer = document.getElementById("roomTimer");
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Get room data from data attributes
function getRoomData() {
  if (!roomDataElement) return null;

  return {
    roomId: roomDataElement.dataset.roomId,
    taskTitle: roomDataElement.dataset.taskTitle,
    taskDescription: roomDataElement.dataset.taskDescription,
    adminName: roomDataElement.dataset.adminName,
    userName: roomDataElement.dataset.userName,
    isAdmin: roomDataElement.dataset.isAdmin === "true",
  };
}

// Initialize room
function initializeRoom() {
  const roomData = getRoomData();
  if (!roomData) return;

  // Set state from data attributes
  roomId = roomData.roomId;
  userName = roomData.userName;
  adminName = roomData.adminName;
  isAdmin = roomData.isAdmin;

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", copyRoomLink);
  }

  if (cardsGrid) {
    renderCards();
  }

  if (revealBtn) {
    revealBtn.addEventListener("click", handleReveal);
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", handleReset);
  }
  if (endBtn) {
    endBtn.addEventListener("click", handleEndSession);
  }
  if (extendBtn) {
    extendBtn.addEventListener("click", handleExtend);
  }
  document.addEventListener("keydown", handleShortcut);
  if (endDialog) {
    endDialog.addEventListener("close", () => {
      if (endDialog.returnValue === "end") {
        endSession();
      }
      endDialog.returnValue = "";
    });
  }

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
      name: userName,
    });
  });

  socket.on("room:joined", (data) => {
    console.log("Joined room:", data);
    isAdmin = data.isAdmin;
    userName = data.userName;
    adminName = data.room.adminName || adminName;

    updateMembersGrid(data.room.members);

    if (isAdmin && adminControls) {
      adminControls.hidden = false;
    }

    // Restore this member's own vote after a reload or reconnect.
    votedCard =
      data.myVote === null || data.myVote === undefined
        ? null
        : cards.find((c) => c.value === Number(data.myVote)) || null;
    pendingCard = null;
    voteError = false;
    syncDeck();

    if (data.room.revealed) {
      showResults(data.room.members, data.room.average);
    }

    roomExtended = Boolean(data.room.extended);
    startTimer(data.room.expiresAt, data.serverNow);

    showToast(`Welcome, ${userName}`);
  });

  socket.on("room:memberJoined", (data) => {
    console.log("Member joined:", data);
    updateMembersGrid(data.members);
    showToast(`${data.member.name} joined the room`);
  });

  socket.on("room:memberLeft", (data) => {
    console.log("Member left:", data);
    updateMembersGrid(data.members);
    showToast(`${data.memberName} left the room`);
  });

  socket.on("room:memberDisconnected", (data) => {
    console.log("Member disconnected:", data);
    updateMembersGrid(data.members);
    showToast(`${data.memberName} lost connection`);
  });

  socket.on("room:memberReconnected", (data) => {
    console.log("Member reconnected:", data);
    updateMembersGrid(data.members);
    showToast(`${data.memberName} is back`);
  });

  socket.on("vote:updated", (data) => {
    console.log("Vote updated:", data);
    updateMembersGrid(data.members);
  });

  socket.on("votes:revealed", (data) => {
    console.log("Votes revealed:", data);
    showResults(data.members, data.average);
    announceReveal(data.members, data.average);
    bringResultsIntoView();
  });

  socket.on("votes:reset", (data) => {
    console.log("Votes reset:", data);
    resetVotingUI();
    updateMembersGrid(data.members);
    announce("");
    showToast("New round started");
  });

  socket.on("room:extended", (data) => {
    roomExtended = true;
    startTimer(data.expiresAt, data.serverNow);
    showToast("The room has 5 more minutes");
  });

  socket.on("room:ended", (data) => {
    showErrorToast(data.message);
    setTimeout(() => {
      window.location.href = "/play";
    }, 2000);
  });

  socket.on("room:expired", (data) => {
    showErrorToast(data.message);
    setTimeout(() => {
      window.location.href = "/play";
    }, 2000);
  });

  socket.on("room:error", (data) => {
    console.error("Room error:", data);
    showErrorToast(data.message);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    showErrorToast("Connection lost. Reconnecting…");
  });

  socket.on("reconnect", () => {
    console.log("Reconnected to server");
    showToast("Reconnected");
  });
}

// Generate cards
function renderCards() {
  if (!cardsGrid) return;

  cardsGrid.innerHTML = cards
    .map(
      (card, index) => `
        <button type="button" class="card" aria-pressed="false"
          tabindex="${index === 0 ? "0" : "-1"}"
          data-index="${index}" data-value="${card.value}"
          aria-label="${card.value} points, ${card.label}">
          <span class="card-corner" aria-hidden="true">${card.value}</span>
          <span class="card-number" aria-hidden="true">${card.value}</span>
          <span class="card-emoji" aria-hidden="true">${card.emoji}</span>
          <span class="card-label" aria-hidden="true">${card.label}</span>
        </button>
      `,
    )
    .join("");

  const cardButtons = [...cardsGrid.querySelectorAll(".card")];
  cardButtons.forEach((button, index) => {
    button.addEventListener("click", () => castVote(cards[index]));
    // Arrow keys move focus only; Enter or Space casts the vote.
    button.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
        event.key
      ];
      if (!step) return;
      event.preventDefault();
      const next =
        cardButtons[(index + step + cardButtons.length) % cardButtons.length];
      cardButtons.forEach((b) => (b.tabIndex = b === next ? 0 : -1));
      next.focus();
    });
  });
}

// One tap is the vote: send it immediately; another tap changes it.
function castVote(card) {
  if (revealed || !card || pendingCard) return;
  if (votedCard && votedCard.value === card.value && !voteError) return;

  if (!socket || !socket.connected || !roomId) {
    voteError = true;
    syncDeck();
    showErrorToast("Not connected. Your vote wasn't sent.");
    return;
  }

  pendingCard = card;
  voteError = false;
  syncDeck();

  socket
    .timeout(VOTE_TIMEOUT_MS)
    .emit("vote:submit", { roomId: roomId, point: card.value }, (err, res) => {
      pendingCard = null;
      if (err || !res || !res.ok) {
        voteError = true;
        showErrorToast(
          (res && res.message) || "Your vote wasn't sent. Tap the card again.",
        );
      } else {
        votedCard = card;
        voteError = false;
      }
      syncDeck();
    });
}

// Reflect the vote state on the cards and the status line.
function syncDeck() {
  if (cardsGrid) {
    const buttons = [...cardsGrid.querySelectorAll(".card")];
    const shown = pendingCard || votedCard;
    buttons.forEach((button) => {
      const isShown = shown !== null && shown.value === Number(button.dataset.value);
      button.setAttribute("aria-pressed", String(isShown));
      button.classList.toggle("is-sending", isShown && pendingCard !== null);
      button.disabled = revealed;
      if (isShown) {
        buttons.forEach((b) => (b.tabIndex = b === button ? 0 : -1));
      }
    });
  }
  updateVoteStatus();
}

function pointsLabel(card) {
  return `${card.value} ${card.value === 1 ? "point" : "points"}`;
}

function updateVoteStatus() {
  if (!selectionDisplay) return;

  selectionDisplay.classList.toggle("is-error", voteError && !revealed);

  if (revealed) {
    const yours = votedCard ? `You voted ${pointsLabel(votedCard)}. ` : "You didn't vote. ";
    selectionDisplay.textContent =
      yours +
      (isAdmin ? "Start a new round when ready." : "Waiting for the facilitator.");
  } else if (pendingCard) {
    selectionDisplay.textContent = `Sending ${pointsLabel(pendingCard)}…`;
  } else if (voteError) {
    selectionDisplay.textContent = votedCard
      ? `Change not sent. Your vote is still ${pointsLabel(votedCard)}.`
      : "Not sent. Tap a card to try again.";
  } else if (votedCard) {
    selectionDisplay.innerHTML = `<strong>Sent · ${pointsLabel(votedCard)}</strong> · tap another card to change`;
  } else {
    selectionDisplay.textContent = "Tap a card to vote";
  }
}

function plaqueState(member) {
  if (member.connected === false) return { className: "is-offline", text: "Offline" };
  if (member.point !== null) return { className: "is-revealed is-voted", text: "Voted" };
  if (member.hasVoted) return { className: "is-voted", text: "Voted" };
  return { className: "is-waiting", text: revealed ? "Didn't vote" : "Choosing…" };
}

// Update members grid
function updateMembersGrid(members) {
  if (!membersGrid) return;

  const connected = members.filter((m) => m.connected !== false);
  const voted = connected.filter((m) => m.hasVoted).length;

  if (tableMeta) {
    tableMeta.innerHTML = revealed
      ? `${members.length} at the table`
      : `<strong>${voted}</strong> of ${connected.length} voted`;
  }

  if (revealCount && revealBtn) {
    revealCount.textContent = `${voted}/${connected.length}`;
    revealBtn.setAttribute(
      "aria-label",
      `Reveal votes, ${voted} of ${connected.length} voted`,
    );
  }

  membersGrid.innerHTML = members
    .map((member, index) => {
      const state = plaqueState(member);
      const isSelf = member.name === userName;
      const isFacilitator = member.name === adminName;
      const number = member.point !== null ? escapeHtml(member.point) : "";
      const role = isFacilitator
        ? '<span class="plaque-role">Facilitator</span>'
        : "";
      const you = isSelf ? ' · <span class="plaque-you">You</span>' : "";
      return `
        <li class="plaque ${state.className} ${isSelf ? "is-self" : ""}" style="--i: ${index}">
          <span class="plaque-name" title="${escapeHtml(member.name)}">${escapeHtml(member.name)}</span>
          <span class="plaque-state">${state.text}${you}${role}</span>
          <span class="plaque-number">${number}</span>
        </li>
      `;
    })
    .join("");
}

// Show results
function showResults(members, average) {
  if (!resultsSection || !votesBreakdown || !averageValue) return;

  revealed = true;
  updateMembersGrid(members);

  averageValue.textContent = average ?? "–";
  if (averageNearest) {
    const nearest = nearestCard(average);
    averageNearest.innerHTML = nearest
      ? `Nearest card <strong>${nearest.value}</strong>`
      : "";
  }

  const voteDistribution = {};
  members.forEach((m) => {
    if (m.point !== null) {
      voteDistribution[m.point] = (voteDistribution[m.point] || 0) + 1;
    }
  });

  const sortedVotes = Object.entries(voteDistribution).sort(
    (a, b) => parseInt(a[0]) - parseInt(b[0]),
  );
  const topCount = Math.max(0, ...sortedVotes.map(([, count]) => count));

  votesBreakdown.innerHTML = sortedVotes.length
    ? sortedVotes
        .map(([value, count]) => {
          const card = cards.find((c) => c.value === parseInt(value));
          const blocks = '<span class="split-block"></span>'.repeat(count);
          const label = `${count} ${count === 1 ? "vote" : "votes"} for ${escapeHtml(value)}`;
          return `
            <li class="split-row ${count === topCount ? "is-top" : ""}" aria-label="${label}">
              <span class="split-value">${escapeHtml(value)}<span class="split-value-emoji" aria-hidden="true">${card ? card.emoji : ""}</span></span>
              <span class="split-blocks" aria-hidden="true">${blocks}</span>
              <span class="split-count" aria-hidden="true">×${count}</span>
            </li>
          `;
        })
        .join("")
    : '<li class="plaques-empty">Nobody voted this round.</li>';

  resultsSection.hidden = false;

  if (cardsSection) {
    cardsSection.classList.add("is-locked");
  }

  if (isAdmin) {
    revealBtn.hidden = true;
    resetBtn.hidden = false;
  }

  syncDeck();
}

// The deck value closest to the average; ties go to the larger card,
// since teams usually settle a split upward.
function nearestCard(average) {
  if (average === null || average === undefined || average === "") return null;
  const target = Number(average);
  if (Number.isNaN(target)) return null;
  return cards.reduce((best, card) => {
    const d = Math.abs(card.value - target);
    const bestD = Math.abs(best.value - target);
    return d < bestD || (d === bestD && card.value > best.value) ? card : best;
  });
}

function announce(message) {
  if (announcer) announcer.textContent = message;
}

// Screen readers hear the outcome, not just a silent re-render.
function announceReveal(members, average) {
  const counts = {};
  members.forEach((m) => {
    if (m.point !== null) counts[m.point] = (counts[m.point] || 0) + 1;
  });
  const split = Object.entries(counts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([value, count]) => `${count} for ${value}`)
    .join(", ");
  const nearest = nearestCard(average);
  announce(
    split
      ? `Votes revealed. Average ${average}${nearest ? `, nearest card ${nearest.value}` : ""}. ${split}.`
      : "Votes revealed. Nobody voted this round.",
  );
}

// After a live reveal, let the plaque stamps land, then glide the split into
// view if it is mostly off-screen (large tables on narrow windows).
function bringResultsIntoView() {
  if (!resultsSection) return;
  setTimeout(() => {
    const { top } = resultsSection.getBoundingClientRect();
    if (top < window.innerHeight * 0.6) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsSection.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, 700);
}

// Reset voting UI
function resetVotingUI() {
  revealed = false;
  votedCard = null;
  pendingCard = null;
  voteError = false;
  syncDeck();

  if (resultsSection) {
    resultsSection.hidden = true;
  }

  if (cardsSection) {
    cardsSection.classList.remove("is-locked");
  }

  if (isAdmin) {
    revealBtn.hidden = false;
    resetBtn.hidden = true;
  }

}

// Handle reveal (admin only)
function handleReveal() {
  if (!socket || !roomId || !isAdmin) {
    showErrorToast("Only the facilitator can reveal votes");
    return;
  }

  socket.emit("votes:reveal", {
    roomId: roomId,
  });
}

// Handle reset (admin only)
function handleReset() {
  if (!socket || !roomId || !isAdmin) {
    showErrorToast("Only the facilitator can start a new round");
    return;
  }

  socket.emit("votes:reset", {
    roomId: roomId,
  });
}

// Handle end session (admin only)
function handleEndSession() {
  if (!socket || !roomId || !isAdmin) {
    showErrorToast("Only the facilitator can end the session");
    return;
  }

  if (endDialog && typeof endDialog.showModal === "function") {
    endDialog.returnValue = "";
    endDialog.showModal();
  } else if (confirm("End this session for everyone? The room will close.")) {
    endSession();
  }
}

function endSession() {
  socket.emit("room:end", {
    roomId: roomId,
  });
}

// Add the room's one extension (facilitator only)
function handleExtend() {
  if (!socket || !roomId || !isAdmin) return;
  extendBtn.disabled = true;
  socket
    .timeout(5000)
    .emit("room:extend", { roomId: roomId }, (err, res) => {
      extendBtn.disabled = false;
      if (err || !res || !res.ok) {
        showErrorToast((res && res.message) || "Couldn't add time. Try again.");
      }
    });
}

// Keyboard: type a card's number to vote; Shift+R reveals, Shift+N starts a round.
let shortcutBuffer = "";
let shortcutTimer = null;

function handleShortcut(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const target = event.target;
  if (
    target.closest("input, textarea, select, [contenteditable]") ||
    (endDialog && endDialog.open)
  ) {
    return;
  }

  if (event.shiftKey && isAdmin) {
    const key = event.key.toLowerCase();
    if (key === "r" && revealBtn && !revealBtn.hidden) {
      event.preventDefault();
      handleReveal();
    } else if (key === "n" && resetBtn && !resetBtn.hidden) {
      event.preventDefault();
      handleReset();
    }
    return;
  }

  if (!/^[0-9]$/.test(event.key) || revealed) return;
  event.preventDefault();

  shortcutBuffer += event.key;
  clearTimeout(shortcutTimer);

  const exact = cards.find((c) => String(c.value) === shortcutBuffer);
  const longer = cards.some(
    (c) => String(c.value).startsWith(shortcutBuffer) && String(c.value) !== shortcutBuffer,
  );

  if (exact && !longer) {
    shortcutBuffer = "";
    castVote(exact);
  } else if (!exact && !longer) {
    shortcutBuffer = "";
  } else {
    // "1" could become 13 or 100: wait briefly for the next digit.
    shortcutTimer = setTimeout(() => {
      const card = cards.find((c) => String(c.value) === shortcutBuffer);
      shortcutBuffer = "";
      if (card) castVote(card);
    }, SHORTCUT_PAUSE_MS);
  }
}

// Copy room link
function copyRoomLink() {
  if (!roomLinkInput) return;

  roomLinkInput.select();
  navigator.clipboard
    .writeText(roomLinkInput.value)
    .then(() => {
      showToast("Link copied. Paste it in the call chat.");
      copyLinkBtn.textContent = "Copied";
      setTimeout(() => {
        copyLinkBtn.textContent = "Copy link";
      }, 2000);
    })
    .catch(() => {
      showErrorToast("Couldn't copy. Select the link and copy it manually.");
    });
}

// Count down to the room's real expiry, corrected for local clock skew
function startTimer(expiresAt, serverNow) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  if (!expiresAt) return;

  const clockOffset = serverNow ? serverNow - Date.now() : 0;
  const countdownLabel = roomTimer?.querySelector(".countdown-label");
  if (countdownLabel) countdownLabel.textContent = "Closes in";

  const tick = () => {
    const remaining = Math.max(0, expiresAt - (Date.now() + clockOffset));
    // Round up so the display reaches 0:00 only when the room is due to close.
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (timerDisplay) {
      timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    if (roomTimer) {
      roomTimer.classList.toggle("is-low", remaining < LOW_TIME_MS);
    }

    if (extendPrompt) {
      extendPrompt.hidden = !(
        isAdmin && !roomExtended && remaining > 0 && remaining <= LOW_TIME_MS
      );
    }

    if (remaining === 0) {
      // The server sweeps expired rooms about once a minute and then redirects.
      if (countdownLabel) countdownLabel.textContent = "Closing";
      clearInterval(timerInterval);
    }
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

// Show toast
function showToast(message) {
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Show error toast
function showErrorToast(message) {
  if (!errorToast || !errorToastMessage) return;

  errorToastMessage.textContent = message;
  errorToast.classList.add("show");
  clearTimeout(showErrorToast.timeout);
  showErrorToast.timeout = setTimeout(() => {
    errorToast.classList.remove("show");
  }, 4000);
}
