import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import User from "../models/User.js";
import PasswordResetToken from "../models/PasswordResetToken.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 72;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === "your_resend_api_key") {
    throw new Error("Resend API key is not configured.");
  }

  return new Resend(apiKey);
}

function getResetUrl(token) {
  const configuredUrl = process.env.PASSWORD_RESET_URL;

  if (!configuredUrl) {
    throw new Error("PASSWORD_RESET_URL is not configured.");
  }

  const resetUrl = new URL(configuredUrl);

  // Only allow the configured local frontend or an HTTPS URL.
  if (
    resetUrl.protocol !== "https:" &&
    resetUrl.hostname !== "localhost" &&
    resetUrl.hostname !== "127.0.0.1"
  ) {
    throw new Error("PASSWORD_RESET_URL must use HTTPS.");
  }

  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();

  const genericResponse = {
    message:
      "If an eligible account exists for that email, password reset instructions will be sent.",
  };

  const user = await User.findOne({
    email: normalizedEmail,
    active: true,
  });

  // Keep the response identical for unknown or inactive accounts.
  if (!user) {
    return genericResponse;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Invalidate older unused reset tokens.
  await PasswordResetToken.deleteMany({
    user: user._id,
    usedAt: null,
  });

  await PasswordResetToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
  });

  try {
    const resetUrl = getResetUrl(rawToken);
    const sender = process.env.PASSWORD_RESET_FROM;

    if (!sender) {
      throw new Error("PASSWORD_RESET_FROM is not configured.");
    }

    // Safe diagnostic: do not log the API key or reset token.
    console.info("Password reset sender:", sender);

    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: sender,
      to: user.email,
      subject: "Reset your TrustVault password",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2>Reset your TrustVault password</h2>
          <p>We received a request to reset your password.</p>
          <p>
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 18px;
               background:#1d4ed8;color:#fff;text-decoration:none;
               border-radius:6px">
              Reset password
            </a>
          </p>
          <p>This link expires in 15 minutes and can only be used once.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      // Log the provider's error, but never log the reset token.
      console.error("Resend rejected password-reset email:", {
        statusCode: error.statusCode,
        name: error.name,
        message: error.message,
      });

      throw new Error("Password reset email delivery failed.");
    }

    console.info("Password reset email accepted by Resend:", {
      emailId: data?.id,
    });

    return genericResponse;
  } catch (error) {
    // Remove the unused token if email delivery or configuration fails.
    await PasswordResetToken.deleteOne({ tokenHash });
    throw error;
  }
}

export async function resetPassword(token, newPassword) {
  if (
    typeof token !== "string" ||
    token.length < 20 ||
    token.length > 200 ||
    typeof newPassword !== "string" ||
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    return false;
  }

  const tokenHash = hashToken(token);

  // Atomically claim a valid, unused, unexpired token.
  const resetRecord = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { usedAt: new Date() },
    },
    {
      returnDocument: "after",
    },
  );

  if (!resetRecord) {
    return false;
  }

  try {
    const user = await User.findOne({
      _id: resetRecord.user,
      active: true,
    }).select("+passwordHash");

    if (!user) {
      await PasswordResetToken.deleteOne({ _id: resetRecord._id });
      return false;
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    // Remove all reset tokens belonging to this user.
    await PasswordResetToken.deleteMany({
      user: user._id,
    });

    return true;
  } catch (error) {
    // Logically, the token may have been consumed before a database
    // failure. Ask the user to request a new link if reset fails.
    await PasswordResetToken.deleteOne({ _id: resetRecord._id });
    throw error;
  }
}
