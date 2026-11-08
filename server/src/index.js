import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { RoomManager } from "./rooms.js";
import { decideBotAction as decideHoldemBotAction } from "./game/bot.js";
import { decideBluffBotAction, bluffAutoAction } from "./game/bluff_bot.js";

const BOT_NAMES = ["Ace Bot", "Rio", "Vegas Vic", "Pinky", "Chip"];
const BOT_THINK_MS = [700, 1500];

const PORT = process.env.PORT || 4300;
const TURN_SECONDS = 25;
const NEXT_ROUND_DELAY_MS = 4000;
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 60_000;

// Every game engine (Hold'em's Table, BluffGame, and future additions) is driven through this
// adapter so the turn/round orchestration below stays game-agnostic. Each engine keeps its own
// natural method names (e.g. Table.startHand vs BluffGame.start) — the adapter maps them to a
// common shape instead of forcing a shared base class onto already-tested code.
const GAMES = {
  holdem: {
    isRoundOver: (t) => t.street === "showdown",
    finishRound: (t) => t.finishHandCleanup(),
    canStart: (t) => t.canStartHand(),
    start: (t) => t.startHand(),
    decideBot: (t, seatIndex) => {
      const d = decideHoldemBotAction(t, seatIndex);
      return d ? { action: d.action, payload: { amount: d.amount || 0 } } : null;
    },
    timeoutFallback: (t, seatIndex) => {
      const actions = t.validActions(seatIndex);
      return { action: actions.includes("check") ? "check" : "fold", payload: {} };
    },
    applyAction: (t, seatIndex, action, payload) => t.handleAction(seatIndex, action, Number(payload?.amount) || 0),
  },
  bluff: {
    isRoundOver: (g) => g.phase === "roundOver",
    finishRound: (g) => g.finishRoundCleanup(),
    canStart: (g) => g.canStart(),
    start: (g) => g.start(),
    decideBot: (g, seatIndex) => decideBluffBotAction(g, seatIndex),
    timeoutFallback: (g, seatIndex) => bluffAutoAction(g, seatIndex),
    applyAction: (g, seatIndex, action, payload) => g.handleAction(seatIndex, action, payload || {}),
  },
};

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new RoomManager();
const socketRoom = new Map(); // socketId -> roomId
const turnTimers = new Map(); // roomId -> Timeout
const nextRoundTimers = new Map(); // roomId -> Timeout
// A browser tab keeps one session token across refreshes and dropped connections, so a player
// who reconnects within the grace period gets their seat back instead of being removed.
const sessions = new Map(); // token -> { roomId, socketId, graceTimer }

function broadcast(table) {
  for (const seat of table.seats) {
    if (!seat) continue;
    io.to(seat.id).emit("state", table.getPublicState(seat.id));
  }
}

function clearTurnTimer(roomId) {
  const t = turnTimers.get(roomId);
  if (t) clearTimeout(t);
  turnTimers.delete(roomId);
}

function armTurnTimer(table) {
  clearTurnTimer(table.id);
  if (table.actingSeat === -1) return;
  const games = GAMES[table.gameType];
  const seat = table.seats[table.actingSeat];
  const isBot = seat?.isBot;
  const delay = isBot
    ? BOT_THINK_MS[0] + Math.random() * (BOT_THINK_MS[1] - BOT_THINK_MS[0])
    : TURN_SECONDS * 1000;
  const timer = setTimeout(() => {
    const actingSeat = table.actingSeat;
    const seat = table.seats[actingSeat];
    if (!seat) return;
    try {
      const decision = (seat.isBot && games.decideBot(table, actingSeat)) || games.timeoutFallback(table, actingSeat);
      games.applyAction(table, actingSeat, decision.action, decision.payload);
    } catch {
      // ignore stale timer race
    }
    afterAction(table);
  }, delay);
  turnTimers.set(table.id, timer);
}

function afterAction(table) {
  broadcast(table);
  const games = GAMES[table.gameType];
  if (games.isRoundOver(table)) {
    clearTurnTimer(table.id);
    const existing = nextRoundTimers.get(table.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      games.finishRound(table);
      if (games.canStart(table)) {
        games.start(table);
        broadcast(table);
        armTurnTimer(table);
      } else {
        broadcast(table);
      }
    }, NEXT_ROUND_DELAY_MS);
    nextRoundTimers.set(table.id, timer);
  } else {
    armTurnTimer(table);
  }
}

