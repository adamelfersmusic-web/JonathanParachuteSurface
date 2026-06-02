import { useMemo } from "react";
import { analyzeConcepts, type ConceptStat } from "../intelligence";
import type { Note } from "../types";

// Collapsible macro view: a bar chart of recurring ideas across all notes.
// Bar height = how many notes mention the concept. Gold = established;
// sage + ▲ = emerging (mentions skew toward the newest notes).
export function IntelligencePanel({
  notes,
  loading,
  collapsed,
  onToggle,
  onConceptClick,
}: {
  notes: Note[];
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onConceptClick: (concept: ConceptStat) => void;
}) {
  const stats = useMemo(() => analyzeConcepts(notes), [notes]);
  const max = stats.reduce((m, s) => Math.max(m, s.count), 0);

  return (
    <section className="intel">
      <button className="intel-head" onClick={onToggle} aria-expanded={!collapsed}>
        <span className="chevron">{collapsed ? "▸" : "▾"}</span>
        <span className="intel-title">Vault Intelligence</span>
        <span className="intel-sub">what&rsquo;s pulling gravity across {notes.length} notes</span>
        <span className="intel-legend">
          <span className="lg"><span className="swatch established" /> established</span>
          <span className="lg"><span className="swatch emerging" /> emerging ▲</span>
        </span>
      </button>

      {!collapsed && (
        <div className="intel-body">
          {loading && stats.length === 0 ? (
            <div className="muted intel-empty">Reading across the vault…</div>
          ) : stats.length === 0 ? (
            <div className="muted intel-empty">Not enough signal yet — capture more and it fills in.</div>
          ) : (
            <div className="bars">
              {stats.map((s) => (
                <button
                  key={s.label}
                  className="bar-col"
                  onClick={() => onConceptClick(s)}
                  title={`${s.count} notes mention this${s.emerging ? ` · spiking (${s.recentCount} in newest)` : ""} — click to explore`}
                >
                  <span className="bar-count">
                    {s.count}
                    {s.emerging && <span className="bar-arrow">▲</span>}
                  </span>
                  <span
                    className={`bar ${s.emerging ? "emerging" : "established"}`}
                    style={{ height: `${14 + (s.count / max) * 116}px` }}
                  />
                  <span className="bar-label">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
