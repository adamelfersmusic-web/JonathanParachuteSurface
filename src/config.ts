import type { VaultConfig } from "./types";

// The vault URL + token live ONLY in localStorage, set via the paste-in
// screen. Never hardcoded in source, never sent anywhere but the vault itself.
const STORAGE_KEY = "vault-deck.config.v1";

export function loadConfig(): VaultConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VaultConfig>;
    if (!parsed.base || !parsed.token) return null;
    return { base: parsed.base, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveConfig(config: VaultConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Trim a trailing slash and any accidental trailing /api so the user can paste
// either ".../vault/jonathan" or ".../vault/jonathan/" or ".../vault/jonathan/api".
export function normalizeBase(input: string): string {
  let base = input.trim().replace(/\/+$/, "");
  base = base.replace(/\/api$/, "");
  return base;
}

// Best-effort vault slug for display (last path segment of the base).
export function vaultSlug(base: string): string {
  const parts = base.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || base;
}