function joinSocketToRoom(socket, token, table) {
  socket.join(table.id);
  socketRoom.set(socket.id, table.id);
  sessions.set(token, { roomId: table.id, socketId: socket.id, graceTimer: null });
}

// Rebinds a returning tab's seat to its new socket. Returns the table, or null if there's no seat to resume.
function resumeSession(socket, token) {
  const session = sessions.get(token);
  const table = session && rooms.get(session.roomId);
  const seat = table?.seats.find((p) => p && p.id === session.socketId && !p.left);
  if (!seat) {
    sessions.delete(token);
    return null;
  }
  clearTimeout(session.graceTimer);
  const oldSocketId = session.socketId;
  seat.id = socket.id;
  seat.connected = true;
  socketRoom.delete(oldSocketId);
  joinSocketToRoom(socket, token, table);
  // Same token still connected elsewhere (e.g. a duplicated tab): the newest connection takes the seat.
  io.sockets.sockets.get(oldSocketId)?.disconnect(true);
  io.to(table.id).except(socket.id).emit("voicePeerLeft", { peerId: oldSocketId });
  return table;
}

io.on("connection", (socket) => {
  const rawToken = socket.handshake.auth?.token;
  const token = typeof rawToken === "string" && rawToken ? rawToken.slice(0, 64) : socket.id;

  const resumed = resumeSession(socket, token);
  socket.emit("session", resumed ? { roomId: resumed.id, gameType: resumed.gameType } : { roomId: null });
  if (resumed) broadcast(resumed);

  socket.on("createGameRoom", ({ gameType, name, options }, ack) => {
    try {
      leaveRoom(socket.id, token);
      const table = rooms.createRoom(gameType, options || {});
      const seat = table.addPlayer(socket.id, (name || "Player").slice(0, 20));
      joinSocketToRoom(socket, token, table);
      ack?.({ ok: true, roomId: table.id, seat, gameType });
      broadcast(table);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("createGameBotRoom", ({ gameType, name, options, botCount }, ack) => {
    try {
      leaveRoom(socket.id, token);
      const table = rooms.createRoom(gameType, options || {});
      const seat = table.addPlayer(socket.id, (name || "Player").slice(0, 20));
      const maxBots = table.seats.length - 1;
      const bots = Math.min(Math.max(Number(botCount) || 3, 1), maxBots);
      for (let i = 0; i < bots; i++) table.addBot(BOT_NAMES[i % BOT_NAMES.length]);
      joinSocketToRoom(socket, token, table);
      ack?.({ ok: true, roomId: table.id, seat, gameType });
      const games = GAMES[gameType];
      if (games.canStart(table)) {
        games.start(table);
        armTurnTimer(table);
      }
      broadcast(table);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("joinGameRoom", ({ roomId, name }, ack) => {
    const table = rooms.get(roomId);
    if (!table) return ack?.({ ok: false, error: "Room not found" });
    if (table.id === socketRoom.get(socket.id)) return ack?.({ ok: false, error: "You're already at this table" });
    leaveRoom(socket.id, token);
    const seat = table.addPlayer(socket.id, (name || "Player").slice(0, 20));
    if (seat === null) return ack?.({ ok: false, error: "Table is full" });
    joinSocketToRoom(socket, token, table);
    ack?.({ ok: true, roomId: table.id, seat, gameType: table.gameType });
    broadcast(table);
  });

  socket.on("startGame", () => {
    const table = rooms.get(socketRoom.get(socket.id));
    if (!table) return;
    const games = GAMES[table.gameType];
    if (!games.canStart(table)) return;
    games.start(table);
    broadcast(table);
    armTurnTimer(table);
  });

  socket.on("gameAction", ({ action, payload }) => {
    const table = rooms.get(socketRoom.get(socket.id));
    if (!table) return;
    const seatIndex = table.seats.findIndex((p) => p && p.id === socket.id);
    if (seatIndex === -1) return;
    const games = GAMES[table.gameType];
    try {
      games.applyAction(table, seatIndex, action, payload);
      afterAction(table);
    } catch (err) {
      socket.emit("actionError", { message: err.message });
    }
  });

  socket.on("voiceJoin", () => {
    const roomId = socketRoom.get(socket.id);
    const table = rooms.get(roomId);
    if (!table) return;
    const mySeat = table.seats.findIndex((p) => p && p.id === socket.id);
    if (mySeat === -1) return;
    const peers = table
      .occupiedSeats()
      .filter((i) => i !== mySeat)
      .map((i) => ({ peerId: table.seats[i].id, seat: i }));
    socket.emit("voicePeers", { peers });
    socket.to(roomId).emit("voicePeerJoined", { peerId: socket.id, seat: mySeat });
  });

  socket.on("voiceLeave", () => {
    const roomId = socketRoom.get(socket.id);
    if (roomId) socket.to(roomId).emit("voicePeerLeft", { peerId: socket.id });
  });

  socket.on("voiceSignal", ({ to, data }) => {
    // Only relay between players at the same table.
    if (!to || !socketRoom.get(socket.id) || socketRoom.get(to) !== socketRoom.get(socket.id)) return;
    io.to(to).emit("voiceSignal", { from: socket.id, data });
  });

  socket.on("voiceMute", ({ muted }) => {
    const roomId = socketRoom.get(socket.id);
    if (roomId) socket.to(roomId).emit("voiceMute", { peerId: socket.id, muted });
  });

  socket.on("voiceSpeaking", ({ speaking }) => {
    const roomId = socketRoom.get(socket.id);
    if (roomId) socket.to(roomId).emit("voiceSpeaking", { peerId: socket.id, speaking });
  });

  socket.on("chatMessage", ({ text }) => {
    const roomId = socketRoom.get(socket.id);
    const table = rooms.get(roomId);
    if (!table) return;
    const seatIndex = table.seats.findIndex((p) => p && p.id === socket.id);
    if (seatIndex === -1) return;
    const trimmed = String(text || "").trim().slice(0, 240);
    if (!trimmed) return;
    io.to(roomId).emit("chatMessage", {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      seat: seatIndex,
      name: table.seats[seatIndex].name,
      text: trimmed,
      ts: Date.now(),
    });
  });

  socket.on("leaveRoom", () => leaveRoom(socket.id, token));
  socket.on("disconnect", () => {
    const roomId = socketRoom.get(socket.id);
    const session = sessions.get(token);
    const table = rooms.get(roomId);
    const seat = table?.seats.find((p) => p && p.id === socket.id);
    if (!seat || session?.socketId !== socket.id) return leaveRoom(socket.id, token);
    // Hold the seat for a while; the turn timer keeps the game moving if it's their turn.
    seat.connected = false;
    io.to(roomId).emit("voicePeerLeft", { peerId: socket.id });
    broadcast(table);
    session.graceTimer = setTimeout(() => leaveRoom(socket.id, token), RECONNECT_GRACE_MS);
  });
});

function leaveRoom(socketId, token) {
  const session = sessions.get(token);
  if (session?.socketId === socketId) {
    clearTimeout(session.graceTimer);
    sessions.delete(token);
  }
  const roomId = socketRoom.get(socketId);
  if (!roomId) return;
  socketRoom.delete(socketId);
  io.to(roomId).except(socketId).emit("voicePeerLeft", { peerId: socketId });
  io.in(socketId).socketsLeave(roomId);
  const table = rooms.get(roomId);
  if (!table) return;
  table.removePlayer(socketId);
  const remainingHumans = table.occupiedSeats().filter((i) => !table.seats[i].isBot && !table.seats[i].left);
  if (remainingHumans.length === 0) {
    clearTurnTimer(roomId);
    const t = nextRoundTimers.get(roomId);
    if (t) clearTimeout(t);
    nextRoundTimers.delete(roomId);
    rooms.remove(roomId);
  } else {
    // Leaving can end the round or pass the turn, so re-run the same orchestration as an action.
    afterAction(table);
  }
}

server.listen(PORT, () => console.log(`Poker server listening on :${PORT}`));
