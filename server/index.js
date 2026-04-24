import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import chatRouter from "./routes/chat.js";
import walletRouter from "./routes/wallet.js";
import { attachDexRelay } from "./services/dexRelay.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use(apiRateLimit);

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "minima-ai-orchestrator" });
});

app.use("/api/chat", chatRouter);
app.use("/api/wallet", walletRouter);

const server = http.createServer(app);
attachDexRelay(server);

server.listen(PORT, () => {
  console.log(`MA orchestrator listening on port ${PORT}`);
});
