import { z } from "zod";

const matchId = z.number().int().positive();

// Messages a client may send over the WebSocket. No coercion: these arrive as JSON, so types are exact.
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), matchId }),
  z.object({ type: z.literal("unsubscribe"), matchId }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
