
import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { verifyRequestOrigin } from "../src/middleware/verifyRequestOrigin.js";

const app = express();
app.use(express.json());
app.use(verifyRequestOrigin);
app.post("/test", (req, res) => res.json({ ok: true }));
app.get("/test", (req, res) => res.json({ ok: true }));

const originalOrigin = process.env.CLIENT_ORIGIN;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalOrigin === undefined) {
    delete process.env.CLIENT_ORIGIN;
  } else {
    process.env.CLIENT_ORIGIN = originalOrigin;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe("Request origin protection", () => {
  afterEach(() => {
    // Environment variables are restored by the outer afterEach.
  });

  it("allows a mutation from the configured origin", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";

    const response = await request(app)
      .post("/test")
      .set("Origin", "http://localhost:5173")
      .send({ value: 1 });

    expect(response.status).toBe(200);
  });

  it("rejects a mutation from an unexpected origin", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";

    const response = await request(app)
      .post("/test")
      .set("Origin", "https://attacker.example")
      .send({ value: 1 });

    expect(response.status).toBe(403);
  });

  it("allows a safe GET request", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://attacker.example");

    expect(response.status).toBe(200);
  });

  it("rejects a mismatched Referer when Origin is absent", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";

    const response = await request(app)
      .post("/test")
      .set("Referer", "https://attacker.example/page")
      .send({ value: 1 });

    expect(response.status).toBe(403);
  });

  it("allows a matching Referer when Origin is absent", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";

    const response = await request(app)
      .post("/test")
      .set("Referer", "http://localhost:5173/upload")
      .send({ value: 1 });

    expect(response.status).toBe(200);
  });

  it("rejects a mutation without Origin or Referer in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";

    const response = await request(app)
      .post("/test")
      .send({ value: 1 });

    expect(response.status).toBe(403);
  });

  it("rejects mutations if the trusted origin is not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.CLIENT_ORIGIN;

    const response = await request(app)
      .post("/test")
      .set("Origin", "http://localhost:5173")
      .send({ value: 1 });

    expect(response.status).toBe(403);
  });
});
