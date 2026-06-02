import { SCRIPT_STATUSES, type Note, type ScriptStatus } from "../types";
import { scriptsByStatus } from "../derive";

const STATUS_LABELS: Record<ScriptStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  filmed: "Filmed",
  edited: "Edited",
  published: "Published",
};

// Kanban over the script production pipeline. Each card carries a status select
// so a script can be moved across columns (PATCH metadata.status upstream).
export function ScriptsBoard({
  notes,
  onOpen,
  onMove,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
  onMove: (note: Note, status: ScriptStatus) => void;
}) {
  const columns = scriptsByStatus(notes);

  return (
    <div className="board">
      {SCRIPT_STATUSES.map((status) => (
        <div key={status} className="board-column">
          <div className="board-column-head">
            {STATUS_LABELS[status]}
            <span className="board-count">{columns[status].length}</span>
          </div>
          <div className="board-column-body">
            {columns[status].map((note) => {
              const pillar = note.metadata.pillar as string | undefined;
              const cta = note.metadata.cta_level as string | number | undefined;
              return (
                <div key={note.id} className="board-card">
                  <button
                    type="button"
                    className="board-card-title"
                    onClick={() => onOpen(note)}
                  >
                    {note.title}
                  </button>
                  <div className="board-card-meta">
                    {pillar && <span className="badge">{pillar}</span>}
                    {cta !== undefined && cta !== "" && (
                      <span className="badge badge-cta">CTA {cta}</span>
                    )}
                  </div>
                  <select
                    className="board-card-status"
                    value={status}
                    onChange={(e) => onMove(note, e.target.value as ScriptStatus)}
                    aria-label="Move script to status"
                  >
                    {SCRIPT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {columns[status].length === 0 && (
              <div className="board-empty">—</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
