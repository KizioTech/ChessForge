import React from "react";
import { ArrowRight } from "lucide-react";
import type { GameRecord } from "../../lib/games";

export interface DeviationItem {
  gameId?: string;
  gameWhite: string;
  gameBlack: string;
  userColour: "white" | "black";
  moveNumber: number;
  ply: number;
  playedSan: string;
  expectedSan: string;
}

interface OpeningsDeviationsTabProps {
  deviations: DeviationItem[];
  games: GameRecord[];
  onOpenAnalysis?: (game: GameRecord) => void;
}

export function OpeningsDeviationsTab({
  deviations,
  games,
  onOpenAnalysis
}: OpeningsDeviationsTabProps) {
  return (
    <div className="panel" style={{ padding: "20px" }}>
      <div style={{ marginBottom: "16px" }}>
        <div className="eyebrow">REPERTOIRE DEVIATION ALERTS</div>
        <h2 style={{ fontSize: "16px", margin: "4px 0" }}>Games Leaving Your Preparation</h2>
        <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
          Scans your library games played on Chess.com and Lichess to identify the exact move where you departed from your opening repertoire.
        </p>
      </div>

      {deviations.length === 0 ? (
        <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
          ✓ No opening deviations detected in your recorded games! You played according to your repertoire in all book positions.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {deviations.map((dev, idx) => {
            const gameMatch = games.find(g => g.id === dev.gameId);
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--raised)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "12px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                    {dev.gameWhite} vs {dev.gameBlack} ({dev.userColour === "white" ? "Played as White" : "Played as Black"})
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Deviated on move <strong>{dev.moveNumber}</strong> (ply {dev.ply}): played{" "}
                    <span style={{ color: "#f87171", fontWeight: 600 }}>{dev.playedSan}</span> instead of planned{" "}
                    <span style={{ color: "var(--lime)", fontWeight: 600 }}>{dev.expectedSan}</span>.
                  </div>
                </div>
                {gameMatch && onOpenAnalysis && (
                  <button
                    className="button button-secondary button-small"
                    onClick={() => onOpenAnalysis(gameMatch)}
                  >
                    Inspect in Analysis <ArrowRight size={12}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
