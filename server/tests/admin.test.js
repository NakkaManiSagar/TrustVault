import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../src/app.js";
import User from "../src/models/User.js";
import AuditLog from "../src/models/AuditLog.js";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function registerAndLogin(name, email) {
  const password = "StrongTestPass123!";

  const registration = await request(app)
    .post("/api/auth/register")
    .send({ name, email, password });

  expect(registration.status).toBe(201);

  const agent = request.agent(app);
  const login = await agent
    .post("/api/auth/login")
    .send({ email, password });

  expect(login.status).toBe(200);

  const user = await User.findOne({ email });
  return { agent, user };
}

describe("Admin audit authorization", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/api/admin/audit");
    expect(response.status).toBe(401);
  });

  it("rejects an authenticated viewer", async () => {
    const viewer = await registerAndLogin(
      "Viewer User",
      "viewer@example.com"
    );

    const response = await viewer.agent.get("/api/admin/audit");
    expect(response.status).toBe(403);
  });

  it("allows an administrator to view audit events", async () => {
    const admin = await registerAndLogin(
      "Admin User",
      "admin@example.com"
    );

    // This promotion happens only in the isolated test database.
    await User.updateOne(
      { _id: admin.user._id },
      { $set: { role: "admin" } }
    );

    await AuditLog.create({
      actor: admin.user._id,
      action: "DOCUMENT_DOWNLOAD",
      resourceType: "document",
      outcome: "success",
      details: { testEvent: true },
    });

    const response = await admin.agent.get("/api/admin/audit");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("events");
    expect(response.body.events).toHaveLength(1);
    expect(response.body.events[0].action).toBe("DOCUMENT_DOWNLOAD");
    expect(response.body.events[0].outcome).toBe("success");
  });

  it("rejects an invalid outcome filter", async () => {
    const admin = await registerAndLogin(
      "Admin User",
      "admin@example.com"
    );

    await User.updateOne(
      { _id: admin.user._id },
      { $set: { role: "admin" } }
    );

    const response = await admin.agent
      .get("/api/admin/audit")
      .query({ outcome: "anything" });

    expect(response.status).toBe(400);
  });
});
