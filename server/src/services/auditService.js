
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import AuditChainState from "../models/AuditChainState.js";

const STATE_ID = "global";

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
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

async function ensureChainState() {
  let state = await AuditChainState.findById(STATE_ID).lean();

  if (state) return state;

  // Never silently start a new chain over existing audit history.
  const existingEntries = await AuditLog.countDocuments();

  if (existingEntries > 0) {
    throw new Error(
      "Audit chain state is missing while audit entries exist. " +
        "Verify and migrate the legacy audit chain before writing."
    );
  }

  try {
    await AuditChainState.updateOne(
      { _id: STATE_ID },
      {
        $setOnInsert: {
          sequence: 0,
          lastHash: "",
        },
      },
      { upsert: true }
    );
  } catch (error) {
    // Another instance may have initialized the shared state first.
    if (error?.code !== 11000) throw error;
  }

  state = await AuditChainState.findById(STATE_ID).lean();

  if (!state) {
    throw new Error("Unable to initialize audit chain state");
  }

  return state;
}

export async function createAuditLog({
  actor = null,
  action,
  resourceType = "document",
  resourceId = null,
  outcome,
  ipAddress = "",
  userAgent = "",
  details = {},
}) {
  await ensureChainState();

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const state = await AuditChainState.findById(STATE_ID)
        .session(session)
        .lean();

      if (!state) {
        throw new Error("Audit chain state is missing");
      }

      const sequence = state.sequence + 1;
      const createdAt = new Date();

      const event = {
        actor,
        action,
        resourceType,
        resourceId,
        outcome,
        ipAddress,
        userAgent,
        details,
        sequence,
        createdAt,
      };

      const entryHash = calculateHash(state.lastHash, event);

      // The state update and entry insert commit or abort together.
      const updated = await AuditChainState.updateOne(
        {
          _id: STATE_ID,
          sequence: state.sequence,
          lastHash: state.lastHash,
        },
        {
          $set: {
            sequence,
            lastHash: entryHash,
          },
        },
        { session }
      );

      if (updated.modifiedCount !== 1) {
        throw new Error("Audit chain state changed; retry the transaction");
      }

      const [entry] = await AuditLog.create(
        [
          {
            ...event,
            previousHash: state.lastHash,
            entryHash,
            updatedAt: createdAt,
          },
        ],
        { session }
      );

      result = entry;
    });
  } finally {
    await session.endSession();
  }

  return result;
}

export async function verifyAuditChain() {
  const entries = await AuditLog.find()
    .select("+sequence +previousHash +entryHash")
    .sort({ sequence: 1, createdAt: 1, _id: 1 })
    .lean();

  const numbered = entries.filter(
    (entry) => Number.isInteger(entry.sequence)
  );

  // Preserve verification of an entirely legacy chain.
  if (numbered.length === 0) {
    let expectedPreviousHash = "";

    const legacyEntries = await AuditLog.find()
      .select("+previousHash +entryHash")
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    for (let index = 0; index < legacyEntries.length; index += 1) {
      const entry = legacyEntries[index];

      if (entry.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          checked: index,
          invalidEntryId: String(entry._id),
          reason: "Previous hash does not match",
        };
      }

      if (
        entry.entryHash !== calculateHash(entry.previousHash, entry)
      ) {
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
      checked: legacyEntries.length,
      legacy: true,
    };
  }

  if (numbered.length !== entries.length) {
    return {
      valid: false,
      checked: 0,
      reason: "Mixed legacy and numbered audit entries",
    };
  }

  let expectedPreviousHash = "";

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];

    if (entry.sequence !== index + 1) {
      return {
        valid: false,
        checked: index,
        invalidEntryId: String(entry._id),
        reason: "Audit sequence is missing or out of order",
      };
    }

    if (entry.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        checked: index,
        invalidEntryId: String(entry._id),
        reason: "Previous hash does not match",
      };
    }

    if (entry.entryHash !== calculateHash(entry.previousHash, entry)) {
      return {
        valid: false,
        checked: index,
        invalidEntryId: String(entry._id),
        reason: "Entry hash does not match",
      };
    }

    expectedPreviousHash = entry.entryHash;
  }

  const state = await AuditChainState.findById(STATE_ID).lean();

  if (
    entries.length > 0 &&
    (!state ||
      state.sequence !== entries.length ||
      state.lastHash !== expectedPreviousHash)
  ) {
    return {
      valid: false,
      checked: entries.length,
      reason: "Audit chain state does not match the audit entries",
    };
  }

  return {
    valid: true,
    checked: entries.length,
    legacy: false,
  };
}
