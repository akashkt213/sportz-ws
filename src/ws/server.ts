import type { Server } from "node:http";
import WebSocket, { type RawData, WebSocketServer } from "ws";
import type { Commentary, Match } from "../db/schema.js";
import { clientMessageSchema } from "../validation/ws.js";

// Every message the server can push to clients; `type` lets clients switch on it safely.
export type ServerMessage =
  | { type: "welcome" }
  | { type: "error"; message: string }
  | { type: "subscribed"; matchId: number }
  | { type: "unsubscribed"; matchId: number }
  | { type: "match_created"; data: Match }
  | { type: "commentary"; data: Commentary };

function sendJson(socket: WebSocket, payload: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastTo(clients: Iterable<WebSocket>, payload: ServerMessage): void {
  // Serialize once, not per client.
  const message = JSON.stringify(payload);

  for (const client of clients) {
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

  // Two indexes over the same subscriptions: match -> sockets for broadcasting,
  // socket -> matches for cleanup when the socket closes. Both live per server instance.
  const matchSubscribers = new Map<number, Set<WebSocket>>();
  const socketSubscriptions = new Map<WebSocket, Set<number>>();

  function subscribe(matchId: number, socket: WebSocket): void {
    let subscribers = matchSubscribers.get(matchId);
    if (!subscribers) {
      subscribers = new Set();
      matchSubscribers.set(matchId, subscribers);
    }
    subscribers.add(socket);
    socketSubscriptions.get(socket)?.add(matchId);
  }

  function unsubscribe(matchId: number, socket: WebSocket): void {
    socketSubscriptions.get(socket)?.delete(matchId);

    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers) return;

    subscribers.delete(socket);
    if (subscribers.size === 0) {
      matchSubscribers.delete(matchId);
    }
  }

  function cleanupSocket(socket: WebSocket): void {
    for (const matchId of socketSubscriptions.get(socket) ?? []) {
      unsubscribe(matchId, socket);
    }
    socketSubscriptions.delete(socket);
  }

  function handleMessage(socket: WebSocket, data: RawData): void {
    let json: unknown;
    try {
      json = JSON.parse(data.toString());
    } catch {
      sendJson(socket, { type: "error", message: "Message must be valid JSON" });
      return;
    }

    const parsed = clientMessageSchema.safeParse(json);
    if (!parsed.success) {
      sendJson(socket, {
        type: "error",
        message: 'Expected {"type":"subscribe"|"unsubscribe","matchId":<positive integer>}',
      });
      return;
    }

    const { type, matchId } = parsed.data;
    if (type === "subscribe") {
      subscribe(matchId, socket);
      sendJson(socket, { type: "subscribed", matchId });
    } else {
      unsubscribe(matchId, socket);
      sendJson(socket, { type: "unsubscribed", matchId });
    }
  }

  // Sockets that answered the last ping. A WeakSet lets closed sockets be garbage-collected.
  const alive = new WeakSet<WebSocket>();

  wss.on("connection", (socket) => {
    alive.add(socket);
    socketSubscriptions.set(socket, new Set());

    socket.on("pong", () => alive.add(socket));
    socket.on("message", (data) => handleMessage(socket, data));
    socket.on("error", (err) => {
      console.error(`WebSocket client error: ${err.message}`);
      socket.terminate();
    });
    // Fires for every disconnect, including heartbeat terminations.
    socket.on("close", () => cleanupSocket(socket));

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

  // Every connected client hears about new matches.
  function broadcastMatchCreated(match: Match): void {
    broadcastTo(wss.clients, { type: "match_created", data: match });
  }

  // Only clients subscribed to this match get its commentary.
  function broadcastCommentary(matchId: number, comment: Commentary): void {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers) return;

    broadcastTo(subscribers, { type: "commentary", data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
