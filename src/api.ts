import type { AuthManager } from "./auth";
import type { Note, TagInfo } from "./types";

// Thrown for any non-OK response. `conflict` flags the optimistic-concurrency
// case (the note changed since we last read it) so the UI can prompt a reload.
export class ApiError extends Error {
  status: number;
  conflict: boolean;
  constructor(message: string, status: number, conflict = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.conflict = conflict;
  }
}

function humanizeTitle(path: string): string {
  const base = path.split("/").pop() || path;
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\.\w+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Map whatever the API returns (snake_case, camelCase, list vs single shapes)
// onto our normalized Note.
function normalizeNote(raw: any): Note {
  const path: string = raw.path ?? raw.id ?? "";
  return {
    id: raw.id ?? raw.path,
    path,
    title: humanizeTitle(path || String(raw.id ?? "untitled")),
    content: raw.content,
    preview: raw.preview,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
    links: raw.links,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
    byteSize: raw.byteSize ?? raw.byte_size,
  };
}

// List/single endpoints variously return an array, a bare object, or a wrapper
// like { notes: [...] } / { data: [...] } / { note: {...} }. Dig out the payload.
function unwrapList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notes)) return data.notes;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function unwrapOne(data: any): any {
  return data?.note ?? data?.data ?? data;
}

export class VaultApi {
  private auth: AuthManager;

  constructor(auth: AuthManager) {
    this.auth = auth;
  }

  private async send(path: string, init: RequestInit, token: string): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    try {
      return await fetch(`${this.auth.vaultBase}/api${path}`, { ...init, headers });
    } catch {
      // Network / CORS failures surface here with no status.
      throw new ApiError(
        "Could not reach the vault. Check the URL, your network, and that the vault allows cross-origin requests.",
        0,
      );
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    let token = await this.auth.getAccessToken();
    let res = await this.send(path, init, token);

    // Access token rejected — try one silent refresh, then replay.
    if (res.status === 401 && (await this.auth.tryRefresh())) {
      token = await this.auth.getAccessToken();
      res = await this.send(path, init, token);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const conflict =
        res.status === 409 || /conflict|updated_at|precondition/i.test(text);
      const detail = text ? `: ${text.slice(0, 300)}` : "";
      throw new ApiError(
        `${res.status} ${res.statusText}${detail}`,
        res.status,
        conflict,
      );
    }

    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return res.text();
    return res.json();
  }

  // One cheap call returns the whole index (id/path/tags/metadata/preview/
  // timestamps). With a vault this size we derive every dashboard pane and the
  // tag list from this in memory.
  async listAll(limit = 1000): Promise<Note[]> {
    const data = await this.request(
      `/notes?include_content=false&limit=${limit}`,
    );
    return unwrapList(data).map(normalizeNote);
  }

  // Full-text search via the vault's ?search= param.
  async search(query: string, limit = 100): Promise<Note[]> {
    const data = await this.request(
      `/notes?search=${encodeURIComponent(query)}&include_content=false&limit=${limit}`,
    );
    return unwrapList(data).map(normalizeNote);
  }

  async getNote(idOrPath: string): Promise<Note> {
    const data = await this.request(`/notes/${encodePathSegment(idOrPath)}`);
    return normalizeNote(unwrapOne(data));
  }

  async createNote(input: {
    path: string;
    content: string;
    tags: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Note> {
    const data = await this.request(`/notes`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return normalizeNote(unwrapOne(data));
  }

  // PATCH with optimistic concurrency. `tags` is a full replace (REST contract);
  // `metadata` is merged server-side. Pass `ifUpdatedAt` from the note you read.
  async updateNote(
    idOrPath: string,
    patch: {
      content?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      path?: string;
      ifUpdatedAt?: string;
    },
  ): Promise<Note> {
    const body: Record<string, unknown> = {};
    if (patch.content !== undefined) body.content = patch.content;
    if (patch.tags !== undefined) body.tags = patch.tags;
    if (patch.metadata !== undefined) body.metadata = patch.metadata;
    if (patch.path !== undefined) body.path = patch.path;
    if (patch.ifUpdatedAt) body.if_updated_at = patch.ifUpdatedAt;

    const data = await this.request(`/notes/${encodePathSegment(idOrPath)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return normalizeNote(unwrapOne(data));
  }

  async deleteNote(idOrPath: string): Promise<void> {
    await this.request(`/notes/${encodePathSegment(idOrPath)}`, {
      method: "DELETE",
    });
  }

  // Tag list with counts. Falls back to deriving counts from the note index if
  // the endpoint shape doesn't include them.
  async listTags(): Promise<TagInfo[]> {
    const data = await this.request(`/tags`);
    const arr = unwrapList(data).length ? unwrapList(data) : (data?.tags ?? []);
    return (Array.isArray(arr) ? arr : []).map((t: any) => ({
      name: typeof t === "string" ? t : t.name,
      count: typeof t === "object" ? (t.count ?? 0) : 0,
    }));
  }
}

// Note IDs/paths can contain slashes (e.g. "content/scripts/foo"). The route is
// /api/notes/:idOrPath, so encode each segment but keep the slashes.
function encodePathSegment(idOrPath: string): string {
  return idOrPath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}
