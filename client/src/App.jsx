import { useEffect, useState } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  Files,
  Share2,
  Activity,
  Search,
  Bell,
  Plus,
  LockKeyhole,
  FileText,
  Image as ImageIcon,
  Clock3,
  ArrowUpRight,
} from "lucide-react";

import AuthScreen from "./components/AuthScreen";
import { authApi, documentsApi, adminApi } from "./services/api";

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My documents", icon: Files },
  { label: "Shared with me", icon: Share2 },
  { label: "Audit activity", icon: Activity },
];

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdated(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimestamp(date) {
  if (!date) return "Time unavailable";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Time unavailable";
  }

  return parsedDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function App() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState([]);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [shareDocument, setShareDocument] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("read");
  const [sharing, setSharing] = useState(false);

  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState("");

  const [auditEvents, setAuditEvents] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState("");

  useEffect(() => {
    let active = true;

    authApi.me()
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingAuth(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function loadDocuments() {
    setLoadingDocs(true);

    try {
      const result = await documentsApi.list();
      setDocuments(result.documents || []);
    } catch (error) {
      setNotice(error.message || "Could not load documents.");
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadDocuments();
    } else {
      setDocuments([]);
      setPermissions([]);
      setAuditEvents([]);
    }
  }, [user]);

  const getOwnerId = (doc) =>
    String(doc.owner?._id || doc.owner?.id || doc.owner || "");

  const currentUserId = String(user?._id || user?.id || "");

  const ownedDocuments = documents.filter(
    (doc) => currentUserId && getOwnerId(doc) === currentUserId
  );

  const sharedDocuments = documents.filter(
    (doc) => currentUserId && getOwnerId(doc) !== currentUserId
  );

  const currentDocuments =
    activeNav === "Shared with me"
      ? sharedDocuments
      : activeNav === "My documents"
        ? ownedDocuments
        : documents;

  const visibleDocuments = currentDocuments.filter((doc) => {
    const query = search.toLowerCase();

    return (
      (doc.title || "").toLowerCase().includes(query) ||
      (doc.originalName || "").toLowerCase().includes(query) ||
      (doc.category || "").toLowerCase().includes(query)
    );
  });

  async function loadAuditEvents() {
    if (user?.role !== "admin") {
      setAuditEvents([]);
      setAuditError("Audit activity is available to administrators only.");
      return;
    }

    setLoadingAudit(true);
    setAuditError("");

    try {
      const result = await adminApi.audit({ limit: 50 });
      setAuditEvents(result.events || []);
    } catch (error) {
      setAuditEvents([]);
      setAuditError(error.message || "Unable to load audit activity.");
    } finally {
      setLoadingAudit(false);
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ];

    if (!allowedTypes.includes(file.type)) {
      setNotice("Choose a PDF, PNG, or JPEG file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice("The maximum file size is 5 MB.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      await documentsApi.upload(file, {
        title: file.name,
        category: "General",
      });

      await loadDocuments();
      setNotice("Document uploaded successfully.");
    } catch (error) {
      setNotice(error.message || "Upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleShare(event) {
    event.preventDefault();

    if (!shareDocument || !shareEmail.trim()) return;

    setSharing(true);

    try {
      await documentsApi.share(
        shareDocument._id,
        shareEmail.trim(),
        sharePermission
      );

      setNotice("Document access granted successfully.");
      setShareEmail("");

      await loadPermissions(shareDocument._id);
      await loadDocuments();
    } catch (error) {
      setNotice(error.message || "Could not share document.");
    } finally {
      setSharing(false);
    }
  }

  async function loadPermissions(documentId) {
    setLoadingPermissions(true);

    try {
      const result = await documentsApi.permissions(documentId);
      setPermissions(result.permissions || []);
    } catch (error) {
      setPermissions([]);
      setNotice(error.message || "Could not load document permissions.");
    } finally {
      setLoadingPermissions(false);
    }
  }

  async function handleRevokePermission(documentId, targetUserId) {
    const confirmed = window.confirm(
      "Revoke this user's access to the document?"
    );

    if (!confirmed) return;

    setRevokingUserId(targetUserId);

    try {
      await documentsApi.revoke(documentId, targetUserId);
      setNotice("Document access revoked successfully.");
      await loadPermissions(documentId);
      await loadDocuments();
    } catch (error) {
      setNotice(error.message || "Could not revoke document access.");
    } finally {
      setRevokingUserId("");
    }
  }

  async function handleDeleteDocument(doc) {
    if (!window.confirm(`Delete "${doc.title || doc.originalName}"?`)) {
      return;
    }

    try {
      await documentsApi.remove(doc._id);
      setNotice("Document deleted.");

      if (shareDocument?._id === doc._id) {
        setShareDocument(null);
        setPermissions([]);
      }

      await loadDocuments();
    } catch (error) {
      setNotice(error.message || "Could not delete document.");
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
      setUser(null);
      setDocuments([]);
      setPermissions([]);
      setAuditEvents([]);
      setActiveNav("Overview");
      setShareDocument(null);
      setNotice("");
    } catch (error) {
      setNotice(error.message || "Logout failed.");
    }
  }

  async function handleDownload(doc) {
    try {
      const blob = await documentsApi.download(doc._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = doc.originalName || doc.title || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setNotice(error.message || "Download failed.");
    }
  }

  if (checkingAuth) {
    return <main className="auth-page">Checking your secure session…</main>;
  }

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#home"
          onClick={() => setActiveNav("Overview")}
        >
          <span className="brand-mark">
            <ShieldCheck size={23} />
          </span>
          <span>
            trustvault
            <small>SECURE WORKSPACE</small>
          </span>
        </a>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="side-nav">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "active" : ""}`}
              onClick={() => {
                setActiveNav(label);
                setNotice("");

                if (label === "Audit activity") {
                  if (user?.role === "admin") {
                    loadAuditEvents();
                  } else {
                    setAuditEvents([]);
                    setAuditError(
                      "Audit activity is available to administrators only."
                    );
                  }
                }
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <span className="security-icon">
              <LockKeyhole size={18} />
            </span>
            <strong>Your files, protected.</strong>
            <p>
              Access controls and audit history help keep sensitive
              documents accountable.
            </p>
            <span className="security-status">
              <span /> Security overview
            </span>
          </div>

          <div className="profile">
            <div className="avatar">
              {(user.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              className="text-button"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activeNav}</strong>
          </div>

          <div className="top-actions">
            <span className="environment-pill">
              <span /> Connected
            </span>

            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setNotice("No notifications are configured yet.")}
            >
              <Bell size={19} />
            </button>

            <div className="avatar small-avatar">
              {(user.name || "U").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <section className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                PRIVATE DOCUMENT MANAGEMENT
              </div>

              <h1>
                {activeNav === "Overview"
                  ? "Your workspace, secured."
                  : activeNav}
              </h1>

              <p className="subtitle">
                {activeNav === "Overview"
                  ? "Keep important documents organized, shared intentionally, and accountable."
                  : `Explore ${activeNav.toLowerCase()} in your TrustVault workspace.`}
              </p>
            </div>

            <label className="primary-button">
              <Plus size={18} />
              {uploading ? "Uploading…" : "Upload document"}

              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={handleUpload}
                disabled={uploading}
                hidden
              />
            </label>
          </div>

          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>Dismiss</button>
            </div>
          )}

          <div className="stat-grid">
            <article className="stat-card">
              <div className="stat-top">
                <span>Total documents</span>
                <span className="stat-icon blue">
                  <Files size={18} />
                </span>
              </div>

              <div className="stat-number">
                {documents.length.toString().padStart(2, "0")}
              </div>

              <div className="stat-foot">
                <span className="foot-neutral">
                  <LockKeyhole size={13} /> Account data
                </span>
                <span>Accessible documents</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Shared with me</span>
                <span className="stat-icon purple">
                  <Share2 size={18} />
                </span>
              </div>

              <div className="stat-number">
                {sharedDocuments.length.toString().padStart(2, "0")}
              </div>

              <div className="stat-foot">
                <span className="foot-neutral">Shared access</span>
                <span>Received documents</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Security events</span>
                <span className="stat-icon green">
                  <Activity size={18} />
                </span>
              </div>

              <div className="stat-number">
                {user?.role === "admin"
                  ? auditEvents.length.toString().padStart(2, "0")
                  : "—"}
              </div>

              <div className="stat-foot">
                <span className="foot-neutral">
                  {user?.role === "admin" ? "Administrator" : "Restricted"}
                </span>
                <span>
                  {user?.role === "admin"
                    ? "Loaded audit events"
                    : "Admin-only records"}
                </span>
              </div>
            </article>
          </div>

          {activeNav !== "Audit activity" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {activeNav === "Overview"
                      ? "Recent documents"
                      : activeNav}
                  </h2>

                  <p>
                    {activeNav === "Shared with me"
                      ? "Documents other users have shared with you"
                      : activeNav === "My documents"
                        ? "Documents you own"
                        : "Your document library at a glance"}
                  </p>
                </div>

                <button
                  className="text-button"
                  onClick={() => setActiveNav("My documents")}
                >
                  View library <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search documents or categories..."
                  />
                </div>

                <button
                  className="filter-button"
                  onClick={() =>
                    setNotice("Use search to find documents by title or category.")
                  }
                >
                  All documents <span>?</span>
                </button>
              </div>

              {shareDocument && (
                <div className="share-panel">
                  <form className="share-form" onSubmit={handleShare}>
                    <h3>
                      Share {shareDocument.title || shareDocument.originalName}
                    </h3>

                    <label>
                      User email
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(event) => setShareEmail(event.target.value)}
                        placeholder="colleague@example.com"
                        required
                      />
                    </label>

                    <label>
                      Permission
                      <select
                        value={sharePermission}
                        onChange={(event) =>
                          setSharePermission(event.target.value)
                        }
                      >
                        <option value="read">Can view and download</option>
                        <option value="edit">
                          Can view, download and edit details
                        </option>
                      </select>
                    </label>

                    <div className="share-form-actions">
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={sharing}
                      >
                        {sharing ? "Sharing..." : "Grant access"}
                      </button>

                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setShareDocument(null);
                          setPermissions([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>

                  <div className="permission-list">
                    <h4>People with access</h4>

                    {loadingPermissions ? (
                      <p>Loading permissions...</p>
                    ) : permissions.length === 0 ? (
                      <p>No other users currently have access.</p>
                    ) : (
                      permissions.map((grant) => (
                        <div className="permission-row" key={grant.user.id}>
                          <div>
                            <strong>
                              {grant.user.name || grant.user.email}
                            </strong>
                            <small>{grant.user.email}</small>
                            <span className="permission-badge">
                              {grant.permission === "edit"
                                ? "Edit access"
                                : "Read access"}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="text-button danger-button"
                            disabled={revokingUserId === grant.user.id}
                            onClick={() =>
                              handleRevokePermission(
                                shareDocument._id,
                                grant.user.id
                              )
                            }
                          >
                            {revokingUserId === grant.user.id
                              ? "Revoking..."
                              : "Revoke"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="document-table">
                <div className="table-head">
                  <span>DOCUMENT NAME</span>
                  <span>CATEGORY</span>
                  <span>DATE ADDED</span>
                  <span>SIZE</span>
                  <span>ACTION</span>
                </div>

                {loadingDocs ? (
                  <div className="empty-state">Loading your documents…</div>
                ) : visibleDocuments.length ? (
                  visibleDocuments.map((doc) => {
                    const isOwner = getOwnerId(doc) === currentUserId;

                    return (
                      <div className="document-row" key={doc._id}>
                        <div className="file-name">
                          <span
                            className={`file-icon ${
                              doc.mimeType?.startsWith("image/")
                                ? "image-file"
                                : ""
                            }`}
                          >
                            {doc.mimeType?.startsWith("image/") ? (
                              <ImageIcon size={18} />
                            ) : (
                              <FileText size={18} />
                            )}
                          </span>

                          <span>
                            <strong>{doc.title || doc.originalName}</strong>
                            <small>{doc.originalName}</small>

                            {!isOwner && (
                              <small>
                                Shared by{" "}
                                {doc.owner?.name ||
                                  doc.owner?.email ||
                                  "Another user"}
                              </small>
                            )}
                          </span>
                        </div>

                        <span className="category-tag">{doc.category}</span>

                        <span className="updated">
                          <Clock3 size={14} /> {formatUpdated(doc.createdAt)}
                        </span>

                        <span className="file-size">
                          {formatFileSize(doc.sizeBytes)}
                        </span>

                        <div className="document-actions">
                          <button
                            className="text-button"
                            onClick={() => handleDownload(doc)}
                          >
                            Download
                          </button>

                          {isOwner && (
                            <>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setShareDocument(doc);
                                  setShareEmail("");
                                  setSharePermission("read");
                                  setPermissions([]);
                                  loadPermissions(doc._id);
                                }}
                              >
                                Share
                              </button>

                              <button
                                className="text-button danger-button"
                                onClick={() => handleDeleteDocument(doc)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    {search
                      ? "No matching documents. Try another search."
                      : "No documents found. Upload a document to get started."}
                  </div>
                )}
              </div>

              <div className="panel-footer">
                <span>Documents loaded from your TrustVault account</span>
                <button onClick={loadDocuments}>
                  Refresh <ArrowUpRight size={14} />
                </button>
              </div>
            </section>
          )}

          {activeNav === "Audit activity" && (
            <section className="panel audit-panel">
              <div className="panel-heading">
                <div>
                  <h2>Audit activity</h2>
                  <p>Security events recorded by TrustVault.</p>
                </div>

                {user?.role === "admin" && (
                  <button
                    className="text-button"
                    onClick={loadAuditEvents}
                    disabled={loadingAudit}
                  >
                    {loadingAudit ? "Refreshing..." : "Refresh"}
                  </button>
                )}
              </div>

              {user?.role !== "admin" ? (
                <div className="empty-state">
                  Audit activity is available to administrators only.
                </div>
              ) : loadingAudit ? (
                <div className="empty-state">Loading audit records...</div>
              ) : auditError ? (
                <div className="empty-state">{auditError}</div>
              ) : auditEvents.length === 0 ? (
                <div className="empty-state">
                  No audit events are available yet.
                </div>
              ) : (
                <div className="audit-list">
                  {auditEvents.map((event) => (
                    <article className="audit-row" key={event.id}>
                      <div className="audit-event-icon">
                        <Activity size={18} />
                      </div>

                      <div className="audit-event-details">
                        <strong>
                          {(event.action || "Unknown action").replaceAll(
                            "_",
                            " "
                          )}
                        </strong>

                        <span>
                          {event.actor?.name ||
                            event.actor?.email ||
                            "Unknown user"}
                          {" · "}
                          {event.resourceType || "Resource"}
                        </span>

                        <small>{formatTimestamp(event.createdAt)}</small>
                      </div>

                      <span
                        className={`audit-outcome outcome-${
                          event.outcome || "unknown"
                        }`}
                      >
                        {event.outcome || "Unknown"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="bottom-grid">
            <section className="mini-panel">
              <div className="mini-title">
                <span className="mini-icon">
                  <ShieldCheck size={17} />
                </span>
                <h3>Access, by design</h3>
              </div>

              <p>
                Document permissions are checked by the server on every
                protected request.
              </p>

              <span className="mini-link">
                Permission-aware architecture <ArrowUpRight size={14} />
              </span>
            </section>

            <section className="mini-panel">
              <div className="mini-title">
                <span className="mini-icon violet">
                  <Activity size={17} />
                </span>
                <h3>Audit trail</h3>
              </div>

              <p>
                Audit records are available through the protected admin API.
              </p>

              <button
                className="mini-link"
                onClick={() => setActiveNav("Audit activity")}
              >
                View audit activity <ArrowUpRight size={14} />
              </button>
            </section>
          </div>

          <footer className="page-footer">
            <span>TRUSTVAULT © 2026</span>
            <span>
              <LockKeyhole size={13} /> Secure workspace
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}