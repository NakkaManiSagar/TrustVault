
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    if (
      !req.session?.userId ||
      !Number.isInteger(req.session.authVersion)
    ) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const user = await User.findOne({
      _id: req.session.userId,
      active: true,
    }).select("_id name email role sessionVersion");

    if (
      !user ||
      (user.sessionVersion ?? 0) !== req.session.authVersion
    ) {
      return res.status(401).json({
        error: "Session is no longer valid",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
      });
    }

    next();
  };
}
