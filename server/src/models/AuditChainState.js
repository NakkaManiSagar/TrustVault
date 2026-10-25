
import mongoose from "mongoose";

const auditChainStateSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "global",
    },
    sequence: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastHash: {
      type: String,
      required: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model(
  "AuditChainState",
  auditChainStateSchema
);
