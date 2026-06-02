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

// OAuth scope vocabulary, per parachute's oauth-scopes pattern. The vault also
// honors the legacy "full" synonym, but we request the current vocabulary.
export type TokenScope = string;
export const DEFAULT_SCOPE: TokenScope = "vault:read vault:write";

// Persisted token envelope (mirrors surface-client's StoredToken).
export interface StoredToken {
  accessToken: string;
  /** Absolute UTC ms (`Date.now()` baseline): now + expires_in * 1000. */
  expiresAt?: number;
  refreshToken?: string;
  scope: TokenScope;
  vault?: string;
}

// What we persist for a connected vault. `issuer`/`tokenEndpoint`/`clientId`
// are present for OAuth sessions (needed to silently refresh); a pasted-token
// session has just the vault URL + access token.
export interface AuthSession {
  vaultUrl: string; // base for /api calls, e.g. https://hub/vault/jonathan
  issuer?: string;
  tokenEndpoint?: string;
  clientId?: string;
  token: StoredToken;
}

// RFC 8414 Authorization Server metadata (the subset we use).
export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  code_challenge_methods_supported?: string[];
}

// Token-endpoint response (RFC 6749 §4.1.4 + hub `services`/`vault` extensions).
export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  scope: TokenScope;
  vault?: string;
  refresh_token?: string;
  expires_in?: number;
  services?: Record<string, { url?: string } | undefined>;
}

// PKCE + flow state stashed in sessionStorage between redirect and callback.
export interface PendingOAuth {
  issuerUrl: string;
  issuer: string;
  tokenEndpoint: string;
  clientId: string;
  codeVerifier: string;
  state: string;
  redirectUri: string;
  scope: TokenScope;
  startedAt: string;
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
