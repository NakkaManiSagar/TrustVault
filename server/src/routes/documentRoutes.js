
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import Document from "../models/Document.js";
import DocumentPermission from "../models/DocumentPermission.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/authenticate.js";
import {
  requireDocumentPermission,
} from "../middleware/authorizeDocument.js";
import { createAuditLog } from "../services/auditService.js";
import {
  uploadObject,
  downloadObject,
  deleteObject,
} from "../services/storageService.js";

const router = Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const allowedCategories = new Set([
  "General",
  "Academic",
  "Identity",
  "Finance",
  "Medical",
  "Other",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    parts: 12,
  },
  fileFilter(req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error(
        "Only PDF, PNG and JPEG files are allowed"
      );
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
});

router.use(requireAuth);

function hasValidSignature(file) {
  const buffer = file.buffer;

  if (file.mimetype === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (file.mimetype === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }

  if (file.mimetype === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  return false;
}

function safeFilename(filename) {
  return (
    basename(filename)
      .replace(/[\r\n"]/g, "_")
      .replace(/[^\w.\- ()]/g, "_")
      .slice(0, 150) || "document"
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function audit(req, data) {
  return createAuditLog({
    actor: req.user._id,
    ipAddress: req.ip ?? "",
    userAgent: req.get("user-agent") ?? "",
    ...data,
  });
}

// List documents owned by the current user or explicitly shared with them.
router.get("/", async (req, res, next) => {
  try {
    const { search, category, from, to } = req.query;

    if (
      (search !== undefined &&
        (typeof search !== "string" || search.length > 100)) ||
      (category !== undefined &&
        (typeof category !== "string" ||
          !allowedCategories.has(category))) ||
      (from !== undefined &&
        (typeof from !== "string" || Number.isNaN(Date.parse(from)))) ||
      (to !== undefined &&
        (typeof to !== "string" || Number.isNaN(Date.parse(to))))
    ) {
      return res.status(400).json({
        error: "Invalid search filters",
      });
    }

    const grants = await DocumentPermission.find({
      user: req.user._id,
    }).select("document");

    const accessibleIds = await getAccessibleDocumentIds(
      req.user._id,
      grants
    );

    const filter = {
      _id: { $in: accessibleIds },
      deletedAt: null,
    };

    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { title: pattern },
        { originalName: pattern },
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (from || to) {
      filter.createdAt = {};

      if (from) {
        filter.createdAt.$gte = new Date(from);
      }

      if (to) {
        filter.createdAt.$lte = new Date(to);
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte > filter.createdAt.$lte
      ) {
        return res.status(400).json({
          error: "The from date must not be after the to date",
        });
      }
    }

    const documents = await Document.find(filter)
      .select("-storageKey")
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// Calculate the exact set of document IDs visible to a user.
async function getAccessibleDocumentIds(userId, grants) {
  const ids = grants.map((grant) => grant.document);

  const owned = await Document.find({
    owner: userId,
    deletedAt: null,
  }).select("_id");

  ids.push(...owned.map((document) => document._id));

  return ids;
}

// Upload a document to private storage.
router.post("/", upload.single("file"), async (req, res, next) => {
  let storageKey;

  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "A file is required",
      });
    }

    if (!hasValidSignature(file)) {
      return res.status(400).json({
        error: "File content does not match its declared type",
      });
    }

    const rawTitle = req.body.title ?? file.originalname;

    if (typeof rawTitle !== "string") {
      return res.status(400).json({
        error: "Invalid document metadata",
      });
    }

    const title = rawTitle.trim().slice(0, 150);
    const category = req.body.category ?? "General";
    const description = req.body.description ?? "";

    if (
      !title ||
      !allowedCategories.has(category) ||
      typeof description !== "string" ||
      description.length > 1000
    ) {
      return res.status(400).json({
        error: "Invalid document metadata",
      });
    }

    storageKey = `${req.user._id}/${randomUUID()}`;

    await uploadObject({
      storageKey,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    const document = await Document.create({
      title,
      originalName: safeFilename(file.originalname),
      owner: req.user._id,
      category,
      description,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey,
    });

    try {
      await audit(req, {
        action: "DOCUMENT_UPLOAD",
        resourceType: "document",
        resourceId: document._id,
        outcome: "success",
        details: {
          sizeBytes: file.size,
          category,
        },
      });
    } catch (error) {
      await Document.deleteOne({ _id: document._id });
      await deleteObject(storageKey).catch(() => {});
      throw error;
    }

    return res.status(201).json({
      document: {
        id: document._id,
        title: document.title,
        originalName: document.originalName,
        category: document.category,
        sizeBytes: document.sizeBytes,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    if (storageKey) {
      const exists = await Document.exists({
        storageKey,
      }).catch(() => null);

      if (!exists) {
        await deleteObject(storageKey).catch(() => {});
      }
    }

    next(error);
  }
});

// Download only after checking current access on this request.
router.get(
  "/:documentId/download",
  requireDocumentPermission("read"),
  async (req, res, next) => {
    try {
      const document = await Document.findOne({
        _id: req.document._id,
        deletedAt: null,
      }).select("+storageKey");

      if (!document) {
        return res.status(404).json({
          error: "Document not found",
        });
      }

      const buffer = await downloadObject(document.storageKey);

      await audit(req, {
        action: "DOCUMENT_DOWNLOAD",
        resourceType: "document",
        resourceId: document._id,
        outcome: "success",
      });

      res.setHeader(
        "Content-Type",
        "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFilename(document.originalName)}"`
      );

      res.setHeader("X-Content-Type-Options", "nosniff");

      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
);

// Edit metadata: owners and users with edit permission.
router.patch(
  "/:documentId",
  requireDocumentPermission("edit"),
  async (req, res, next) => {
    try {
      const { title, category, description } = req.body;

      if (
        (title !== undefined &&
          (typeof title !== "string" ||
            !title.trim() ||
            title.trim().length > 150)) ||
        (category !== undefined &&
          !allowedCategories.has(category)) ||
        (description !== undefined &&
          (typeof description !== "string" ||
            description.length > 1000))
      ) {
        return res.status(400).json({
          error: "Invalid document metadata",
        });
      }

      // Save the current values so we can compensate if auditing fails.
      const originalValues = {
        title: req.document.title,
        category: req.document.category,
        description: req.document.description,
      };

      if (title !== undefined) {
        req.document.title = title.trim();
      }

      if (category !== undefined) {
        req.document.category = category;
      }

      if (description !== undefined) {
        req.document.description = description;
      }

      await req.document.save();

      try {
        await audit(req, {
          action: "DOCUMENT_EDIT",
          resourceType: "document",
          resourceId: req.document._id,
          outcome: "success",
        });
      } catch (auditError) {
        // Best-effort rollback; this is not an atomic transaction.
        await Document.updateOne(
          { _id: req.document._id },
          { $set: originalValues }
        );

        throw auditError;
      }

      return res.json({
        document: {
          id: req.document._id,
          title: req.document.title,
          category: req.document.category,
          description: req.document.description,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Grant named-user read/edit access. Only the owner can do this.
router.post(
  "/:documentId/permissions",
  requireDocumentPermission("owner"),
  async (req, res, next) => {
    try {
      const email =
        typeof req.body.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const permission = req.body.permission;

      if (!email || !["read", "edit"].includes(permission)) {
        return res.status(400).json({
          error: "A valid email and read/edit permission are required",
        });
      }

      const target = await User.findOne({
        email,
        active: true,
      }).select("_id name email");

      if (!target) {
        return res.status(404).json({
          error: "Active user not found",
        });
      }

      if (String(target._id) === String(req.user._id)) {
        return res.status(400).json({
          error: "You already own this document",
        });
      }

      const grant = await DocumentPermission.findOneAndUpdate(
        {
          document: req.document._id,
          user: target._id,
        },
        {
          $set: {
            permission,
            grantedBy: req.user._id,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      await audit(req, {
        action: "PERMISSION_GRANT",
        resourceType: "permission",
        resourceId: req.document._id,
        outcome: "success",
        details: {
          targetUserId: String(target._id),
          permission,
        },
      });

      return res.status(200).json({
        permission: {
          user: {
            id: target._id,
            name: target.name,
            email: target.email,
          },
          permission: grant.permission,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Revoke access immediately for future requests.
router.delete(
  "/:documentId/permissions/:userId",
  requireDocumentPermission("owner"),
  async (req, res, next) => {
    try {
      const result = await DocumentPermission.deleteOne({
        document: req.document._id,
        user: req.params.userId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          error: "Permission not found",
        });
      }

      await audit(req, {
        action: "PERMISSION_REVOKE",
        resourceType: "permission",
        resourceId: req.document._id,
        outcome: "success",
        details: {
          targetUserId: req.params.userId,
        },
      });

      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// Delete a document: only its owner may do this.
router.delete(
  "/:documentId",
  requireDocumentPermission("owner"),
  async (req, res, next) => {
    try {
      const document = await Document.findById(
        req.document._id
      ).select("+storageKey");

      if (!document || document.deletedAt) {
        return res.status(404).json({
          error: "Document not found",
        });
      }

      // Mark it inaccessible before attempting storage cleanup.
      document.deletedAt = new Date();
      await document.save();

      await audit(req, {
        action: "DOCUMENT_DELETE",
        resourceType: "document",
        resourceId: document._id,
        outcome: "success",
      });

      // A cleanup failure leaves an inaccessible orphan for later cleanup.
      await deleteObject(document.storageKey);

      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
