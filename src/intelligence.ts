import type { Note } from "./types";

// The macro layer: which recurring *ideas* (not tags) are pulling gravity
// across the whole vault, and which are spiking in the newest material.
//
// Concepts are a curated lexicon of the recurring themes in this vault — each
// counted live by how many distinct notes mention it (document frequency), so
// bar heights reflect real cross-note presence. Edit the list freely; add a
// label + a few lowercase match phrases and it shows up. (A future upgrade
// could auto-discover phrases instead of seeding them.)

export interface Concept {
  label: string;
  terms: string[]; // lowercase substrings; a note matches if it contains any
  searchTerm: string; // what clicking the bar searches for
}

// Tuned against the live vault: distinctive multi-word phrases (not broad
// single words) so bar heights actually differentiate the macro themes.
export const CONCEPTS: Concept[] = [
  { label: "Providing without disappearing", terms: ["without disappear", "provide without", "present and provide", "provide and be"], searchTerm: "disappearing" },
  { label: "The Free Man's Path", terms: ["free man", "free man's path"], searchTerm: "free man" },
  { label: "Freedom is earned, not escaped", terms: ["freedom is earned", "earned, not escaped", "earned not escaped", "freedom is not", "not an escape", "freedom isn't"], searchTerm: "freedom" },
  { label: "Follow-up = trust", terms: ["follow-up", "follow up", "followup", "stay in touch", "nurture"], searchTerm: "follow-up" },
  { label: "CRM / pipeline leak", terms: ["crm", "go high level", "ghl", "48-hour", "48 hour", "pipeline", "leads come in", "leads sit"], searchTerm: "CRM" },
  { label: "Recruiting funnel / PATH", terms: ["recruit", "gaietto group", "downline", "upline", 'dm "path"', "dm path"], searchTerm: "recruiting" },
  { label: "Own your analytics", terms: ["meta ad", "ad account", "analytics", "zeepo", "compounding data", "own the data", "own your data"], searchTerm: "analytics" },
  { label: "Compounding infrastructure", terms: ["compound", "institutional knowledge", "infrastructure", "systems layer", "sop", "scale a team", "build a system"], searchTerm: "infrastructure" },
  { label: "Wounded Provider", terms: ["wounded provider", "absent father", "silent hero", "disappeared", "provide but"], searchTerm: "wounded provider" },
  { label: "Presence over hustle", terms: ["presence", "time with", "people you love", "kitchen table", "bedtime", "baseball field", "be present", "summers are left"], searchTerm: "presence" },
  { label: "Ownership", terms: ["ownership", "own your", "owning your", "build a life that", "build something"], searchTerm: "ownership" },
  { label: "Income proof", terms: ["president's club", "$400,000", "400,000", "tree stump", "commission", "hatchet", "sitting on a"], searchTerm: "income" },
  { label: "Integrity / no hype", terms: ["no hype", "real life. real work", "plainspoken", "not performative"], searchTerm: "no hype" },
  { label: "Protection / life insurance", terms: ["life insurance", "policy", "policies", "coverage", "protect"], searchTerm: "life insurance" },
  { label: "Homestead aesthetic", terms: ["chicken", "creek", "chopping wood", "homestead", "coop", "stock footage", "mundane homesteader"], searchTerm: "homestead" },
  { label: "Brand canon vs compost", terms: ["brand brain", "voice guide", "compost", "the canon", "locked brand", "brand doc"], searchTerm: "brand" },
  { label: "Knowledge graph & links", terms: ["knowledge graph", "wikilink", "[[", "link cluster", "priority links", "connect notes", "biggest hubs"], searchTerm: "links" },
  { label: "California trip", terms: ["california", "airport", "drive to the airport", "field shoot", "car ride", "car transcript"], searchTerm: "california" },
];

export interface ConceptStat {
  label: string;
  searchTerm: string;
  count: number; // notes mentioning the concept
  recentCount: number; // mentions among the newest third of notes
  emerging: boolean; // mentions skew toward the newest notes
}

