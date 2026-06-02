import { useState } from "react";
import { normalizeBase, saveConfig } from "../config";
import { VaultApi } from "../api";
import type { VaultConfig } from "../types";

// One-time paste-in screen. Stores the vault URL + token in localStorage only.
export function ConfigScreen({
  initial,
  onSaved,
}: {
  initial?: VaultConfig | null;
  onSaved: (config: VaultConfig) => void;
}) {
  const [base, setBase] = useState(initial?.base ?? "");
  const [token, setToken] = useState(initial?.token ?? "");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const config: VaultConfig = { base: normalizeBase(base), token: token.trim() };
    if (!config.base || !config.token) {
      setError("Both the vault URL and a token are required.");
      return;
    }
    setTesting(true);
    try {
      // Verify the credentials before saving so a bad paste fails here, loudly.
      await new VaultApi(config).listAll(1);
      saveConfig(config);
      onSaved(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="config-screen">
      <form className="config-card" onSubmit={handleSubmit}>
        <h1>Vault Deck</h1>
        <p className="muted">
          Connect to your Parachute Vault. Your URL and token are stored only in
          this browser&rsquo;s local storage and sent only to your vault.
        </p>

        <label>
          Vault URL
          <input
            type="url"
            placeholder="https://your-hub.fly.dev/vault/jonathan"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="hint">
            The full vault base — everything before <code>/api</code>.
          </span>
        </label>

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

        {error && <div className="error-box">{error}</div>}

        <button type="submit" disabled={testing}>
          {testing ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
