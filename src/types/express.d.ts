import type { Match } from "../db/schema.js";

// Types for values stored on `app.locals`, so routes get them type-checked instead of `any`.
declare global {
  namespace Express {
    interface Locals {
      // Optional: absent when the app runs without the WebSocket server (e.g. in tests).
      broadcastMatchCreated?: (match: Match) => void;
    }
  }
}

export {};
