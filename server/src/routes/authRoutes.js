import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { requireAuth } from "../middleware/authenticate.js";
import {
  requestPasswordReset,
  resetPassword,
} from "../services/passwordResetService.js";

const router = Router();

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 72;

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many password-reset requests. Please try again later.",
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please try again later.",
  },
});

// Register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !validEmail.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return res.status(400).json({
        error: "Invalid registration details",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "viewer",
      });

      return res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          error: "Unable to register with those details",
        });
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      email.length > 254 ||
      typeof password !== "string" ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches || !user.active) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Replace the session ID to prevent session fixation.
    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.userId = user._id.toString();
      req.session.authVersion = user.sessionVersion ?? 0;

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        res.json({
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Request a password-reset email
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  async (req, res, next) => {
    try {
      const { email } = req.body ?? {};

      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !validEmail.test(email.trim())
      ) {
        return res.status(400).json({
          error: "Enter a valid email address",
        });
      }

      const result = await requestPasswordReset(email);

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Set a new password using the emailed token
router.post(
  "/reset-password",
  resetPasswordLimiter,
  async (req, res, next) => {
    try {
      const { token, password } = req.body ?? {};

      if (
        typeof token !== "string" ||
        typeof password !== "string" ||
        password.length < PASSWORD_MIN_LENGTH ||
        password.length > PASSWORD_MAX_LENGTH
      ) {
        return res.status(400).json({
          error: "Invalid reset request",
        });
      }

      const success = await resetPassword(token, password);

      if (!success) {
        return res.status(400).json({
          error: "Invalid or expired reset link. Please request a new one.",
        });
      }

      // Destroy the current session if one exists.
      if (req.session) {
        return req.session.destroy((error) => {
          if (error) return next(error);

          res.clearCookie("trustvault.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
          });

          return res.status(200).json({
            message: "Password reset successful. Please log in with your new password.",
          });
        });
      }

      return res.status(200).json({
        message: "Password reset successful. Please log in with your new password.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post("/logout", (req, res, next) => {
  if (!req.session) {
    return res.status(204).end();
  }

  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("trustvault.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return res.status(204).end();
  });
});

// Get current user
router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

export default router;
