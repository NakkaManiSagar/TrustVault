
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      enum: [
        "REGISTER",
        "LOGIN",
        "LOGIN_FAILED",
        "LOGOUT",
        "DOCUMENT_UPLOAD",
        "DOCUMENT_VIEW",
        "DOCUMENT_DOWNLOAD",
        "DOCUMENT_EDIT",
        "DOCUMENT_DELETE",
        "PERMISSION_GRANT",
        "PERMISSION_REVOKE",
        "ACCESS_DENIED",
      ],
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["user", "document", "permission", "system"],
      default: "document",
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    outcome: {
      type: String,
      enum: ["success", "denied", "failure"],
      required: true,
    },
    ipAddress: {
      type: String,
      maxlength: 64,
      default: "",
    },
    userAgent: {
      type: String,
      maxlength: 500,
      default: "",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    previousHash: {
      type: String,
      default: "",
      select: false,
    },
    entryHash: {
      type: String,
      default: "",
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
