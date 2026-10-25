
import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";

import AuditLog from "../src/models/AuditLog.js";
import AuditChainState from "../src/models/AuditChainState.js";
import { verifyAuditChain } from "../src/services/auditService.js";

// Use Google DNS for this one-time migration script.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const STATE_ID = "global";

async function migrate() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from server/.env");
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(process.env.MONGODB_URI);

  console.log("Connected to MongoDB.");

  // Never run this migration twice.
  const existingState = await AuditChainState.findById(STATE_ID).lean();

  if (existingState) {
    throw new Error(
      "Chain state already exists. Do not run this migration again."
    );
  }

  // Read all existing audit entries in their original order.
  const entries = await AuditLog.find()
    .select("+sequence +previousHash +entryHash")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (entries.length === 0) {
    throw new Error("No existing audit entries found; migration aborted.");
  }

  if (entries.some((entry) => Number.isInteger(entry.sequence))) {
    throw new Error(
      "Some entries already have sequence numbers. Manual review required."
    );
  }

  console.log(`Checking ${entries.length} existing audit entries...`);

  // Verify the existing legacy hash chain before modifying any records.
  const verification = await verifyAuditChain();

  if (!verification.valid || verification.legacy !== true) {
    throw new Error(
      `Audit verification failed: ${
        verification.reason ?? "unexpected chain state"
      }`
    );
  }

  console.log("Legacy audit chain verified.");

  // Assign sequence numbers and create the state in one transaction.
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const stateNow = await AuditChainState.collection.findOne(
        { _id: STATE_ID },
        { session }
      );

      if (stateNow) {
        throw new Error("Chain state appeared during migration.");
      }

      const currentCount = await AuditLog.countDocuments().session(session);

      if (currentCount !== entries.length) {
        throw new Error("Audit entries changed; aborting migration.");
      }

      const alreadyNumbered = await AuditLog.countDocuments({
        sequence: { $type: "number" },
      }).session(session);

      if (alreadyNumbered !== 0) {
        throw new Error("Sequence numbers appeared; aborting migration.");
      }

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];

        const result = await AuditLog.collection.updateOne(
          {
            _id: entry._id,
            sequence: { $exists: false },
          },
          {
            $set: { sequence: index + 1 },
          },
          { session }
        );

        if (result.modifiedCount !== 1) {
          throw new Error(
            `Could not assign sequence to audit entry ${entry._id}`
          );
        }
      }

      const lastEntry = entries[entries.length - 1];
      const now = new Date();

      await AuditChainState.collection.insertOne(
        {
          _id: STATE_ID,
          sequence: entries.length,
          lastHash: lastEntry.entryHash,
          createdAt: now,
          updatedAt: now,
        },
        { session }
      );
    });

    console.log(
      `Migration committed: ${entries.length} entries preserved and numbered.`
    );
  } finally {
    await session.endSession();
  }

  // Verify the migrated chain after the transaction commits.
  const finalVerification = await verifyAuditChain();

  if (!finalVerification.valid || finalVerification.legacy !== false) {
    throw new Error(
      `Post-migration verification failed: ${
        finalVerification.reason ?? "unexpected result"
      }`
    );
  }

  console.log("SUCCESS: The migrated audit chain is valid.");
  console.log(`Verified entries: ${finalVerification.checked}`);
}

migrate()
  .catch((error) => {
    console.error("MIGRATION FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
