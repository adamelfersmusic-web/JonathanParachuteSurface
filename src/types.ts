// Normalized note shape used throughout the app. The vault REST API returns
// snake_case timestamps and a few fields only on the single-note endpoint;
// `normalizeNote` in api.ts maps everything onto this one shape.
export interface Note {
  id: string;
  path: string;
  title: string; // derived from the path basename
  content?: string; // only present after a single-note fetch
  preview?: string; // ~120 char snippet from list endpoint
  tags: string[];
  metadata: Record<string, unknown>;
  links?: NoteLink[];
  createdAt?: string;
  updatedAt?: string;
  byteSize?: number;
}

export interface NoteLink {
  target: string;
  relationship: string;
}

export interface TagInfo {
  name: string;
  count: number;
}

export interface VaultConfig {
  // Full vault base, e.g. https://aaron-hub.fly.dev/vault/jonathan
  // We append /api/... to this.
  base: string;
  token: string;
}

// Script production pipeline. Order matters — it drives the kanban columns.
export const SCRIPT_STATUSES = [
  "draft",
  "approved",
  "filmed",
  "edited",
  "published",
] as const;

export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export const SCRIPT_TAG = "content/script";
export const PINNED_TAG = "pinned";
export const TODO_TAG = "todo";
export const CAPTURE_TAG = "capture";
