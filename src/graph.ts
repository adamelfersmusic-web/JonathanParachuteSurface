import type { Note } from "./types";

// Per-tag node colors for the Notes graph. The eight the spec calls out, plus a
// neutral fallback. Chosen to sit in the warm/earthy brand family and stay
// distinguishable on the dark canvas.
export const TAG_COLORS: Record<string, string> = {
  brand: "#c49a27", // gold
  intel: "#6f8f9e", // slate
  transcript: "#7e9b6e", // sage
  "content/script": "#cf8e5c", // amber
  ops: "#9b8f6b", // khaki
  people: "#c08597", // dusty rose
  ads: "#b56a52", // terracotta
  app: "#7d9bd1", // periwinkle
  other: "#6b6358", // warm gray
};

// Short label for a tag key (content/script reads as "script").
export function tagLabel(key: string): string {
  return key === "content/script" ? "script" : key;
}

// Order decides a note's "primary" tag when it carries several. Most-identifying
// first. interview folds into transcript's color (same material family).
const TAG_PRIORITY = [
  "brand",
  "content/script",
  "transcript",
  "interview",
  "intel",
  "ads",
  "app",
  "people",
  "ops",
];

export function primaryTagKey(note: Note): string {
  for (const key of TAG_PRIORITY) {
    if (note.tags.some((t) => t === key || t.startsWith(key + "/"))) {
      return key === "interview" ? "transcript" : key;
    }
  }
  return "other";
}

export interface NotesGraph {
  nodes: { note: Note; tagKey: string; degree: number }[];
  edges: { a: number; b: number }[];
}

// Every note as a node, linked to its few most tag-similar neighbours (a kNN
// graph). Sparse on purpose — full all-pairs sharing would be a hairball — so
// the force layout pulls same-tag notes into readable clusters.
export function notesGraph(notes: Note[], k = 3): NotesGraph {
  const n = notes.length;
  const tagSets = notes.map((nt) => new Set(nt.tags));
  const shared = (i: number, j: number) => {
    let c = 0;
    for (const t of tagSets[i]) if (tagSets[j].has(t)) c++;
    return c;
  };

  const edgeKeys = new Set<string>();
  for (let i = 0; i < n; i++) {
    const cand: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const s = shared(i, j);
      if (s >= 1) cand.push([j, s]);
    }
    cand.sort((a, b) => b[1] - a[1]);
    for (const [j] of cand.slice(0, k)) {
      edgeKeys.add(i < j ? `${i}-${j}` : `${j}-${i}`);
    }
  }
  const edges = [...edgeKeys].map((key) => {
    const [a, b] = key.split("-").map(Number);
    return { a, b };
  });

  const degree = new Array(n).fill(0);
  for (const e of edges) {
    degree[e.a]++;
    degree[e.b]++;
  }

  return {
    nodes: notes.map((note, i) => ({ note, tagKey: primaryTagKey(note), degree: degree[i] })),
    edges,
  };
}

// Fruchterman–Reingold force layout. Repulsion between all nodes, attraction
// along edges; self-scaling ideal distance `k`. Precomputed (not animated) and
// deterministic given the same node count — clusters emerge from the data.
// Tuned + validated against the live vault (edges settle ~12× tighter than
// random pairs).
export function forceLayout(
  count: number,
  edges: { a: number; b: number }[],
  width: number,
  height: number,
  iterations = 500,
  C = 0.5,
): { x: number; y: number }[] {
  if (count === 0) return [];
  const k = C * Math.sqrt((width * height) / count);
  const margin = 22;

  // Deterministic seed: spread on a ring with index jitter so the layout is
  // stable across re-renders / data refreshes.
  const pos = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return {
      x: width / 2 + Math.cos(a) * (width * 0.18) + ((i % 7) - 3),
      y: height / 2 + Math.sin(a) * (height * 0.18) + ((i % 5) - 2),
    };
  });

  let temp = width / 8;
  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        disp[i].x += ux * f;
        disp[i].y += uy * f;
        disp[j].x -= ux * f;
        disp[j].y -= uy * f;
      }
    }

    for (const { a, b } of edges) {
      let dx = pos[a].x - pos[b].x;
      let dy = pos[a].y - pos[b].y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      disp[a].x -= ux * f;
      disp[a].y -= uy * f;
      disp[b].x += ux * f;
      disp[b].y += uy * f;
    }

    for (let i = 0; i < count; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y) || 0.01;
      pos[i].x += (disp[i].x / d) * Math.min(d, temp);
      pos[i].y += (disp[i].y / d) * Math.min(d, temp);
      pos[i].x = Math.max(margin, Math.min(width - margin, pos[i].x));
      pos[i].y = Math.max(margin, Math.min(height - margin, pos[i].y));
    }
    temp *= 0.96;
  }

  return pos;
}
