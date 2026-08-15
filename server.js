import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { GameRoom, makeCode } from "./src/room.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  cors: { origin: "*" },
  transports: ["polling", "websocket"],
  pingTimeout: 20000,
  pingInterval: 8000,
  allowEIO3: true,
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

const rooms = new Map();

function uniqueCode() {
  for (let i = 0; i < 40; i++) {
    const code = makeCode();
    if (!rooms.has(code)) return code;
  }
  return makeCode() + makeCode();
}

io.on("connection", (socket) => {
  socket.on("create", ({ name }) => {
    leaveCurrent(socket);
    const code = uniqueCode();
    const room = new GameRoom(code, io);
    rooms.set(code, room);
    const res = room.addPlayer(socket, name);
    if (res.error) {
      rooms.delete(code);
      socket.emit("err", res.error);
      return;
    }
    socket.data.code = code;
    socket.emit("joined", { id: socket.id, ...room.lobbyPayload() });
  });

  socket.on("join", ({ name, code }) => {
    const key = String(code || "")
      .trim()
      .toUpperCase();
    const room = rooms.get(key);
    if (!room) {
      socket.emit("err", "Izba neexistuje. Skontroluj kód.");
      return;
    }
    leaveCurrent(socket);
    const res = room.addPlayer(socket, name);
    if (res.error) {
      socket.emit("err", res.error);
      return;
    }
    socket.data.code = key;
    socket.emit("joined", { id: socket.id, ...room.lobbyPayload() });
  });

  socket.on("mode", (mode) => {
    rooms.get(socket.data.code)?.setMode(socket.id, mode);
  });

  socket.on("arena", (arenaId) => {
    rooms.get(socket.data.code)?.setArena(socket.id, arenaId);
  });

  socket.on("start", () => {
    rooms.get(socket.data.code)?.start(socket.id);
  });

  socket.on("lobby", () => {
    rooms.get(socket.data.code)?.backToLobby(socket.id);
  });

  socket.on("leave", () => {
    leaveCurrent(socket);
    socket.emit("left");
  });

  socket.on("in", (data) => {
    rooms.get(socket.data.code)?.setInput(socket.id, data || {});
  });

  socket.on("nade", (data) => {
    rooms.get(socket.data.code)?.requestGrenade(socket.id, data || {});
  });

  socket.on("disconnect", () => {
    leaveCurrent(socket);
  });
});

function leaveCurrent(socket) {
  const code = socket.data.code;
  if (!code) return;
  const room = rooms.get(code);
  socket.data.code = null;
  if (!room) return;
  const result = room.removePlayer(socket.id);
  socket.leave(code);
  if (result === "empty") rooms.delete(code);
}

const DT = 1 / 60;
setInterval(() => {
  for (const room of rooms.values()) room.step(DT);
}, 1000 * DT);

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.size === 0) continue;
    io.to(room.code).emit("st", room.snapshot());
  }
}, 33);

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Blob Battle → http://localhost:${PORT}`);
});
