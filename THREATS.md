# TrustVault Threat Model

## 1. Purpose and scope

TrustVault manages user accounts and documents stored in a database and private object storage. This document records important threats, current mitigations, and known limitations.

## 2. Assets to protect

- User passwords and session cookies
- Private documents and document metadata
- Document-sharing permissions
- Database connection credentials
- Supabase service-role credentials
- Audit records
- Administrative functions

## 3. Threats and mitigations

### Unauthorized document access

**Threat:** A user attempts to view or download another user's document without permission.

**Mitigation:** Authenticated document routes use document ownership or explicit permission checks. Unauthorized document access is designed to return a response that does not disclose whether the document exists.

**Remaining risk:** All document routes and edge cases still require ongoing security testing.

### Account compromise and session theft

**Threat:** An attacker obtains a user's credentials or session cookie.

**Mitigation:** Passwords are hashed with bcrypt. Sessions use HTTP-only cookies, a strict same-site setting, and secure cookies in production.

**Remaining risk:** A stolen valid session can still be abused. Production deployment must use HTTPS and appropriate session-secret management.

### Privilege escalation

**Threat:** A normal user attempts to register as an administrator or call administrative endpoints.

**Mitigation:** Public registration assigns the viewer role, and administrative routes require authentication and the admin role.

**Remaining risk:** Role assignment and administrative account provisioning must remain restricted and tested.

### Malicious or oversized uploads

**Threat:** A user uploads a disallowed, malformed, or excessively large file.

**Mitigation:** The application restricts uploads to supported PDF, PNG, and JPEG types, checks file signatures, and applies a 5 MB application limit.

**Remaining risk:** Signature checks do not detect every malicious file. Malware scanning and stronger content-disarm controls are not currently documented as implemented.

### Storage credential exposure

**Threat:** An attacker obtains the Supabase service-role key or accesses documents through a public bucket.

**Mitigation:** Credentials are supplied through environment variables, and the document bucket is configured as private.

**Remaining risk:** A leaked service-role key can grant broad storage access. Rotate exposed credentials immediately and never commit `.env` files.

### Cross-site request abuse

**Threat:** A malicious website attempts to make authenticated requests through a victim's browser.

**Mitigation:** The application uses origin verification, configured CORS, and strict same-site session cookies.

**Remaining risk:** These controls should not be treated as proof of complete CSRF protection. Verify behavior for every state-changing route and deployment configuration.

### Audit-log tampering or gaps

**Threat:** An attacker or faulty process changes audit records or prevents security events from being recorded.

**Mitigation:** Audit entries include hashes linked to preceding entries, allowing certain changes to be detected.

**Remaining risk:** A hash chain is tamper-evident, not tamper-proof. Coordination is process-local, and it is not sufficient for safe concurrent writes across multiple server instances. There is no independent immutable anchor documented here.

### Partial failures across systems

**Threat:** A database update succeeds but storage or audit recording fails, leaving inconsistent state.

**Mitigation:** Some operations include error handling and limited rollback behavior.

**Remaining risk:** Database, storage, and audit operations are not fully transactional. Reconciliation and recovery behavior need further testing.

### Database or service outage

**Threat:** MongoDB or Supabase becomes unavailable, disrupting application operations.

**Mitigation:** The application reports failures through API error handling.

**Remaining risk:** Backups, restoration drills, monitoring, and production incident procedures must be verified separately.

## 4. Security testing priorities

- Verify cross-user document access is denied for read, download, edit, delete, and sharing operations.
- Verify viewer accounts cannot access administrative endpoints.
- Verify invalid sessions and revoked permissions cannot access protected resources.
- Test invalid file signatures, unsupported MIME types, and oversized uploads.
- Test origin validation for state-changing requests.
- Test audit-chain verification and failures during audit writes.
- Confirm no secrets appear in Git history, frontend bundles, logs, or public documentation.

## 5. Residual risks

TrustVault is a project under development, not a claim of independently certified security. Production deployment requires a completed security review, tested backups, secure secret management, and successful automated tests.
