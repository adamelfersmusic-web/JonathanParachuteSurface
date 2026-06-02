import { useMemo } from "react";
import { conceptGraph } from "../intelligence";
import { forceLayout, notesGraph, TAG_COLORS, tagLabel } from "../graph";
import type { Note } from "../types";

export type MapMode = "concepts" | "notes";

// Operator thinking-tool: the vault as a force-directed graph. Two zoom levels:
//   Concepts — the ~12 recurring themes (gravity map).
//   Notes    — every note, colored by primary tag (full constellation).
// Same force engine for both; related things cluster, structure emerges.
const W = 960;
const H = 640;

// Unified render shape so both modes share one renderer. Carries a reference to
// what it represents (a concept search term or a note) rather than a closure, so
// the graph memo stays stable across renders and the force layout isn't redone.
interface RNode {
  label: string;
  color: string;
  size: number;
  tooltip: string;
  alwaysLabel: boolean;
  tags?: string[];
  concept?: string; // searchTerm
  note?: Note;
}

const LEGEND_TAGS = ["brand", "intel", "transcript", "content/script", "ops", "people", "ads", "app"];

export function MapView({
  notes,
  mode,
  onModeChange,
  onConcept,
  onOpenNote,
  highlightTag,
}: {
  notes: Note[];
  mode: MapMode;
  onModeChange: (m: MapMode) => void;
  onConcept: (searchTerm: string) => void;
  onOpenNote: (note: Note) => void;
  highlightTag: string | null;
}) {
  const { rnodes, edges } = useMemo(() => {
    if (mode === "concepts") {
      const g = conceptGraph(notes);
      const maxCount = Math.max(1, ...g.nodes.map((n) => n.count));
      const rnodes: RNode[] = g.nodes.map((n) => ({
        label: n.label,
        color: n.emerging ? "var(--sage)" : "var(--gold)",
        size: 11 + (n.count / maxCount) * 20,
        tooltip: `${n.label} · ${n.count} notes — click to explore`,
        alwaysLabel: true,
        concept: n.searchTerm,
      }));
      return { rnodes, edges: g.edges.map((e) => ({ a: e.a, b: e.b, weight: e.weight })) };
    }
    const g = notesGraph(notes);
    const maxDeg = Math.max(1, ...g.nodes.map((n) => n.degree));
    const rnodes: RNode[] = g.nodes.map((n) => ({
      label: n.note.title,
      color: TAG_COLORS[n.tagKey] ?? TAG_COLORS.other,
      size: 5 + (n.degree / maxDeg) * 10,
      tooltip: `${n.note.title} · #${tagLabel(n.tagKey)}`,
      alwaysLabel: false,
      tags: n.note.tags,
      note: n.note,
    }));
    return { rnodes, edges: g.edges.map((e) => ({ a: e.a, b: e.b, weight: undefined as number | undefined })) };
  }, [notes, mode]);

  const pos = useMemo(
    () => forceLayout(rnodes.length, edges, W, H),
    [rnodes.length, edges],
  );

  const maxWeight = Math.max(1, ...edges.map((e) => e.weight ?? 0));
  const matches = (n: RNode) =>
    !!highlightTag && !!n.tags?.some((t) => t === highlightTag || t.startsWith(highlightTag + "/"));
  const highlighting = mode === "notes" && !!highlightTag;

  return (
    <div className="map-view">
      <div className="view-head map-head">
        <div>
          <h2 className="view-title">Map</h2>
          <p className="view-sub">
            {mode === "concepts"
              ? "How your themes relate · node size = gravity · line = how often two ideas share a note"
              : "Every note as a node, colored by tag · linked where notes share tags · click the rail to isolate a tag"}
          </p>
        </div>
        <div className="segmented small">
          <button
            className={`seg ${mode === "concepts" ? "active" : ""}`}
            onClick={() => onModeChange("concepts")}
          >
            Concepts
          </button>
          <button
            className={`seg ${mode === "notes" ? "active" : ""}`}
            onClick={() => onModeChange("notes")}
          >
            Notes
          </button>
        </div>
      </div>

      {rnodes.length === 0 ? (
        <div className="map-wrap muted" style={{ padding: 60, textAlign: "center" }}>
          Not enough signal yet — capture more and the map fills in.
        </div>
      ) : (
        <div className="map-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="map-svg">
            {edges.map((e, i) => {
              const concepts = mode === "concepts";
              const dim = highlighting && !(matches(rnodes[e.a]) && matches(rnodes[e.b]));
              const opacity = concepts
                ? 0.1 + 0.5 * ((e.weight ?? 0) / maxWeight)
                : dim
                  ? 0.03
                  : highlighting
                    ? 0.35
                    : 0.09;
              return (
                <line
                  key={i}
                  x1={pos[e.a].x}
                  y1={pos[e.a].y}
                  x2={pos[e.b].x}
                  y2={pos[e.b].y}
                  stroke={concepts ? "var(--gold)" : "var(--cream)"}
                  strokeOpacity={opacity}
                  strokeWidth={concepts ? 1 + 2.5 * ((e.weight ?? 0) / maxWeight) : 1}
                />
              );
            })}

            {rnodes.map((n, i) => {
              const p = pos[i];
              const dimmed = highlighting && !matches(n);
              const showLabel = n.alwaysLabel || (highlighting && matches(n));
              return (
                <g
                  key={i}
                  className="map-node"
                  onClick={() => (n.note ? onOpenNote(n.note) : n.concept && onConcept(n.concept))}
                  tabIndex={0}
                  role="button"
                  opacity={dimmed ? 0.14 : 1}
                >
                  <title>{n.tooltip}</title>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={n.size}
                    fill={n.color}
                    fillOpacity={0.92}
                    stroke="var(--panel)"
                    strokeWidth={1.5}
                  />
                  {showLabel && (
                    <text
                      x={p.x}
                      y={p.y - n.size - 5}
                      textAnchor="middle"
                      className="map-label"
                    >
                      {n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="map-legend">
        {mode === "concepts" ? (
          <>
            <span className="lg"><span className="swatch established" /> established</span>
            <span className="lg"><span className="swatch emerging" /> emerging</span>
          </>
        ) : (
          LEGEND_TAGS.map((t) => (
            <span className="lg" key={t}>
              <span className="swatch" style={{ background: TAG_COLORS[t] }} /> {tagLabel(t)}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
