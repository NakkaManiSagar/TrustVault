
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("TrustVault API", () => {
  it("returns the health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "TrustVault API",
    });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(app).get("/api/unknown");

    expect(response.status).toBe(404);
  });
});
