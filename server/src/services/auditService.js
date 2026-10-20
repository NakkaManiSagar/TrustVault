
import { createHash } from "node:crypto";
import AuditLog from "../models/AuditLog.js";

// Sort object keys so the same event always produces the same JSON.
function stableValue(value) {
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    // Normalize Mongoose ObjectIds and other BSON identifiers.
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }

  return value;
}

function eventPayload(event) {
  return {
    createdAt: new Date(event.createdAt).toISOString(),
    actor: event.actor ? String(event.actor) : null,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId ? String(event.resourceId) : null,
    outcome: event.outcome,
    ipAddress: event.ipAddress ?? "",
    userAgent: event.userAgent ?? "",
    details: event.details ?? {},
  };
}

function calculateHash(previousHash, event) {
  const content = JSON.stringify(
    stableValue({
      previousHash,
      ...eventPayload(event),
    })
  );

  return createHash("sha256").update(content).digest("hex");
}

// Serialize writes within this Node.js process to avoid competing
// requests appending to the same previous hash simultaneously.
let writeQueue = Promise.resolve();

export function createAuditLog({
  actor = null,
  action,
  resourceType = "document",
  resourceId = null,
  outcome,
  ipAddress = "",
  userAgent = "",
  details = {},
}) {
  const operation = writeQueue.then(async () => {
    const previous = await AuditLog.findOne()
      .sort({ createdAt: -1, _id: -1 })
      .select("+previousHash +entryHash")
      .lean();

    const previousHash = previous?.entryHash ?? "";

    const now = Date.now();
    const previousTime = previous?.createdAt
      ? new Date(previous.createdAt).getTime()
      : 0;

    // Keep timestamps strictly increasing within this process.
    const createdAt = new Date(Math.max(now, previousTime + 1));

    const event = {
      actor,
      action,
      resourceType,
      resourceId,
      outcome,
      ipAddress,
      userAgent,
      details,
      createdAt,
    };

    const entryHash = calculateHash(previousHash, event);

    return AuditLog.create({
      ...event,
      previousHash,
      entryHash,
      createdAt,
      updatedAt: createdAt,
    });
  });

  // Keep the queue usable after an individual write fails.
  writeQueue = operation.catch(() => {});

  return operation;
}

export async function verifyAuditChain() {
  const entries = await AuditLog.find()
    .select("+previousHash +entryHash")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  let expectedPreviousHash = "";

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];

    if (entry.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        checked: index,
        invalidEntryId: String(entry._id),
        reason: "Previous hash does not match",
      };
    }

    const expectedHash = calculateHash(
      entry.previousHash,
      entry
    );

    if (entry.entryHash !== expectedHash) {
      return {
        valid: false,
        checked: index,
        invalidEntryId: String(entry._id),
        reason: "Entry hash does not match",
      };
    }

    expectedPreviousHash = entry.entryHash;
  }

  return {
    valid: true,
    checked: entries.length,
  };
}
