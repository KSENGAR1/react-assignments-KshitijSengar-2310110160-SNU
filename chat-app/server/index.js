import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const messages = []; // in-memory history
let nextId = 1;

io.on("connection", (socket) => {
  socket.emit("chat:history", messages);

  socket.on("chat:message", ({ user, text }) => {
    if (typeof text !== "string" || !text.trim()) return;
    const msg = { id: nextId++, user, text: text.slice(0, 1000), likes: 0, time: Date.now() };
    messages.push(msg);
    io.emit("chat:message", msg);
  });

  socket.on("chat:like", (id) => {
    const msg = messages.find((m) => m.id === id);
    if (msg) { msg.likes++; io.emit("chat:like", { id, likes: msg.likes }); }
  });
});

server.listen(4000, () => console.log("Socket.io server on http://localhost:4000"));
