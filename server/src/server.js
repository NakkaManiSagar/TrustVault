
import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8"]);
}

const required = ["MONGODB_URI", "SESSION_SECRET"];

async function start() {
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if (Buffer.byteLength(process.env.SESSION_SECRET, "utf8") < 32) {
    throw new Error("SESSION_SECRET must be at least 32 bytes");
  }

  // Load the app only after DNS configuration is applied.
  const { default: app } = await import("./app.js");

  await mongoose.connect(process.env.MONGODB_URI);

  const port = Number(process.env.PORT) || 5000;

  app.listen(port, () => {
    console.log(`TrustVault API running on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch((error) => {
    console.error("TrustVault startup failed:", error.message);
    process.exitCode = 1;
  });
}
