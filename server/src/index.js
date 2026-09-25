import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { RoomManager } from "./rooms.js";

const PORT = process.env.PORT || 4000;
const TURN_SECONDS = 25;
const NEXT_HAND_DELAY_MS = 4000;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new RoomManager();
const socketRoom = new Map(); // socketId -> roomId
const turnTimers = new Map(); // roomId -> Timeout
const nextHandTimers = new Map(); // roomId -> Timeout

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
  const timer = setTimeout(() => {
    const seat = table.seats[table.actingSeat];
    if (!seat) return;
    try {
      const actions = table.validActions(table.actingSeat);
      table.handleAction(table.actingSeat, actions.includes("check") ? "check" : "fold");
    } catch {
      // ignore stale timer race
    }
    afterAction(table);
  }, TURN_SECONDS * 1000);
  turnTimers.set(table.id, timer);
}

function afterAction(table) {
  broadcast(table);
  if (table.street === "showdown") {
    clearTurnTimer(table.id);
    const existing = nextHandTimers.get(table.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      table.finishHandCleanup();
      if (table.canStartHand()) {
        table.startHand();
        broadcast(table);
        armTurnTimer(table);
      } else {
        broadcast(table);
      }
    }, NEXT_HAND_DELAY_MS);
    nextHandTimers.set(table.id, timer);
  } else {
    armTurnTimer(table);
  }
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, smallBlind, bigBlind, startingStack }, ack) => {
    const table = rooms.createRoom({
      smallBlind: Number(smallBlind) || 10,
      bigBlind: Number(bigBlind) || 20,
      startingStack: Number(startingStack) || 1000,
    });
    const seat = table.addPlayer(socket.id, (name || "Player").slice(0, 20));
    socket.join(table.id);
    socketRoom.set(socket.id, table.id);
    ack?.({ ok: true, roomId: table.id, seat });
    broadcast(table);
  });

  socket.on("joinRoom", ({ roomId, name }, ack) => {
    const table = rooms.get(roomId);
    if (!table) return ack?.({ ok: false, error: "Room not found" });
    const seat = table.addPlayer(socket.id, (name || "Player").slice(0, 20));
    if (seat === null) return ack?.({ ok: false, error: "Table is full" });
    socket.join(table.id);
    socketRoom.set(socket.id, table.id);
    ack?.({ ok: true, roomId: table.id, seat });
    broadcast(table);
  });

  socket.on("startHand", () => {
    const table = rooms.get(socketRoom.get(socket.id));
    if (!table || !table.canStartHand()) return;
    table.startHand();
    broadcast(table);
    armTurnTimer(table);
  });

  socket.on("action", ({ action, amount }) => {
    const table = rooms.get(socketRoom.get(socket.id));
    if (!table) return;
    const seatIndex = table.seats.findIndex((p) => p && p.id === socket.id);
    if (seatIndex === -1) return;
    try {
      table.handleAction(seatIndex, action, Number(amount) || 0);
      afterAction(table);
    } catch (err) {
      socket.emit("actionError", { message: err.message });
    }
  });

  socket.on("leaveRoom", () => handleLeave(socket));
  socket.on("disconnect", () => handleLeave(socket));
});

function handleLeave(socket) {
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;
  const table = rooms.get(roomId);
  socketRoom.delete(socket.id);
  if (!table) return;
  table.removePlayer(socket.id);
  socket.leave(roomId);
  if (table.occupiedSeats().length === 0) {
    clearTurnTimer(roomId);
    const t = nextHandTimers.get(roomId);
    if (t) clearTimeout(t);
    nextHandTimers.delete(roomId);
    rooms.remove(roomId);
  } else {
    broadcast(table);
  }
}

server.listen(PORT, () => console.log(`Poker server listening on :${PORT}`));
