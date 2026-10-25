# TrustVault 🔐
### Secure Document Management & Sharing Platform

TrustVault is a web application for managing, accessing, and sharing documents with controlled access and auditable activity. It provides a central workspace for documents and aims to improve accountability through audit logging and integrity verification.

## 🚀 Features

- **User Authentication:** Register and sign in to access a personal workspace.
- **Document Management:** Upload, list, download, and delete documents.
- **Document Sharing:** Share documents with other users and access documents shared with you.
- **Audit Logging:** Record important application activities.
- **Audit Chain Integrity:** Verify audit records using cryptographic hashes and a sequence-based chain state.
- **Dashboard:** View document counts, shared documents, and recent document activity.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Version Control | Git and GitHub |

## 🏗️ Architecture

```text
User
  |
  v
React Frontend (Vercel)
  |
  v
Express REST API (Render)
  |
  v
MongoDB Atlas
  |
  +-- User and document data
  +-- Sharing information
  +-- Audit records and chain state
```

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- A MongoDB Atlas account or compatible MongoDB deployment
- Git

### 1. Clone the repository

```bash
git clone https://github.com/NakkaManiSagar/TrustVault.git
cd TrustVault
```

### 2. Configure and start the backend

```bash
cd server
npm install
```

Create a `server/.env` file and configure the environment variables required by the application:

```env
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_secure_random_secret
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Use your own MongoDB connection string and a strong, randomly generated session secret. Never commit `.env` files or credentials to GitHub.

Start the backend:

```bash
npm start
```

Keep this terminal running.

### 3. Configure and start the frontend

Open another terminal at the repository root. If the frontend directory is named `client`, run:

```bash
cd client
npm install
```

Create the frontend environment file with the API URL expected by the application:

```env
VITE_API_URL=http://localhost:YOUR_BACKEND_PORT
```

Replace `YOUR_BACKEND_PORT` with the port configured by the backend. Then start the frontend:

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

**Note:** Confirm the actual frontend directory name, backend port, and required environment variables from the repository before running these commands.

## 🌐 Live Deployment

- **Frontend:** https://trust-vault-p3ke.vercel.app/
- **Backend health check:** https://trustvault-api-23me.onrender.com/api/health
- **GitHub repository:** https://github.com/NakkaManiSagar/TrustVault

The Vercel deployment may use a different generated URL. Use the current deployment URL and configure the backend's `CLIENT_ORIGIN` to match it.

## 🔒 Security Considerations

TrustVault includes authentication, session handling, access controls, and audit-chain verification. These features still require comprehensive security testing before the application should be considered production-ready.

- Keep secrets in environment variables.
- Do not commit database credentials or session secrets.
- Verify authorization for document access and sharing.
- Test session expiration, unauthorized access, and invalid uploads.
- Preserve audit history and investigate verification failures.

## 🧪 Current Status

The application has been deployed, and the login and document-upload flow has been tested. The legacy audit-chain migration was completed successfully, with all 17 existing audit entries verified after migration.

Further testing is still needed for the complete sharing workflow, audit activity display, session behavior, permissions, and security edge cases.

## 🚧 Future Improvements

- Automated end-to-end testing
- More comprehensive audit and security monitoring
- Stronger validation for uploaded files
- Improved error handling and user feedback
- Additional access-control and authorization tests

## 👨‍💻 Author

**Mani Sagar Nakka**

GitHub: https://github.com/NakkaManiSagar

---

*Built as a secure document-management project for the Snovasys Fresher Hiring Challenge 2026.*