
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
import Document from "../src/models/Document.js";
import DocumentPermission from "../src/models/DocumentPermission.js";
import AuditLog from "../src/models/AuditLog.js";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Document.deleteMany({}),
    DocumentPermission.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function createLoggedInUser(name, email) {
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

async function createDocument(owner, title = "Private Report") {
  return Document.create({
    title,
    originalName: `${title}.pdf`,
    owner: owner._id,
    category: "Academic",
    mimeType: "application/pdf",
    sizeBytes: 100,
    storageKey: `${owner._id}/${new mongoose.Types.ObjectId()}`,
  });
}

describe("Document access isolation", () => {
  it("does not list another user's private document", async () => {
    const alice = await createLoggedInUser(
      "Alice Owner",
      "alice@example.com"
    );
    const bob = await createLoggedInUser(
      "Bob Viewer",
      "bob@example.com"
    );

    await createDocument(alice.user, "Alice Secret");
    await createDocument(bob.user, "Bob Private");

    const response = await bob.agent.get("/api/documents");

    expect(response.status).toBe(200);

    const titles = response.body.documents.map((doc) => doc.title);

    expect(titles).toContain("Bob Private");
    expect(titles).not.toContain("Alice Secret");
  });

  it("denies downloading a document without permission", async () => {
    const alice = await createLoggedInUser(
      "Alice Owner",
      "alice2@example.com"
    );
    const bob = await createLoggedInUser(
      "Bob Viewer",
      "bob2@example.com"
    );

    const document = await createDocument(alice.user);

    const response = await bob.agent.get(
      `/api/documents/${document._id}/download`
    );

    expect(response.status).toBe(404);

    const audit = await AuditLog.findOne({
      action: "ACCESS_DENIED",
      resourceId: document._id,
      outcome: "denied",
    });

    expect(audit).not.toBeNull();
  });

  it("denies editing another user's document", async () => {
    const alice = await createLoggedInUser(
      "Alice Owner",
      "alice3@example.com"
    );
    const bob = await createLoggedInUser(
      "Bob Viewer",
      "bob3@example.com"
    );

    const document = await createDocument(alice.user);

    const response = await bob.agent
      .patch(`/api/documents/${document._id}`)
      .send({ title: "Unauthorized Change" });

    expect(response.status).toBe(404);

    const unchanged = await Document.findById(document._id);
    expect(unchanged.title).toBe("Private Report");
  });

  it("denies deleting another user's document", async () => {
    const alice = await createLoggedInUser(
      "Alice Owner",
      "alice4@example.com"
    );
    const bob = await createLoggedInUser(
      "Bob Viewer",
      "bob4@example.com"
    );

    const document = await createDocument(alice.user);

    const response = await bob.agent.delete(
      `/api/documents/${document._id}`
    );

    expect(response.status).toBe(404);

    const unchanged = await Document.findById(document._id);
    expect(unchanged).not.toBeNull();
    expect(unchanged.deletedAt).toBeNull();
  });

  it("denies granting permissions on another user's document", async () => {
    const alice = await createLoggedInUser(
      "Alice Owner",
      "alice5@example.com"
    );
    const bob = await createLoggedInUser(
      "Bob Viewer",
      "bob5@example.com"
    );

    const document = await createDocument(alice.user);

    const response = await bob.agent
      .post(`/api/documents/${document._id}/permissions`)
      .send({
        email: "bob5@example.com",
        permission: "edit",
      });

    expect(response.status).toBe(404);

    const grant = await DocumentPermission.findOne({
      document: document._id,
      user: bob.user._id,
    });

    expect(grant).toBeNull();
  });
});
