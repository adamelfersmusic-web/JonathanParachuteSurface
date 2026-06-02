import { useEffect, useState } from "react";
import { ApiError, VaultApi } from "../api";
import { Markdown } from "../markdown";
import type { Note } from "../types";

export type PanelTarget =
  | { mode: "view"; note: Note }
  | { mode: "edit"; note: Note }
  | { mode: "create"; note?: undefined };

interface MetaRow {
  key: string;
  value: string;
}

function metaToRows(metadata: Record<string, unknown>): MetaRow[] {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: value == null ? "" : String(value),
  }));
}

function rowsToMeta(rows: MetaRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    const k = key.trim();
    if (k) out[k] = value;
  }
  return out;
}

export function NotePanel({
  target,
  api,
  onClose,
  onChanged,
  onNavigate,
}: {
  target: PanelTarget;
  api: VaultApi;
  onClose: () => void;
  onChanged: () => void; // refresh dashboard data after a write
  onNavigate: (idOrPath: string) => void; // wikilink / related-note click
}) {
  const [editing, setEditing] = useState(target.mode !== "view");
  const [full, setFull] = useState<Note | null>(
    target.mode === "create" ? null : (target.note ?? null),
  );
  const [loading, setLoading] = useState(target.mode !== "create");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editor form state
  const [path, setPath] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [metaRows, setMetaRows] = useState<MetaRow[]>([]);

  // Load full content for view/edit; seed the form for create.
  useEffect(() => {
    let cancelled = false;
    setEditing(target.mode !== "view");
    setError(null);

    if (target.mode === "create") {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      setFull(null);
      setPath(`capture/${stamp}`);
      setTags("capture");
      setContent("");
      setMetaRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .getNote(target.note.id)
      .then((n) => {
        if (cancelled) return;
        setFull(n);
        setPath(n.path);
        setTags(n.tags.join(", "));
        setContent(n.content ?? "");
        setMetaRows(metaToRows(n.metadata));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [target, api]);

  const parsedTags = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (target.mode === "create") {
        const created = await api.createNote({
          path: path.trim(),
          content,
          tags: parsedTags,
          metadata: rowsToMeta(metaRows),
        });
        onChanged();
        setFull(created);
        setEditing(false);
      } else {
        const updated = await api.updateNote(full?.id ?? target.note!.id, {
          content,
          tags: parsedTags,
          metadata: rowsToMeta(metaRows),
          path: path.trim() !== full?.path ? path.trim() : undefined,
          ifUpdatedAt: full?.updatedAt,
        });
        onChanged();
        setFull(updated);
        setPath(updated.path);
        setTags(updated.tags.join(", "));
        setContent(updated.content ?? content);
        setMetaRows(metaToRows(updated.metadata));
        setEditing(false);
      }
    } catch (e) {
      if (e instanceof ApiError && e.conflict) {
        setError(
          "This note changed since you opened it. Close and reopen to load the latest before editing.",
        );
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!full) return;
    if (!confirm(`Delete "${full.title}"? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteNote(full.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="panel-scrim" onClick={onClose} />
      <aside className="panel" role="dialog" aria-label="Note">
        <header className="panel-head">
          <div className="panel-head-title">
            {target.mode === "create" ? "New note" : (full?.title ?? "Note")}
          </div>
          <div className="panel-head-actions">
            {!editing && full && (
              <>
                <button className="ghost" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button className="ghost danger" onClick={handleDelete} disabled={saving}>
                  Delete
                </button>
              </>
            )}
            <button className="ghost" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="panel-body muted">Loading…</div>
        ) : editing ? (
          <div className="panel-body editor">
            <label>
              Path
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                spellCheck={false}
                placeholder="folder/note-name"
              />
            </label>
            <label>
              Tags <span className="hint">comma-separated</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                spellCheck={false}
                placeholder="capture, todo"
              />
            </label>

            <div className="meta-editor">
              <div className="meta-editor-label">
                Metadata
                <button
                  className="ghost tiny"
                  onClick={() => setMetaRows([...metaRows, { key: "", value: "" }])}
                >
                  + field
                </button>
              </div>
              {metaRows.map((row, i) => (
                <div key={i} className="meta-row">
                  <input
                    placeholder="key"
                    value={row.key}
                    onChange={(e) => {
                      const next = [...metaRows];
                      next[i] = { ...row, key: e.target.value };
                      setMetaRows(next);
                    }}
                  />
                  <input
                    placeholder="value"
                    value={row.value}
                    onChange={(e) => {
                      const next = [...metaRows];
                      next[i] = { ...row, value: e.target.value };
                      setMetaRows(next);
                    }}
                  />
                  <button
                    className="ghost tiny"
                    onClick={() => setMetaRows(metaRows.filter((_, j) => j !== i))}
                    aria-label="Remove field"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <p className="hint">
                Existing metadata keys are merged on save; removing a row here
                stops updating that key but does not delete it server-side.
              </p>
            </div>

            <label className="grow">
              Content <span className="hint">markdown · [[wikilinks]] supported</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
            </label>

            <div className="editor-actions">
              <button onClick={handleSave} disabled={saving || !path.trim()}>
                {saving ? "Saving…" : target.mode === "create" ? "Create note" : "Save"}
              </button>
              {target.mode === "edit" && (
                <button className="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : full ? (
          <div className="panel-body">
            <div className="panel-meta">
              <code className="panel-path">{full.path}</code>
              <div className="panel-tags">
                {full.tags.map((t) => (
                  <span key={t} className="tag-chip">
                    {t}
                  </span>
                ))}
              </div>
              {Object.keys(full.metadata).length > 0 && (
                <div className="panel-badges">
                  {Object.entries(full.metadata).map(([k, v]) => (
                    <span key={k} className="badge">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Markdown content={full.content ?? ""} onNavigate={onNavigate} />
          </div>
        ) : null}
      </aside>
    </>
  );
}
