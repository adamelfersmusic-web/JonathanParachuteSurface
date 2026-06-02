import type { AuthSession } from "./types";

// The connected vault (URL + token, plus OAuth refresh material) lives ONLY in
// localStorage. Nothing is hardcoded; nothing leaves the browser except calls
// to the vault itself.
const SESSION_KEY = "vault-deck.session.v1";

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.vaultUrl || !parsed.token?.accessToken) return null;
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// Best-effort vault slug for display (last path segment of the URL).
export function vaultSlug(url: string): string {
  const parts = url.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || url;
}
