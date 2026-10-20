
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getOriginFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function verifyRequestOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Automated tests may use non-browser clients without origin headers.
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const expectedOrigin = process.env.CLIENT_ORIGIN;
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (!expectedOrigin) {
    return res.status(403).json({
      error: "Request origin not allowed",
    });
  }

  if (origin) {
    if (origin !== expectedOrigin) {
      return res.status(403).json({
        error: "Request origin not allowed",
      });
    }

    return next();
  }

  if (referer) {
    if (getOriginFromReferer(referer) !== expectedOrigin) {
      return res.status(403).json({
        error: "Request origin not allowed",
      });
    }

    return next();
  }

  return res.status(403).json({
    error: "Request origin not allowed",
  });
}
