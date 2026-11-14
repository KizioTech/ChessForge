import { useState } from "react";
import { BookOpen, Layers } from "lucide-react";
import { OpeningLibrary } from "./OpeningLibrary";
import { OpeningsView } from "./OpeningsView";
import { createDefaultRepertoiresIfEmpty, importPgnToRepertoire } from "../lib/openings/repertoire-service";
import type { BookOpening } from "../lib/openings/opening-book";
import type { OpeningSide } from "../lib/openings/learn-tree";
import type { GameRecord } from "../lib/games";

interface HubProps {
  userId?: string | null;
  games: GameRecord[];
  onOpenAnalysis?: (game: GameRecord) => void;
  initialFamily?: string | null;
}

/**
 * The Openings page has two clearly separate jobs:
 *  - Learn: browse every opening and variation, study it, practise it from memory.
 *  - My Repertoire: the lines you have chosen to play, once you know them.
 */
export function OpeningsHub({ userId, games, onOpenAnalysis, initialFamily }: HubProps) {
  const [mode, setMode] = useState<"learn" | "repertoire">("learn");

  async function addLine(line: BookOpening, side: OpeningSide): Promise<number> {
    const uId = userId || "local-user";
    const reps = await createDefaultRepertoiresIfEmpty(uId);
    const rep = reps.find(r => r.side === side) ?? reps[0];
    return importPgnToRepertoire(rep.id, uId, line.pgn, side);
  }

  return (
    <div className="ol-hub">
      <div className="ol-switch" role="tablist" aria-label="Openings sections">
        <button role="tab" aria-selected={mode === "learn"} className={mode === "learn" ? "on" : ""} onClick={() => setMode("learn")}>
          <BookOpen size={14} /> Learn openings
        </button>
        <button role="tab" aria-selected={mode === "repertoire"} className={mode === "repertoire" ? "on" : ""} onClick={() => setMode("repertoire")}>
          <Layers size={14} /> My repertoire
        </button>
        <span className="ol-switch-note">
          {mode === "learn" ? "Study and practise lines first." : "Your chosen lines, for when you already know them."}
        </span>
      </div>

      {mode === "learn" ? (
        <OpeningLibrary
          userId={userId}
          onAddLine={addLine}
          onViewRepertoire={() => setMode("repertoire")}
          initialFamily={initialFamily}
        />
      ) : (
        <OpeningsView
          userId={userId}
          games={games}
          onOpenAnalysis={onOpenAnalysis}
          onBrowseOpenings={() => setMode("learn")}
        />
      )}
    </div>
  );
}
