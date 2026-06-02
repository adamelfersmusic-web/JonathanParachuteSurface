import { useMemo } from "react";
import { conceptGraph } from "../intelligence";
import type { Note } from "../types";

// Operator thinking-tool: the vault's recurring concepts as a node graph.
// Nodes = concepts (size = how many notes mention it, gold = established /
// sage = emerging). Lines = how often two concepts show up in the same note.
// Circular layout — simple and readable; can get richer (force layout) later.
const W = 900;
const H = 580;
const CX = W / 2;
const CY = H / 2;
const R = 168;

export function MapView({
  notes,
  onConcept,
}: {
  notes: Note[];
  onConcept: (searchTerm: string) => void;
}) {
  const { nodes, edges } = useMemo(() => conceptGraph(notes), [notes]);

  const maxCount = Math.max(1, ...nodes.map((n) => n.count));
  const maxWeight = Math.max(1, ...edges.map((e) => e.weight));

  const pos = nodes.map((_, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  const radius = (count: number) => 11 + (count / maxCount) * 20;

  if (nodes.length === 0) {
    return (
      <div className="view-empty">
        <h2 className="view-title">Map</h2>
        <p className="muted">Not enough signal yet — capture more and the map fills in.</p>
      </div>
    );
  }

  return (
    <div className="map-view">
      <div className="view-head">
        <h2 className="view-title">Map</h2>
        <p className="view-sub">
          How your ideas relate · node size = how often it comes up · line = how often two ideas share a note
        </p>
      </div>

      <div className="map-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="map-svg">
          {edges.map((e, i) => {
            const o = 0.1 + 0.5 * (e.weight / maxWeight);
            return (
              <line
                key={i}
                x1={pos[e.a].x}
                y1={pos[e.a].y}
                x2={pos[e.b].x}
                y2={pos[e.b].y}
                stroke="var(--gold)"
                strokeOpacity={o}
                strokeWidth={1 + 2.5 * (e.weight / maxWeight)}
              />
            );
          })}

          {nodes.map((n, i) => {
            const p = pos[i];
            const r = radius(n.count);
            // Label outside the ring; anchor by quadrant so text reads outward.
            const vertical = Math.abs(p.cos) < 0.34;
            const anchor = vertical ? "middle" : p.cos >= 0 ? "start" : "end";
            const lx = vertical ? p.x : p.x + (p.cos >= 0 ? 1 : -1) * (r + 7);
            const ly = vertical ? p.y + (p.sin >= 0 ? 1 : -1) * (r + 14) : p.y;
            return (
              <g
                key={n.label}
                className="map-node"
                onClick={() => onConcept(n.searchTerm)}
                tabIndex={0}
                role="button"
              >
                <title>{`${n.label} · ${n.count} notes — click to explore`}</title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={n.emerging ? "var(--sage)" : "var(--gold)"}
                  fillOpacity={0.92}
                  stroke="var(--panel)"
                  strokeWidth={2}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="map-label"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="map-legend">
        <span className="lg"><span className="swatch established" /> established</span>
        <span className="lg"><span className="swatch emerging" /> emerging</span>
      </div>
    </div>
  );
}
