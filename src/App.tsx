import { useEffect, useMemo, useRef, useState } from "react";
import { VaultApi } from "./api";
import { AuthManager } from "./auth";
import { clearSession, loadSession, saveSession, vaultSlug } from "./config";
import {
  completeOAuth,
  PendingApprovalError,
  loadPending,
  resolveVaultUrl,
  storedFromTokenResponse,
} from "./oauth";
import { ConfigScreen } from "./components/ConfigScreen";
import { NoteCard } from "./components/NoteCard";
import { ScriptsBoard } from "./components/ScriptsBoard";
import { NotePanel, type PanelTarget } from "./components/NotePanel";
import { filterByTag, pinned, recent, scripts, tagCounts, todos } from "./derive";
import type { AuthSession, Note, ScriptStatus } from "./types";

type OAuthPhase =
  | { kind: "none" }
  | { kind: "completing" }
  | { kind: "approval"; approveUrl: string }
  | { kind: "error"; message: string };

export function App() {
  const [auth, setAuth] = useState<AuthManager | null>(null);
  const [phase, setPhase] = useState<OAuthPhase>({ kind: "none" });
  const ranReturn = useRef(false);

  // Build (or rebuild) the auth manager from a session and remember it.
  function adopt(session: AuthSession) {
    saveSession(session);
    setAuth(
      new AuthManager(session, (next) => {
        if (!next) {
          clearSession();
          setAuth(null);
        }
      }),
    );
  }

  // On first load, either restore a saved session or finish an OAuth return.
  useEffect(() => {
    if (ranReturn.current) return;
    ranReturn.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const returning = (code && state) || oauthError;

    if (!returning) {
      const saved = loadSession();
      if (saved) adopt(saved);
      return;
    }

    // Clean the OAuth params out of the URL so a refresh doesn't re-run it.
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);

    if (oauthError) {
      setPhase({ kind: "error", message: `Hub returned: ${oauthError}` });
      return;
    }
    if (!loadPending()) {
      // No pending flow (e.g. a stale/bookmarked callback) — fall back to restore.
      const saved = loadSession();
      if (saved) adopt(saved);
      return;
    }

    setPhase({ kind: "completing" });
    completeOAuth(code!, state!)
      .then(({ pending, token }) => {
        const vaultUrl = resolveVaultUrl(token, pending.issuerUrl);
        adopt({
          vaultUrl,
          issuer: pending.issuer,
          tokenEndpoint: pending.tokenEndpoint,
          clientId: pending.clientId,
          token: storedFromTokenResponse(token),
        });
        setPhase({ kind: "none" });
      })
      .catch((err) => {
        if (err instanceof PendingApprovalError) {
          setPhase({ kind: "approval", approveUrl: err.approveUrl });
        } else {
          setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase.kind === "completing") {
    return (
      <div className="config-screen">
        <div className="config-card center">
          <h1>Connecting…</h1>
          <p className="muted">Exchanging the authorization code with your vault.</p>
        </div>
      </div>
    );
  }

  if (phase.kind === "approval") {
    return (
      <div className="config-screen">
        <div className="config-card center">
          <h1>Waiting for hub approval</h1>
          <p className="muted">
            Your hub admin needs to approve Vault Deck before sign-in can complete.
            Open the approval page, approve, then connect again.
          </p>
          <a className="approve-link" href={phase.approveUrl} target="_blank" rel="noreferrer">
            Open approval page
          </a>
          <button className="ghost" onClick={() => setPhase({ kind: "none" })}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!auth) {
    // Surface any OAuth-return error above the form rather than on a dead end.
    return (
      <ConfigScreen
        onConnected={adopt}
        notice={phase.kind === "error" ? phase.message : undefined}
      />
    );
  }

  return (
    <Dashboard
      auth={auth}
      onDisconnect={() => {
        clearSession();
        setAuth(null);
      }}
    />
  );
}

function Dashboard({ auth, onDisconnect }: { auth: AuthManager; onDisconnect: () => void }) {
  const api = useMemo(() => new VaultApi(auth), [auth]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [target, setTarget] = useState<PanelTarget | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      setNotes(await api.listAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Debounced full-text search against the vault.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      api
        .search(q)
        .then(setSearchResults)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, api]);

  function openNote(note: Note) {
    setTarget({ mode: "view", note });
  }

  function openByIdOrPath(idOrPath: string) {
    const found = notes.find((n) => n.id === idOrPath || n.path === idOrPath);
    setTarget({
      mode: "view",
      note: found ?? { id: idOrPath, path: idOrPath, title: idOrPath, tags: [], metadata: {} },
    });
  }

  async function moveScript(note: Note, status: ScriptStatus) {
    try {
      await api.updateNote(note.id, { metadata: { status }, ifUpdatedAt: note.updatedAt });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const tags = useMemo(() => tagCounts(notes), [notes]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Vault Deck</span>
          <span className="brand-slug">{vaultSlug(auth.vaultBase)}</span>
        </div>
        <div className="search-wrap">
          <input
            className="search"
            type="search"
            placeholder="Search one word, find anything…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveTag(null);
            }}
          />
          {searching && <span className="search-spinner">…</span>}
        </div>
        <div className="topbar-actions">
          <button onClick={() => setTarget({ mode: "create" })}>+ Capture</button>
          <button className="ghost" onClick={loadAll} title="Refresh">
            ↻
          </button>
          <button className="ghost" onClick={onDisconnect} title="Disconnect">
            ⏻
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box app-error">
          {error}
          <button className="ghost tiny" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      <div className="layout">
        <nav className="tag-rail">
          <div className="tag-rail-head">Tags</div>
          <button
            className={`tag-rail-item ${activeTag === null && !query ? "active" : ""}`}
            onClick={() => {
              setActiveTag(null);
              setQuery("");
            }}
          >
            <span>All notes</span>
            <span className="tag-rail-count">{notes.length}</span>
          </button>
          {tags.map((t) => (
            <button
              key={t.name}
              className={`tag-rail-item ${activeTag === t.name ? "active" : ""}`}
              onClick={() => {
                setActiveTag(t.name);
                setQuery("");
              }}
            >
              <span>{t.name}</span>
              <span className="tag-rail-count">{t.count}</span>
            </button>
          ))}
        </nav>

        <main className="content">
          {loading ? (
            <div className="muted center">Loading vault…</div>
          ) : query.trim() ? (
            <ResultsList
              title={`Search: “${query.trim()}”`}
              notes={searchResults ?? []}
              empty={searching ? "Searching…" : "No matches."}
              onOpen={openNote}
            />
          ) : activeTag ? (
            <ResultsList
              title={`#${activeTag}`}
              notes={filterByTag(notes, activeTag)}
              empty="No notes with this tag."
              onOpen={openNote}
              showStatus={activeTag === "content/script"}
            />
          ) : (
            <CommandCenter notes={notes} onOpen={openNote} onMove={moveScript} />
          )}
        </main>
      </div>

      {target && (
        <NotePanel
          target={target}
          api={api}
          onClose={() => setTarget(null)}
          onChanged={loadAll}
          onNavigate={openByIdOrPath}
        />
      )}
    </div>
  );
}

function CommandCenter({
  notes,
  onOpen,
  onMove,
}: {
  notes: Note[];
  onOpen: (n: Note) => void;
  onMove: (n: Note, s: ScriptStatus) => void;
}) {
  return (
    <div className="command-center">
      <section className="pane">
        <h2>Pinned</h2>
        <div className="card-grid">
          {pinned(notes).map((n) => (
            <NoteCard key={n.id} note={n} onOpen={onOpen} accent="gold" />
          ))}
          {pinned(notes).length === 0 && <Empty>Nothing pinned.</Empty>}
        </div>
      </section>

      <section className="pane">
        <h2>
          Open TODOs <span className="pane-count">{todos(notes).length}</span>
        </h2>
        <div className="card-grid">
          {todos(notes).map((n) => (
            <NoteCard key={n.id} note={n} onOpen={onOpen} accent="sage" />
          ))}
          {todos(notes).length === 0 && <Empty>No open todos.</Empty>}
        </div>
      </section>

      <section className="pane pane-wide">
        <h2>
          Scripts <span className="pane-count">{scripts(notes).length}</span>
        </h2>
        <ScriptsBoard notes={notes} onOpen={onOpen} onMove={onMove} />
      </section>

      <section className="pane">
        <h2>Recent activity</h2>
        <div className="card-grid">
          {recent(notes).map((n) => (
            <NoteCard key={n.id} note={n} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ResultsList({
  title,
  notes,
  empty,
  onOpen,
  showStatus = false,
}: {
  title: string;
  notes: Note[];
  empty: string;
  onOpen: (n: Note) => void;
  showStatus?: boolean;
}) {
  return (
    <section className="pane">
      <h2>
        {title} <span className="pane-count">{notes.length}</span>
      </h2>
      <div className="card-grid">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} onOpen={onOpen} showStatus={showStatus} />
        ))}
        {notes.length === 0 && <Empty>{empty}</Empty>}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty muted">{children}</div>;
}
