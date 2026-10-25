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
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../src/app.js";
import User from "../src/models/User.js";

let mongo;
let agent;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("TrustVault authentication", () => {
  it("registers new users as viewers", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Viewer",
        email: "viewer@example.com",
        password: "StrongTestPass123!",
        role: "admin",
      });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("viewer");

    const saved = await User.findOne({
      email: "viewer@example.com",
    }).select("+passwordHash");

    expect(saved.passwordHash).not.toBe("StrongTestPass123!");
  });

  it("rejects invalid registration data", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "X",
        email: "not-an-email",
        password: "short",
      });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate email registration", async () => {
    const details = {
      name: "Test Viewer",
      email: "duplicate@example.com",
      password: "StrongTestPass123!",
    };

    const first = await request(app)
      .post("/api/auth/register")
      .send(details);

    const second = await request(app)
      .post("/api/auth/register")
      .send(details);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("allows login and access to the current-user endpoint", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Viewer",
        email: "login@example.com",
        password: "StrongTestPass123!",
      });

    agent = request.agent(app);

    const login = await agent
      .post("/api/auth/login")
      .send({
        email: "login@example.com",
        password: "StrongTestPass123!",
      });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("viewer");

    const me = await agent.get("/api/auth/me");

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("login@example.com");
  });

  it("rejects incorrect passwords", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Viewer",
        email: "wrongpass@example.com",
        password: "StrongTestPass123!",
      });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "wrongpass@example.com",
        password: "IncorrectPassword123!",
      });

    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated requests to protected routes", async () => {
    const response = await request(app)
      .get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("blocks a viewer from the admin endpoint", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Viewer",
        email: "rolecheck@example.com",
        password: "StrongTestPass123!",
      });

    const viewer = request.agent(app);

    await viewer
      .post("/api/auth/login")
      .send({
        email: "rolecheck@example.com",
        password: "StrongTestPass123!",
      });

    const response = await viewer.get("/api/admin/check");

    expect(response.status).toBe(403);
  });

  it("invalidates the session after logout", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Viewer",
        email: "logout@example.com",
        password: "StrongTestPass123!",
      });

    const userAgent = request.agent(app);

    await userAgent
      .post("/api/auth/login")
      .send({
        email: "logout@example.com",
        password: "StrongTestPass123!",
      });

    const logout = await userAgent.post("/api/auth/logout");

    expect(logout.status).toBe(204);

    const me = await userAgent.get("/api/auth/me");

    expect(me.status).toBe(401);
  });
});