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

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  // ws re-emits the HTTP server's errors (e.g. EADDRINUSE) here; without a listener the
  // process crashes before the HTTP server's own error handler can report it cleanly.
  wss.on("error", (err) => {
    console.error(`WebSocket server error: ${err.message}`);
  });

  wss.on("connection", (socket) => {
    sendJson(socket, { type: "welcome" });
  });

  function broadcastMatchCreated(match: Match): void {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
