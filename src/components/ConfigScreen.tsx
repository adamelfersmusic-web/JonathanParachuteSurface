import { useState } from "react";
import { VaultApi } from "../api";
import { AuthManager } from "../auth";
import { beginOAuth, InsecureContextError, normalizeVaultUrl } from "../oauth";
import { DEFAULT_SCOPE, type AuthSession } from "../types";

// First-run connect screen. Primary path is OAuth (browser sign-in via the
// hub, with PKCE + dynamic client registration — no secret to paste). A
// token-paste fallback stays available for hubs without OAuth or for quick use.
export function ConfigScreen({
  initialUrl,
  notice,
  onConnected,
}: {
  initialUrl?: string;
  notice?: string; // e.g. an error carried over from a failed OAuth return
  onConnected: (session: AuthSession) => void;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");

  async function handleOAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Enter your vault URL first.");
      return;
    }
    setBusy(true);
    try {
      const authorizeUrl = await beginOAuth(url, DEFAULT_SCOPE);
      // Hand off to the hub's consent screen; we return to this app's index
      // URL with ?code&state, which App detects and completes.
      window.location.assign(authorizeUrl);
    } catch (err) {
      setBusy(false);
      if (err instanceof InsecureContextError) setError(err.message);
      else setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleToken(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let vaultUrl: string;
    try {
      vaultUrl = normalizeVaultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (!token.trim()) {
      setError("Paste a token, or use OAuth above.");
      return;
    }
    const session: AuthSession = {
      vaultUrl,
      token: { accessToken: token.trim(), scope: DEFAULT_SCOPE },
    };
    setBusy(true);
    try {
      // Verify before saving so a bad paste fails here, loudly.
      await new VaultApi(new AuthManager(session, () => {})).listAll(1);
      onConnected(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="config-screen">
      <form className="config-card" onSubmit={handleOAuth}>
        <h1>Vault Deck</h1>
        <p className="muted">
          Connect to your Parachute Vault. Sign in through your hub with OAuth —
          your tokens are stored only in this browser and sent only to your vault.
        </p>

        <label>
          Vault URL
          <input
            type="url"
            placeholder="https://your-hub.fly.dev/vault/jonathan"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="hint">The vault root — everything before <code>/api</code>.</span>
        </label>

        {error && <div className="error-box">{error}</div>}

        <button type="submit" disabled={busy}>
          {busy ? "Connecting…" : "Connect with OAuth"}
        </button>

        <button
          type="button"
          className="ghost tiny link"
          onClick={() => setShowToken((s) => !s)}
        >
          {showToken ? "Hide token option" : "Advanced: paste a token instead"}
        </button>

        {showToken && (
          <div className="token-fallback">
            <label>
              API token
              <input
                type="password"
                placeholder="hub JWT with vault:write scope"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <span className="hint">Sent as <code>Authorization: Bearer …</code></span>
            </label>
            <button type="button" className="ghost" onClick={handleToken} disabled={busy}>
              {busy ? "Checking…" : "Connect with token"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
