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

export const CONCEPTS: Concept[] = [
  { label: "Providing without disappearing", terms: ["without disappear", "provide without", "present and provide"], searchTerm: "disappearing" },
  { label: "The Free Man's Path", terms: ["free man", "free man's path"], searchTerm: "free man" },
  { label: "Freedom is earned", terms: ["freedom is earned", "earned, not escaped", "earned not escaped", "freedom is not", "not escape"], searchTerm: "freedom" },
  { label: "Follow-up = trust", terms: ["follow-up", "follow up", "followup", "stay in touch"], searchTerm: "follow-up" },
  { label: "CRM / pipeline leak", terms: ["crm", "go high level", "ghl", "pipeline", "48 hour", "48-hour", "leads come in"], searchTerm: "CRM" },
  { label: "Recruiting & the Gaietto Group", terms: ["recruit", "gaietto group", "downline", "upline", "agency", "agent"], searchTerm: "recruiting" },
  { label: "Ads & analytics", terms: ["meta ad", "ad account", "analytics", "zeepo", "ad spend", "paid ad", "creative"], searchTerm: "analytics" },
  { label: "Compounding systems", terms: ["compound", "infrastructure", "institutional knowledge", "the system", "sop"], searchTerm: "system" },
  { label: "Wounded Provider", terms: ["wounded provider", "absent father", "silent hero", "provider"], searchTerm: "provider" },
  { label: "Presence with family", terms: ["presence", "time with", "his kids", "people you love", "baseball field", "bedtime", "kitchen table"], searchTerm: "presence" },
  { label: "Ownership", terms: ["ownership", "own your", "owning your", "you own", "build a life"], searchTerm: "ownership" },
  { label: "Income & sales", terms: ["income", "commission", "sales call", "president's club", "400,000", "closing", "close the"], searchTerm: "income" },
  { label: "Integrity / no hype", terms: ["integrity", "no hype", "real life. real work", "plainspoken", "grounded"], searchTerm: "integrity" },
  { label: "Protection / life insurance", terms: ["life insurance", "policy", "policies", "coverage", "protect"], searchTerm: "life insurance" },
  { label: "Homestead & real footage", terms: ["chicken", "creek", "chopping wood", "homestead", "farm", "truck", "coop", "stock footage"], searchTerm: "homestead" },
  { label: "Brand canon vs compost", terms: ["brand brain", "brand doc", "voice guide", "compost", "canon"], searchTerm: "brand" },
  { label: "Knowledge graph & links", terms: ["knowledge graph", "wikilink", "[[", "graph view", "link cluster", "priority links", "connect notes"], searchTerm: "links" },
  { label: "California transcripts", terms: ["california", "airport", "car ride", "drive to the airport", "field shoot"], searchTerm: "california" },
  { label: "Scripts & hooks", terms: ["script", "hook", "caption", "cta", "pillar"], searchTerm: "script" },
];

export interface ConceptStat {
  label: string;
  searchTerm: string;
  count: number; // notes mentioning the concept
  recentCount: number; // mentions among the newest third of notes
  emerging: boolean; // mentions skew toward the newest notes
}

const MAX_BARS = 12;
// A concept is "emerging" when the average recency-rank of the notes that
// mention it sits above this (0 = oldest, 1 = newest; 0.5 = evenly spread).
const EMERGING_THRESHOLD = 0.58;

export function analyzeConcepts(notes: Note[]): ConceptStat[] {
  if (notes.length === 0) return [];

  // Per-note searchable text + a recency percentile by timestamp RANK (not raw
  // time) so the established/emerging split is meaningful even when the whole
  // vault was created within a couple of days.
  const haystacks = notes.map((n) => ({
    text: `${n.title}\n${n.content ?? n.preview ?? ""}`.toLowerCase(),
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
      emerging: count >= 2 && avgPercentile >= EMERGING_THRESHOLD,
    };
  });

  return stats
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_BARS);
}
