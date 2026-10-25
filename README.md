# TrustVault 🔐

### Secure Document Management, Sharing & Audit Logging

TrustVault is a secure document-management application designed to help users upload, organize, access, and share documents with controlled permissions. It includes user authentication, private file storage, access control, and audit logging to support accountability and document security.

## 📌 Project Overview

Managing sensitive documents requires more than file uploads. Users need controlled access, secure storage, and visibility into important actions.

TrustVault addresses these needs through a web application that combines a React frontend, an Express backend, a MongoDB database, and private file storage.

**Project:** TrustVault
**Category:** Full-Stack Web Application / Document Security
**Status:** Core application implemented; automated tests and production build verified locally.

## ✨ Key Features

### Authentication and Access Control

* User registration and login.
* Password hashing using bcrypt.
* Server-side session-based authentication.
* Role-based authorization for administrative functionality.
* New registrations receive the viewer role by default.

### Document Management

* Upload and manage documents.
* Download documents subject to authorization checks.
* Keep documents private by default.
* Restrict document operations according to ownership and granted permissions.

### Document Sharing

* Grant registered users read or edit access to documents.
* View users who have been granted access.
* Revoke previously granted permissions.
* Enforce permission checks on protected document operations.

### Audit Logging

* Record important security-related actions.
* Track document-sharing grants and revocations.
* Provide an audit activity interface.
* Restrict administrative audit access to authorized administrators.

### Dashboard

* View document-related information.
* Navigate between document views.
* Access sharing controls and available audit activity.
* Use a responsive interface built with React and CSS.

## 🛠️ Technology Stack

| Component        | Technology                      |
| ---------------- | ------------------------------- |
| Frontend         | React                           |
| Frontend tooling | Vite                            |
| Styling          | CSS                             |
| Icons            | Lucide React                    |
| Backend          | Node.js                         |
| API framework    | Express                         |
| Database         | MongoDB                         |
| Database ODM     | Mongoose                        |
| Authentication   | Server-side sessions and bcrypt |
| File storage     | Supabase Storage                |
| Testing          | Vitest and Supertest            |
| Version control  | Git and GitHub                  |

## 🏗️ Architecture

TrustVault uses a frontend/backend architecture.

```text
                   ┌──────────────────────┐
                   │       User           │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ React + Vite Client  │
                   │ Dashboard and UI     │
                   └──────────┬───────────┘
                              │ HTTP API
                              ▼
                   ┌──────────────────────┐
                   │ Express Backend      │
                   │ Authentication       │
                   │ Authorization         │
                   │ Document Operations  │
                   │ Audit Logging         │
                   └───────┬────────┬─────┘
                           │        │
                    ┌──────▼───┐ ┌──▼────────────┐
                    │ MongoDB  │ │ Supabase      │
                    │ Metadata │ │ File Storage  │
                    └──────────┘ └───────────────┘
```

The backend enforces authorization before allowing protected document operations. MongoDB stores application data, while Supabase Storage provides file storage.

## 📂 Project Structure

```text
TrustVault/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── package.json
│   └── ...
├── server/
│   ├── src/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── ...
├── docs/
│   └── API.md
├── THREATS.md
├── PROMPTS.md
└── README.md
```

## ⚙️ Prerequisites

Install the following before running the project:

* Node.js and npm.
* Git.
* A MongoDB database.
* A Supabase project with a private storage bucket.

Use a Node.js version compatible with the project's dependencies.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/NakkaManiSagar/TrustVault.git
cd TrustVault
```

### 2. Configure the backend

Open a terminal in the project root:

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

Open `server/.env` and configure the required environment variables with your own credentials.

Required configuration includes:

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_long_random_session_secret
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=your_private_bucket_name
```

Use the actual variable names and expected values defined by the backend configuration. Do not replace existing project-specific settings blindly.

Start the backend:

```powershell
npm run dev
```

Keep this terminal running.

### 3. Configure the frontend

Open a second terminal:

```powershell
cd client
npm ci
npm run dev
```

Open the local frontend address printed by Vite, typically:

`http://localhost:5173`

If the backend runs at a different address, configure `VITE_API_URL` according to the frontend's API configuration.

### 4. Verify the application

Confirm that:

* The frontend loads.
* The backend starts successfully.
* MongoDB connects successfully.
* Authentication works.
* Document operations work.
* Sharing and revocation behave according to permissions.

Use your own test accounts and development configuration.

## 🧪 Testing

### Backend automated tests

From the `server` directory:

```powershell
npm test
```

**Latest verified result:**

* 7 test files passed.
* 37 tests passed.
* Authentication, document access isolation, sharing and revocation, audit logging, origin validation, health checks, and admin authorization were tested.

One audit-failure test intentionally simulates an audit-storage error. Its expected diagnostic output does not indicate a failed test.

The MongoDB Memory Server dependency may need to download its database binary when tests are run for the first time.

### Frontend production build

From the `client` directory:

```powershell
npm run build
```

**Latest verified result:** Production build completed successfully using Vite.

Run both commands again after making further changes.

## 🔒 Authorization Model

TrustVault uses authentication and permission checks to protect document operations.

* New registrations are assigned the viewer role.
* Document owners can manage their documents and sharing permissions.
* Shared users receive explicitly granted read or edit access.
* Protected operations must enforce the appropriate document permissions.
* Administrative audit endpoints require the administrator role.
* Revoked permissions should no longer authorize subsequent protected requests.

Authorization must be enforced by the backend, not merely by hiding buttons in the frontend.

## 🛡️ Security Considerations

TrustVault incorporates access controls and audit logging, but it should not be considered production-ready solely because its automated tests pass.

Important considerations include:

* Keep the Supabase storage bucket private.
* Never commit database credentials, session secrets, or service-role keys.
* Use HTTPS in production.
* Configure session cookies and session storage appropriately for deployment.
* Review CSRF protection and cross-origin request configuration.
* Validate file uploads and consider malware scanning.
* Protect administrative accounts and restrict administrative privileges.
* Review audit-log integrity, retention, and access controls.
* Assess failure handling and consistency across database, storage, and audit operations.
* Review deployment configuration before exposing the application publicly.

The audit hash chain is tamper-evident rather than tamper-proof. Additional safeguards may be necessary for high-assurance audit requirements.

## 📖 Documentation

* **API Reference:** [`docs/API.md`](docs/API.md)
* **Threat Model:** [`THREATS.md`](THREATS.md)
* **AI Prompt Log:** [`PROMPTS.md`](PROMPTS.md)

Consult these documents for additional implementation and security details.

## 🌐 Deployment and Demonstration

Deployment details should be added after the relevant environments have been deployed and verified.

* **Live application:** Not yet documented.
* **Demo video:** Not yet documented.
* **Demo account:** Not yet documented.

Do not publish private credentials or real user data in demonstrations.

## 🗺️ Future Improvements

Potential improvements include:

* Automated security and dependency scanning.
* Stronger production session management and CSRF defenses.
* Malware scanning for uploaded documents.
* Enhanced audit integrity and retention controls.
* Improved operational monitoring and error reporting.
* Deployment automation and continuous integration.
* Additional end-to-end tests.
* Production deployment verification.

## 👨‍💻 Project Repository

GitHub: https://github.com/NakkaManiSagar/TrustVault

---

**TrustVault — Secure access. Controlled sharing. Accountable document management.**
