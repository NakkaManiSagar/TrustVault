
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
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

async function createOwnedDocument(owner) {
  return Document.create({
    title: "Shared Report",
    originalName: "shared-report.pdf",
    owner: owner._id,
    category: "Academic",
    mimeType: "application/pdf",
    sizeBytes: 100,
    storageKey: `${owner._id}/${new mongoose.Types.ObjectId()}`,
  });
}

describe("Document sharing and revocation", () => {
  it("allows an owner to grant read access and lists the shared document", async () => {
    const owner = await registerAndLogin(
      "Sharing Owner",
      "sharing-owner@example.com"
    );

    const viewer = await registerAndLogin(
      "Sharing Viewer",
      "sharing-viewer@example.com"
    );

    const document = await createOwnedDocument(owner.user);

    const grantResponse = await owner.agent
      .post(`/api/documents/${document._id}/permissions`)
      .send({
        email: viewer.user.email,
        permission: "read",
      });

    expect(grantResponse.status).toBe(200);
    expect(grantResponse.body.permission.permission).toBe("read");

    const listResponse = await viewer.agent.get("/api/documents");

    expect(listResponse.status).toBe(200);
    expect(
      listResponse.body.documents.some(
        (item) => String(item._id) === String(document._id)
      )
    ).toBe(true);
  });

  it("allows an edit grantee to update metadata", async () => {
    const owner = await registerAndLogin(
      "Edit Owner",
      "edit-owner@example.com"
    );

    const editor = await registerAndLogin(
      "Edit User",
      "edit-user@example.com"
    );

    const document = await createOwnedDocument(owner.user);

    const grantResponse = await owner.agent
      .post(`/api/documents/${document._id}/permissions`)
      .send({
        email: editor.user.email,
        permission: "edit",
      });

    expect(grantResponse.status).toBe(200);

    const editResponse = await editor.agent
      .patch(`/api/documents/${document._id}`)
      .send({
        title: "Updated Shared Report",
      });

    expect(editResponse.status).toBe(200);
    expect(editResponse.body.document.title).toBe(
      "Updated Shared Report"
    );

    const storedDocument = await Document.findById(document._id);

    expect(storedDocument.title).toBe("Updated Shared Report");
  });

  it("blocks access immediately after the owner revokes permission", async () => {
    const owner = await registerAndLogin(
      "Revoke Owner",
      "revoke-owner@example.com"
    );

    const viewer = await registerAndLogin(
      "Revoke Viewer",
      "revoke-viewer@example.com"
    );

    const document = await createOwnedDocument(owner.user);

    const grantResponse = await owner.agent
      .post(`/api/documents/${document._id}/permissions`)
      .send({
        email: viewer.user.email,
        permission: "read",
      });

    expect(grantResponse.status).toBe(200);

    const revokeResponse = await owner.agent.delete(
      `/api/documents/${document._id}/permissions/${viewer.user._id}`
    );

    expect(revokeResponse.status).toBe(204);

    const listResponse = await viewer.agent.get("/api/documents");

    expect(listResponse.status).toBe(200);
    expect(
      listResponse.body.documents.some(
        (item) => String(item._id) === String(document._id)
      )
    ).toBe(false);

    const editResponse = await viewer.agent
      .patch(`/api/documents/${document._id}`)
      .send({ title: "Unauthorized Edit" });

    expect(editResponse.status).toBe(404);
  });

  it("records successful permission grants and revocations", async () => {
    const owner = await registerAndLogin(
      "Audit Owner",
      "audit-owner@example.com"
    );

    const viewer = await registerAndLogin(
      "Audit Viewer",
      "audit-viewer@example.com"
    );

    const document = await createOwnedDocument(owner.user);

    const grantResponse = await owner.agent
      .post(`/api/documents/${document._id}/permissions`)
      .send({
        email: viewer.user.email,
        permission: "read",
      });

    expect(grantResponse.status).toBe(200);

    const revokeResponse = await owner.agent.delete(
      `/api/documents/${document._id}/permissions/${viewer.user._id}`
    );

    expect(revokeResponse.status).toBe(204);

    const events = await AuditLog.find({
      resourceId: document._id,
      action: {
        $in: ["PERMISSION_GRANT", "PERMISSION_REVOKE"],
      },
    }).lean();

    expect(events.map((event) => event.action)).toContain(
      "PERMISSION_GRANT"
    );

    expect(events.map((event) => event.action)).toContain(
      "PERMISSION_REVOKE"
    );
  });

  it("does not silently report a successful edit when audit logging fails", async () => {
    const owner = await registerAndLogin(
      "Audit Failure Owner",
      "audit-failure-owner@example.com"
    );

    const document = await createOwnedDocument(owner.user);
    const originalTitle = document.title;

    const auditModule = await import("../src/services/auditService.js");
    const createSpy = vi.spyOn(auditModule, "createAuditLog");

    createSpy.mockRejectedValueOnce(
      new Error("Simulated audit storage failure")
    );

    try {
      const response = await owner.agent
        .patch(`/api/documents/${document._id}`)
        .send({
          title: "Changed Despite Audit Failure",
        });

      expect(response.status).toBeGreaterThanOrEqual(400);

      const storedDocument = await Document.findById(document._id);

      expect(storedDocument.title).toBe(originalTitle);
    } finally {
      createSpy.mockRestore();
    }
  });
});
