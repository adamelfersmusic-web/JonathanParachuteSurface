import { useEffect, useMemo, useState } from "react";
import { VaultApi } from "./api";
import { clearConfig, loadConfig, vaultSlug } from "./config";
import { ConfigScreen } from "./components/ConfigScreen";
import { NoteCard } from "./components/NoteCard";
import { ScriptsBoard } from "./components/ScriptsBoard";
import { NotePanel, type PanelTarget } from "./components/NotePanel";
import {
  filterByTag,
  pinned,
  recent,
  scripts,
  tagCounts,
  todos,
} from "./derive";
import type { Note, ScriptStatus, VaultConfig } from "./types";

export function App() {
  const [config, setConfig] = useState<VaultConfig | null>(() => loadConfig());
  const [reconfiguring, setReconfiguring] = useState(false);

  if (!config || reconfiguring) {
    return (
      <ConfigScreen
        initial={config}
        onSaved={(c) => {
          setConfig(c);
          setReconfiguring(false);
        }}
      />
    );
  }

  return (
    <Dashboard
      config={config}
      onReconfigure={() => setReconfiguring(true)}
      onDisconnect={() => {
        clearConfig();
        setConfig(null);
      }}
    />
  );
}

function Dashboard({
  config,
  onReconfigure,
  onDisconnect,
}: {
  config: VaultConfig;
  onReconfigure: () => void;
  onDisconnect: () => void;
}) {
  const api = useMemo(() => new VaultApi(config), [config]);

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
      note:
        found ?? {
          id: idOrPath,
          path: idOrPath,
          title: idOrPath,
          tags: [],
          metadata: {},
        },
    });
  }

  async function moveScript(note: Note, status: ScriptStatus) {
    try {
      await api.updateNote(note.id, {
        metadata: { status },
        ifUpdatedAt: note.updatedAt,
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const tags = useMemo(() => tagCounts(notes), [notes]);
  const showCommandCenter = !query.trim() && !activeTag;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Vault Deck <span className="brand-slug">{vaultSlug(config.base)}</span>
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
          <button className="ghost" onClick={onReconfigure} title="Settings">
            ⚙
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
            showCommandCenter && (
              <CommandCenter
                notes={notes}
                onOpen={openNote}
                onMove={moveScript}
              />
            )
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
            <NoteCard key={n.id} note={n} onOpen={onOpen} />
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
            <NoteCard key={n.id} note={n} onOpen={onOpen} />
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
