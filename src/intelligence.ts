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
