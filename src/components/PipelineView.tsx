import { ScriptsBoard } from "./ScriptsBoard";
import type { Note, ScriptStatus } from "../types";

// The roomy, dedicated home for the scripts kanban — "what's in motion right
// now." Same board as on the Deck, given full width and room to breathe.
export function PipelineView({
  notes,
  onOpen,
  onMove,
}: {
  notes: Note[];
  onOpen: (n: Note) => void;
  onMove: (n: Note, s: ScriptStatus) => void;
}) {
  return (
    <div className="pipeline-view">
      <div className="view-head">
        <h2 className="view-title">Pipeline</h2>
        <p className="view-sub">
          What&rsquo;s in motion — Draft &rarr; Approved &rarr; Filmed &rarr; Edited &rarr; Published
        </p>
      </div>
      <ScriptsBoard notes={notes} onOpen={onOpen} onMove={onMove} />
    </div>
  );
}
