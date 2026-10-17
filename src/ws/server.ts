import type { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import type { Match } from "../db/schema.js";

// Every message the server can push to clients; `type` lets clients switch on it safely.
export type ServerMessage =
  | { type: "welcome" }
  | { type: "match_created"; data: Match };

function sendJson(socket: WebSocket, payload: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: ServerMessage): void {
  // Serialize once, not per client.
  const message = JSON.stringify(payload);

  for (const client of wss.clients) {
    // Skip sockets that are still connecting or already closing; keep sending to the rest.
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(message);
  }
}

type WebSocketOptions = {
  // How often to ping clients; a client that hasn't answered the previous ping is dropped.
  heartbeatIntervalMs?: number;
};

export function attachWebSocketServer(
  server: Server,
  { heartbeatIntervalMs = 30_000 }: WebSocketOptions = {},
) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("error", (err) => {
    console.error(`WebSocket server error: ${err.message}`);
  });

  // Sockets that answered the last ping. Kept outside the socket so the ws types stay intact;
  // a WeakSet also lets closed sockets be garbage-collected without manual cleanup.
  const alive = new WeakSet<WebSocket>();

  wss.on("connection", (socket) => {
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));
    socket.on("error", (err) => console.error(`WebSocket client error: ${err.message}`));

    sendJson(socket, { type: "welcome" });
  });

  // Heartbeat: drop connections that died without a close frame (lost Wi-Fi, sleeping laptop),
  // so they don't pile up in wss.clients and waste broadcasts.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, heartbeatIntervalMs);
  // Don't let the timer alone keep the process running.
  heartbeat.unref();

  wss.on("close", () => clearInterval(heartbeat));

  function broadcastMatchCreated(match: Match): void {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
