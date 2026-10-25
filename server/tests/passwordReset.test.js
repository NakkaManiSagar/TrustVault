
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import request from "supertest";
import app from "../src/app.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import User from "../src/models/User.js";
import PasswordResetToken from "../src/models/PasswordResetToken.js";
import { resetPassword } from "../src/services/passwordResetService.js";

let mongo;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createUser(email = "reset@example.com") {
  const passwordHash = await bcrypt.hash("OriginalPass123!", 12);

  return User.create({
    name: "Reset Test User",
    email,
    passwordHash,
    role: "viewer",
  });
}

async function createResetToken(user, options = {}) {
  const token = randomBytes(32).toString("base64url");

  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashToken(token),
    expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
    usedAt: options.usedAt ?? null,
  });

  return token;
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    PasswordResetToken.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("Password reset security", () => {
  it("changes the password and increments sessionVersion", async () => {
    const user = await createUser();
    const token = await createResetToken(user);

    const success = await resetPassword(token, "NewSecurePass123!");

    expect(success).toBe(true);

    const updatedUser = await User.findById(user._id).select("+passwordHash");

    expect(updatedUser.sessionVersion).toBe(1);

    expect(
      await bcrypt.compare(
        "NewSecurePass123!",
        updatedUser.passwordHash
      )
    ).toBe(true);

    expect(
      await bcrypt.compare(
        "OriginalPass123!",
        updatedUser.passwordHash
      )
    ).toBe(false);

    expect(
      await PasswordResetToken.countDocuments({ user: user._id })
    ).toBe(0);
  });

  it("rejects reusing a reset token", async () => {
    const user = await createUser();
    const token = await createResetToken(user);

    expect(
      await resetPassword(token, "NewSecurePass123!")
    ).toBe(true);

    expect(
      await resetPassword(token, "AnotherSecurePass123!")
    ).toBe(false);
  });

  it("rejects an expired token", async () => {
    const user = await createUser();

    const token = await createResetToken(user, {
      expiresAt: new Date(Date.now() - 60_000),
    });

    expect(
      await resetPassword(token, "NewSecurePass123!")
    ).toBe(false);
  });

  it("rejects a password shorter than 12 characters", async () => {
    const user = await createUser();
    const token = await createResetToken(user);

    expect(
      await resetPassword(token, "Short123!")
    ).toBe(false);
  });

  it("rejects a malformed token", async () => {
    expect(
      await resetPassword("bad-token", "NewSecurePass123!")
    ).toBe(false);
  });

  it("invalidates existing sessions after a password reset", async () => {
    const user = await createUser("session-reset@example.com");

    // Log in with the original password and preserve the session.
    const oldAgent = request.agent(app);

    const loginResponse = await oldAgent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: "OriginalPass123!",
      });

    expect(loginResponse.status).toBe(200);

    // Generate a valid reset token.
    const token = await createResetToken(user);

    // Reset the password using a separate request.
    const resetResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token,
        password: "NewSecurePass123!",
      });

    expect(resetResponse.status).toBe(200);

    // The original session should now be rejected.
    const oldSessionResponse = await oldAgent.get("/api/auth/me");

    expect(oldSessionResponse.status).toBe(401);

    // The new password should allow a fresh login.
    const newAgent = request.agent(app);

    const newLoginResponse = await newAgent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: "NewSecurePass123!",
      });

    expect(newLoginResponse.status).toBe(200);

    const newSessionResponse = await newAgent.get("/api/auth/me");

    expect(newSessionResponse.status).toBe(200);
  });
});
