import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { config, warnAboutConfig } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { startEmailWorker } from "./lib/mailer.js";
import { seed } from "./seed.js";
import publicRoutes from "./routes/public.js";
import authRoutes from "./routes/auth.js";
import consoleRoutes from "./routes/console.js";
import adminRoutes from "./routes/admin.js";
import scannerRoutes from "./routes/scanner.js";
import { paystackWebhook } from "./routes/webhook.js";

const app = express();
app.set("trust proxy", 1); // Render / Vercel sit behind a proxy; needed for correct rate limiting
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowed = new Set([
  config.clientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    exposedHeaders: ["Content-Disposition"],
  }),
);

// The webhook needs the RAW body to verify Paystack's signature, so it is registered BEFORE express.json().
app.post(
  "/api/paystack/webhook",
  express.raw({ type: "*/*", limit: "1mb" }),
  paystackWebhook,
);

app.use(express.json({ limit: "1mb" }));

// Used by Render and UptimeRobot. It only looks at the in-memory connection state, so pinging it costs ZERO database operations.
// It answers 503 when the database is disconnected, so a monitor can alert you.
app.get("/api/health", (_req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ ok: db, db, time: new Date() });
});
app.use("/api/auth", authRoutes);
app.use("/api/console", consoleRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/scanner", scannerRoutes);
app.use("/api", publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function main() {
  const warnings = warnAboutConfig();
  try {
    // One small, reused pool. Atlas free allows 500 connections in total, so we never open more than 20.
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 20,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    console.error(
      "\n✖ Could not connect to MongoDB at",
      config.mongoUri.replace(/\/\/.*@/, "//***@"),
    );
    console.error(
      '  Is MongoDB running? Local install: start "mongod". Or use a free MongoDB Atlas URL in server/.env (MONGO_URI).\n',
    );
    console.error("  Reason:", err.message);
    process.exit(1);
  }
  console.log("✔ Connected to MongoDB");

  const notes = await seed();
  notes.forEach((n) => console.log("✔", n));
  warnings.forEach((w) => console.log("⚠", w));

  startEmailWorker();
  app.listen(config.port, () => {
    console.log(`✔ API running on http://localhost:${config.port}`);
    console.log(
      `  Paystack webhook URL (set on dashboard.paystack.com > Settings > API Keys & Webhooks): <your-api-url>/api/paystack/webhook`,
    );
  });
}

main();
