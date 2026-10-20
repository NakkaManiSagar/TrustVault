
import mongoose from "mongoose";
import Document from "../models/Document.js";
import DocumentPermission from "../models/DocumentPermission.js";
import { createAuditLog } from "../services/auditService.js";

const VALID_PERMISSIONS = ["read", "edit", "owner"];

async function logDeniedAccess(
  req,
  documentId,
  reason,
  requiredPermission
) {
  await createAuditLog({
    actor: req.user?._id ?? null,
    action: "ACCESS_DENIED",
    resourceType: "document",
    resourceId: documentId ?? null,
    outcome: "denied",
    ipAddress: req.ip ?? "",
    userAgent: req.get("user-agent") ?? "",
    details: {
      reason,
      requiredPermission,
      method: req.method,
      path: req.baseUrl + req.path,
    },
  });
}

export function requireDocumentPermission(
  requiredPermission = "read"
) {
  if (!VALID_PERMISSIONS.includes(requiredPermission)) {
    throw new TypeError(
      `Invalid document permission: ${requiredPermission}`
    );
  }

  return async function authorizeDocument(req, res, next) {
    try {
      const documentId = req.params.documentId ?? req.params.id;

      if (
        typeof documentId !== "string" ||
        !/^[a-f\d]{24}$/i.test(documentId) ||
        !mongoose.isValidObjectId(documentId)
      ) {
        await logDeniedAccess(
          req,
          null,
          "invalid_document_id",
          requiredPermission
        );

        return res.status(404).json({
          error: "Document not found or access denied",
        });
      }

      const document = await Document.findOne({
        _id: documentId,
        deletedAt: null,
      });

      if (!document) {
        await logDeniedAccess(
          req,
          documentId,
          "not_found_or_inaccessible",
          requiredPermission
        );

        return res.status(404).json({
          error: "Document not found or access denied",
        });
      }

      const isOwner =
        String(document.owner) === String(req.user._id);

      if (isOwner) {
        req.document = document;
        req.documentAccess = "owner";
        return next();
      }

      if (requiredPermission === "owner") {
        await logDeniedAccess(
          req,
          document._id,
          "owner_required",
          requiredPermission
        );

        return res.status(404).json({
          error: "Document not found or access denied",
        });
      }

      const grant = await DocumentPermission.findOne({
        document: document._id,
        user: req.user._id,
      }).select("permission");

      const hasReadAccess =
        grant?.permission === "read" ||
        grant?.permission === "edit";

      const hasEditAccess = grant?.permission === "edit";

      const allowed =
        requiredPermission === "read"
          ? hasReadAccess
          : hasEditAccess;

      if (!allowed) {
        await logDeniedAccess(
          req,
          document._id,
          "missing_required_permission",
          requiredPermission
        );

        return res.status(404).json({
          error: "Document not found or access denied",
        });
      }

      req.document = document;
      req.documentAccess = grant.permission;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
