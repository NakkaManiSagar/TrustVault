
import mongoose from "mongoose";

const documentPermissionSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permission: {
      type: String,
      enum: ["read", "edit"],
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

documentPermissionSchema.index(
  { document: 1, user: 1 },
  { unique: true }
);

documentPermissionSchema.index({ user: 1, document: 1 });

export default mongoose.model(
  "DocumentPermission",
  documentPermissionSchema
);
