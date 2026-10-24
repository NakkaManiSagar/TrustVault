# TrustVault

TrustVault is a document-management application with user authentication, private file storage, document sharing, and audit logging.

## Technology stack

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: MongoDB and Mongoose
- Authentication: Server-side sessions and bcrypt
- File storage: Supabase Storage
- Testing: Vitest and Supertest

## Prerequisites

Install Node.js, npm, Git, and configure your own MongoDB database and Supabase project.

## Run the backend

Open PowerShell:

    Set-Location E:\TrustVault\server
    npm ci
    Copy-Item .env.example .env
    # Edit .env with your own valid configuration
    npm run dev

Required environment variables include NODE_ENV, PORT, CLIENT_ORIGIN, MONGODB_URI, SESSION_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BUCKET.

Never commit .env files or publish service-role keys, database credentials, or session secrets.

## Run the frontend

Open a second PowerShell terminal:

    Set-Location E:\TrustVault\client
    npm ci
    npm run dev

Configure VITE_API_URL if the backend is not running at its default URL.

## Tests and build

Backend tests:

    Set-Location E:\TrustVault\server
    npm test

Frontend production build:

    Set-Location E:\TrustVault\client
    npm run build

The MongoDB Memory Server dependency may need to download a database binary before all tests can run.

## Authorization model

- Registration creates viewer accounts.
- Authenticated users can access document endpoints.
- Document owners manage their documents and sharing permissions.
- Shared users are restricted to their granted permissions.
- Administrative endpoints require the admin role.

## Security considerations

- Keep the Supabase bucket private.
- File type validation does not replace malware scanning.
- The audit hash chain is tamper-evident, not tamper-proof.
- Multi-instance audit coordination and consistency across database, storage, and audit operations need further hardening.
- Review CSRF protection and deployment security before production use.

## Project status

Authentication and document upload/download have been exercised manually. The frontend build has succeeded. A recent automated test run encountered MongoDB Memory Server download timeouts, so the full suite still needs a successful run.

Some sharing, audit-interface, deployment, and production-hardening work remains unfinished.

## Deployment and demonstration

Live URL: Not yet documented.

Demo video: Not yet documented.

Demo credentials: Not yet documented.

Only publish these details after the deployment and accounts have been created and verified.

## Documentation

- API reference: [docs/API.md](docs/API.md)
- Threat model: [THREATS.md](THREATS.md)
- AI prompt log: [PROMPTS.md](PROMPTS.md)
