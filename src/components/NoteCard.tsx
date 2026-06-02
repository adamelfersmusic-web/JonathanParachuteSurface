import type { Note } from "../types";

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

// Compact note card used in every pane and results list. `showStatus` adds a
// script's status/pillar/cta badges.
export function NoteCard({
  note,
  onOpen,
  showStatus = false,
  accent,
}: {
  note: Note;
  onOpen: (note: Note) => void;
  showStatus?: boolean;
  accent?: "gold" | "sage";
}) {
  const pillar = note.metadata.pillar as string | undefined;
  const cta = note.metadata.cta_level as string | number | undefined;
  const status = note.metadata.status as string | undefined;

  return (
    <button
      type="button"
      className={`note-card${accent ? ` accent-${accent}` : ""}`}
      onClick={() => onOpen(note)}
    >
      <div className="note-card-title">{note.title}</div>
      <div className="note-card-path">{note.path}</div>
      {note.preview && <div className="note-card-preview">{cleanPreview(note.preview)}</div>}
      <div className="note-card-meta">
        {showStatus && status && <span className="badge badge-status">{status}</span>}
        {pillar && <span className="badge">{pillar}</span>}
        {cta !== undefined && cta !== "" && <span className="badge badge-cta">CTA {cta}</span>}
        {note.tags
          .filter((t) => !showStatus || t !== "content/script")
          .slice(0, 3)
          .map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        <span className="note-card-time">{relativeTime(note.updatedAt || note.createdAt)}</span>
      </div>
    </button>
  );
}

// Previews arrive whitespace-collapsed and usually start with the "# Title"
// line; drop a leading markdown heading so the snippet reads like body text.
function cleanPreview(preview: string): string {
  return preview.replace(/^#+\s*/, "").trim();
}
