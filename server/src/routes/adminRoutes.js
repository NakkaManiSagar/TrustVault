
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authenticate.js";
import AuditLog from "../models/AuditLog.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/audit", async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
      100
    );

    const filter = {};

    if (req.query.action) {
      if (typeof req.query.action !== "string") {
        return res.status(400).json({ error: "Invalid action filter" });
      }
      filter.action = req.query.action;
    }

    if (req.query.outcome) {
      if (!["success", "denied", "failure"].includes(req.query.outcome)) {
        return res.status(400).json({ error: "Invalid outcome filter" });
      }
      filter.outcome = req.query.outcome;
    }

    const events = await AuditLog.find(filter)
      .select("-details.password -details.token -details.secret")
      .populate("actor", "name email role")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    return res.json({
      events: events.map((event) => ({
        id: event._id,
        actor: event.actor
          ? {
              id: event.actor._id,
              name: event.actor.name,
              email: event.actor.email,
              role: event.actor.role,
            }
          : null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        outcome: event.outcome,
        createdAt: event.createdAt,
        details: event.details,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
