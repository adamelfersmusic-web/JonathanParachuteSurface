// The view registry. Adding a new lens later is a one-liner: add an entry here,
// then handle its id in App's center switch. The tab control renders from this.
export const VIEWS = [
  { id: "deck", label: "Deck" },
  { id: "pipeline", label: "Pipeline" },
  { id: "map", label: "Map" },
  { id: "founder", label: "Founder" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

export function ViewTabs({
  view,
  onChange,
}: {
  view: ViewId;
  onChange: (view: ViewId) => void;
}) {
  return (
    <div className="viewbar">
      <div className="segmented" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={`seg ${view === v.id ? "active" : ""}`}
            onClick={() => onChange(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
