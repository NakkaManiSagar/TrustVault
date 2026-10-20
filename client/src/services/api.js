const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export const authApi = {
  login: (email, password) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  me: () => apiRequest("/api/auth/me"),

  logout: () =>
    apiRequest("/api/auth/logout", { method: "POST" }),
};

export const documentsApi = {
  list: (filters = {}) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    return apiRequest(`/api/documents/${query ? `?${query}` : ""}`);
  },

  upload: (file, metadata = {}) => {
    const formData = new FormData();
    formData.append("file", file);

    if (metadata.title) formData.append("title", metadata.title);
    if (metadata.category) formData.append("category", metadata.category);
    if (metadata.description) {
      formData.append("description", metadata.description);
    }

    return apiRequest("/api/documents/", {
      method: "POST",
      body: formData,
    });
  },

  download: async (documentId) => {
    const response = await fetch(
      `${API_BASE_URL}/api/documents/${encodeURIComponent(documentId)}/download`,
      { credentials: "include" }
    );

    if (!response.ok) {
      let message = `Download failed (${response.status})`;

      try {
        const data = await response.json();
        message = data?.error || message;
      } catch {
        // Keep the fallback message for non-JSON errors.
      }

      throw new Error(message);
    }

    return response.blob();
  },

  update: (documentId, metadata) =>
    apiRequest(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: "PATCH",
      body: JSON.stringify(metadata),
    }),

  share: (documentId, email, permission) =>
    apiRequest(
      `/api/documents/${encodeURIComponent(documentId)}/permissions`,
      {
        method: "POST",
        body: JSON.stringify({ email, permission }),
      }
    ),

  revoke: (documentId, userId) =>
    apiRequest(
      `/api/documents/${encodeURIComponent(documentId)}/permissions/${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    ),

  remove: (documentId) =>
    apiRequest(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
    }),
};

export const adminApi = {
  audit: (filters = {}) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }

    const query = params.toString();
    return apiRequest(`/api/admin/audit${query ? `?${query}` : ""}`);
  },
};

export const healthApi = {
  check: () => apiRequest("/api/health"),
};