const MAX_BARS = 12;
// A concept is "emerging" when the notes mentioning it skew toward the newest:
// their average recency-rank (0 = oldest, 1 = newest; 0.5 = evenly spread) is
// above EMERGING_THRESHOLD AND a healthy share fall in the newest third.
const EMERGING_THRESHOLD = 0.56;
const EMERGING_RECENT_SHARE = 0.4;

export function analyzeConcepts(notes: Note[]): ConceptStat[] {
  if (notes.length === 0) return [];

  // Per-note searchable text + a recency percentile by timestamp RANK (not raw
  // time) so the established/emerging split is meaningful even when the whole
  // vault was created within a couple of days.
  const haystacks = notes.map((n) => ({
    text: (n.content ?? `${n.title} ${n.preview ?? ""}`).toLowerCase(),
    ts: Date.parse(n.updatedAt || n.createdAt || "") || 0,
  }));
  const n = haystacks.length;
  const ranked = haystacks.map((h, i) => ({ i, ts: h.ts })).sort((a, b) => a.ts - b.ts);
  const percentile = new Array<number>(n);
  ranked.forEach((r, rank) => {
    percentile[r.i] = n > 1 ? rank / (n - 1) : 1;
  });

  const stats = CONCEPTS.map((c) => {
    let count = 0;
    let recentCount = 0;
    let pctSum = 0;
    for (let i = 0; i < n; i++) {
      if (c.terms.some((t) => haystacks[i].text.includes(t))) {
        count++;
        pctSum += percentile[i];
        if (percentile[i] >= 0.66) recentCount++;
      }
    }
    const avgPercentile = count ? pctSum / count : 0;
    return {
      label: c.label,
      searchTerm: c.searchTerm,
      count,
      recentCount,
      emerging:
        count >= 2 &&
        avgPercentile >= EMERGING_THRESHOLD &&
        recentCount / count >= EMERGING_RECENT_SHARE,
    };
  });

  return stats
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_BARS);
}

// The notes behind a bar — same term match used for counting, newest first —
// so the inline drill-in is exactly the set the bar height represents.
export function notesForConcept(notes: Note[], label: string): Note[] {
  const concept = CONCEPTS.find((c) => c.label === label);
  if (!concept) return [];
  return notes
    .filter((n) => {
      const text = (n.content ?? `${n.title} ${n.preview ?? ""}`).toLowerCase();
      return concept.terms.some((t) => text.includes(t));
    })
    .sort(
      (a, b) =>
        (Date.parse(b.updatedAt || b.createdAt || "") || 0) -
        (Date.parse(a.updatedAt || a.createdAt || "") || 0),
    );
}

export interface GraphNode {
  label: string;
  count: number;
  emerging: boolean;
  searchTerm: string;
}
// Indices reference the returned `nodes` array.
export interface GraphEdge {
  a: number;
  b: number;
  weight: number;
}

// Concept-relationship graph for the Map view: nodes are the top concepts (same
// ones the Intelligence bars use), linked when notes mention BOTH (co-occurrence
// = shared theme). Edges are thresholded + capped so the graph stays readable.
export function conceptGraph(
  notes: Note[],
  maxEdges = 14,
  minWeight = 6,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const stats = analyzeConcepts(notes);
  const terms = stats.map((s) => CONCEPTS.find((c) => c.label === s.label)?.terms ?? []);

  const pair = new Map<string, number>();
  for (const note of notes) {
    const text = (note.content ?? `${note.title} ${note.preview ?? ""}`).toLowerCase();
    const members: number[] = [];
    terms.forEach((t, idx) => {
      if (t.some((term) => text.includes(term))) members.push(idx);
    });
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key = `${members[i]}-${members[j]}`;
        pair.set(key, (pair.get(key) ?? 0) + 1);
      }
    }
  }

  const edges = [...pair.entries()]
    .map(([k, weight]) => {
      const [a, b] = k.split("-").map(Number);
      return { a, b, weight };
    })
    .filter((e) => e.weight >= minWeight)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, maxEdges);

  const nodes: GraphNode[] = stats.map((s) => ({
    label: s.label,
    count: s.count,
    emerging: s.emerging,
    searchTerm: s.searchTerm,
  }));

  return { nodes, edges };
}
