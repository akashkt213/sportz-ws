import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { attachWebSocketServer } from "./ws/server.js";

// One HTTP server shared by Express and the WebSocket server, so both run on the same port.
const server = http.createServer(app);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.on("error", (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

server.listen(env.port, env.host, () => {
  // 0.0.0.0 / unset means "all interfaces"; localhost is the address you can actually open.
  const host = !env.host || env.host === "0.0.0.0" ? "localhost" : env.host;
  console.log(`Server running at http://${host}:${env.port}`);
  console.log(`WebSocket running at ws://${host}:${env.port}/ws`);
});
