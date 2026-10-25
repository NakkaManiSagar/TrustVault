import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import AuditLog from "../src/models/AuditLog.js";
import AuditChainState from "../src/models/AuditChainState.js";
import {
  createAuditLog,
  verifyAuditChain,
} from "../src/services/auditService.js";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongo.getUri());
});
afterEach(async () => {
  await AuditLog.deleteMany({});
  await AuditChainState.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("Audit trail security", () => {
  it("creates an audit entry with a SHA-256 hash", async () => {
    const entry = await createAuditLog({
      action: "DOCUMENT_UPLOAD",
      resourceType: "document",
      outcome: "success",
      details: { filename: "report.pdf" },
    });

    expect(entry.action).toBe("DOCUMENT_UPLOAD");
    expect(entry.entryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.previousHash).toBe("");
  });

  it("verifies an intact chain", async () => {
    await createAuditLog({
      action: "DOCUMENT_UPLOAD",
      outcome: "success",
    });

    await createAuditLog({
      action: "DOCUMENT_DOWNLOAD",
      outcome: "success",
    });

    const result = await verifyAuditChain();

    expect(result.valid).toBe(true);
    expect(result.checked).toBe(2);
  });

  it("detects a modified audit entry", async () => {
    const entry = await createAuditLog({
      action: "DOCUMENT_UPLOAD",
      outcome: "success",
      details: { filename: "original.pdf" },
    });

    await AuditLog.updateOne(
      { _id: entry._id },
      { $set: { details: { filename: "tampered.pdf" } } },
    );

    const result = await verifyAuditChain();

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Entry hash does not match");
  });

  it("links each new entry to the previous entry hash", async () => {
    const first = await createAuditLog({
      action: "DOCUMENT_UPLOAD",
      outcome: "success",
    });

    const second = await createAuditLog({
      action: "DOCUMENT_EDIT",
      outcome: "success",
    });

    expect(second.previousHash).toBe(first.entryHash);
  });

  it("serializes concurrent audit writes", async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createAuditLog({
          action: "ACCESS_DENIED",
          outcome: "denied",
          details: { attempt: index },
        }),
      ),
    );

    const result = await verifyAuditChain();

    expect(result.valid).toBe(true);
    expect(result.checked).toBe(5);
  });

  it("continues accepting audit writes after a failed write", async () => {
    const originalCreate = AuditLog.create;

    try {
      AuditLog.create = async () => {
        throw new Error("Simulated audit storage failure");
      };

      await expect(
        createAuditLog({
          action: "DOCUMENT_UPLOAD",
          outcome: "success",
        }),
      ).rejects.toThrow("Simulated audit storage failure");
    } finally {
      AuditLog.create = originalCreate;
    }

    const entry = await createAuditLog({
      action: "DOCUMENT_EDIT",
      outcome: "success",
    });

    expect(entry.action).toBe("DOCUMENT_EDIT");

    const result = await verifyAuditChain();

    expect(result.valid).toBe(true);
    expect(result.checked).toBe(1);
  });
});
