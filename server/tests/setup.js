process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ??=
  "test-only-secret-that-is-long-enough-123456789";
process.env.CLIENT_ORIGIN = "http://localhost:5173";