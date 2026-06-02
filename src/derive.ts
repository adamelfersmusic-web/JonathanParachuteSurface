import {
  PINNED_TAG,
  SCRIPT_TAG,
  SCRIPT_STATUSES,
  TODO_TAG,
  type Note,
  type ScriptStatus,
  type TagInfo,
} from "./types";

// A note matches a tag if it carries that exact tag OR a descendant of it
// (the vault treats `capture` as including `capture/voice`, etc.).
export function hasTag(note: Note, tag: string): boolean {
  return note.tags.some((t) => t === tag || t.startsWith(tag + "/"));
}

export function pinned(notes: Note[]): Note[] {
  return notes.filter((n) => hasTag(n, PINNED_TAG));
}

export function todos(notes: Note[]): Note[] {
  return byUpdatedDesc(notes.filter((n) => hasTag(n, TODO_TAG)));
}

export function scripts(notes: Note[]): Note[] {
  return notes.filter((n) => hasTag(n, SCRIPT_TAG));
}

export function recent(notes: Note[], limit = 12): Note[] {
  return byUpdatedDesc(notes).slice(0, limit);
}

export function byUpdatedDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => time(b) - time(a));
}

function time(n: Note): number {
  const t = Date.parse(n.updatedAt || n.createdAt || "");
  return Number.isNaN(t) ? 0 : t;
}

// Group scripts into kanban columns by metadata.status. Anything with an
// unrecognized/missing status lands in "draft" so it never disappears.
export function scriptsByStatus(notes: Note[]): Record<ScriptStatus, Note[]> {
  const columns = Object.fromEntries(
    SCRIPT_STATUSES.map((s) => [s, [] as Note[]]),
  ) as Record<ScriptStatus, Note[]>;

  for (const n of scripts(notes)) {
    const raw = String(n.metadata.status ?? "").toLowerCase();
    const status = (SCRIPT_STATUSES as readonly string[]).includes(raw)
      ? (raw as ScriptStatus)
      : "draft";
    columns[status].push(n);
  }
  return columns;
}

// Tag counts derived from the in-memory index, sorted by frequency.
export function tagCounts(notes: Note[]): TagInfo[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterByTag(notes: Note[], tag: string): Note[] {
  return byUpdatedDesc(notes.filter((n) => hasTag(n, tag)));
}
