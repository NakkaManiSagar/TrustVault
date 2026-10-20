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
import { authApi, documentsApi } from "./services/api";

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
  return new Date(date).toLocaleDateString();
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
    }
  }, [user]);

  const visibleDocuments = documents.filter((doc) => {
    const query = search.toLowerCase();

    return (
      (doc.title || "").toLowerCase().includes(query) ||
      (doc.originalName || "").toLowerCase().includes(query) ||
      (doc.category || "").toLowerCase().includes(query)
    );
  });

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

  async function handleLogout() {
    try {
      await authApi.logout();
      setUser(null);
      setDocuments([]);
      setActiveNav("Overview");
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
          <span className="brand-mark"><ShieldCheck size={23} /></span>
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
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <span className="security-icon"><LockKeyhole size={18} /></span>
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
            <span className="environment-pill"><span /> Connected</span>
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
                <span className="stat-icon blue"><Files size={18} /></span>
              </div>
              <div className="stat-number">{documents.length.toString().padStart(2, "0")}</div>
              <div className="stat-foot">
                <span className="foot-neutral">
                  <LockKeyhole size={13} /> Account data
                </span>
                <span>Accessible documents</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Shared documents</span>
                <span className="stat-icon purple"><Share2 size={18} /></span>
              </div>
              <div className="stat-number">—</div>
              <div className="stat-foot">
                <span className="foot-neutral">Not yet counted</span>
                <span>Access grants</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Security events</span>
                <span className="stat-icon green"><Activity size={18} /></span>
              </div>
              <div className="stat-number">—</div>
              <div className="stat-foot">
                <span className="foot-neutral">Admin-only API</span>
                <span>Audit records</span>
              </div>
            </article>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {activeNav === "Overview"
                    ? "Recent documents"
                    : activeNav}
                </h2>
                <p>Your document library at a glance</p>
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
                onClick={() => setNotice("Use search to find documents by title or category.")}
              >
                All documents <span>?</span>
              </button>
            </div>

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
                visibleDocuments.map((doc) => (
                  <div className="document-row" key={doc._id}>
                    <div className="file-name">
                      <span className={`file-icon ${doc.mimeType?.startsWith("image/") ? "image-file" : ""}`}>
                        {doc.mimeType?.startsWith("image/")
                          ? <ImageIcon size={18} />
                          : <FileText size={18} />}
                      </span>
                      <span>
                        <strong>{doc.title || doc.originalName}</strong>
                        <small>{doc.originalName}</small>
                      </span>
                    </div>
                    <span className="category-tag">{doc.category}</span>
                    <span className="updated">
                      <Clock3 size={14} /> {formatUpdated(doc.createdAt)}
                    </span>
                    <span className="file-size">{formatFileSize(doc.sizeBytes)}</span>
                    <button
                      className="text-button"
                      onClick={() => handleDownload(doc)}
                    >
                      Download
                    </button>
                  </div>
                ))
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

          <div className="bottom-grid">
            <section className="mini-panel">
              <div className="mini-title">
                <span className="mini-icon"><ShieldCheck size={17} /></span>
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
                <span className="mini-icon violet"><Activity size={17} /></span>
                <h3>Audit trail</h3>
              </div>
              <p>
                Audit records are available through the protected admin API.
              </p>
              <button
                className="mini-link"
                onClick={() => setNotice("Audit activity is restricted to administrators and is not yet displayed here.")}
              >
                Audit access information <ArrowUpRight size={14} />
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
