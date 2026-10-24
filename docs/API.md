# TrustVault API Reference

Base URL for local development: `http://localhost:5000`

Authentication uses a server-side session cookie. Send requests with credentials enabled when using the browser or an HTTP client.

## Health

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/health` | Public |

## Authentication

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Session-based |
| GET | `/api/auth/me` | Authenticated user |

Registration assigns the viewer role. Users cannot choose an elevated role through public registration.

## Documents

All document endpoints require authentication unless otherwise stated.

| Method | Endpoint | Authorization |
|---|---|---|
| GET | `/api/documents` | Authenticated; results must respect document access rules |
| POST | `/api/documents` | Authenticated; uploads a document |
| GET | `/api/documents/:id/download` | Owner or user with read permission |
| PATCH | `/api/documents/:id` | Owner or user with edit permission |
| POST | `/api/documents/:id/permissions` | Document owner |
| DELETE | `/api/documents/:id/permissions/:userId` | Document owner |
| DELETE | `/api/documents/:id` | Document owner |

Uploads are limited to supported PDF, PNG, and JPEG files, with a 5 MB application limit. File type and signature validation do not guarantee that a file is safe.

Document access failures are intended to avoid revealing whether another user's document exists.

## Administration

| Method | Endpoint | Authorization |
|---|---|---|
| GET | `/api/admin/check` | Authenticated admin |
| GET | `/api/admin/audit` | Authenticated admin |

## Request and error handling

- Use JSON request bodies for JSON-based operations.
- Use the session cookie returned by login for subsequent authenticated requests.
- Browser requests must follow the configured origin policy.
- Exact request fields, response schemas, and error codes should be confirmed against the current route implementations before relying on them in a client integration.

## Security notes

- Keep session secrets and storage service-role keys private.
- Keep the Supabase bucket private.
- Administrative access is role-restricted.
- The audit hash chain is tamper-evident, not tamper-proof.

## Local verification

Start the backend with its environment configured, then request:

`GET http://localhost:5000/api/health`

For the current implementation, consult the route files under `server/src/routes/`.
