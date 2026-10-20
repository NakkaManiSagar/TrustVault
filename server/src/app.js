
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import { requireAuth, requireRole } from "./middleware/authenticate.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { verifyRequestOrigin } from "./middleware/verifyRequestOrigin.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  })
);

app.use(express.json({ limit: "100kb" }));

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 bytes");
}

const sessionOptions = {
  name: "trustvault.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  },
};

// Tests can exercise the app without requiring a running database.
// Production and normal development use persistent MongoDB sessions.
if (process.env.NODE_ENV !== "test") {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  sessionOptions.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions",
    ttl: 60 * 60 * 8,
  });
}

app.use(session(sessionOptions));
app.use(verifyRequestOrigin);
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/admin", adminRoutes);
app.get("/api/health", (req, res) => {

  res.json({
    status: "ok",
    service: "TrustVault API",
  });
});
app.get(
  "/api/admin/check",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    res.json({ message: "Admin access granted" });
  }
);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error("Request failed:", err.message);

  res.status(err.status || 500).json({
    error:
      err.status && err.status < 500
        ? err.message
        : "Internal server error",
  });
});

export default app;
