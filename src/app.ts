import express from "express";
import { healthRouter } from "./routes/health.js";
import { matchRouter } from "./routes/matches.js";

export const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Server is up and running!");
});

app.use(healthRouter);
app.use("/matches", matchRouter);
