import React from "react";
import { Chess, type Square } from "chess.js";
import { RotateCcw, Activity } from "lucide-react";
import { BoardView } from "../BoardView";
import { WinBar, WinBarLabels } from "./WinBar";

interface OpeningsDrillTabProps {
  drillChess: Chess;
  activeSide: "white" | "black";
  handleDrillMove: (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => void;
  drillSession: { total: number; correct: number; completed: boolean };
  drillEco: { eco: string; name: string } | null;
  drillEval: { status: "correct" | "incorrect" | "idle" | "out_of_book"; message: string };
  drillHint: string | null;
  handleStartDrill: () => void;
  handleShowDrillHint: () => void;
  drillExplorer: {
    loading: boolean;
    data: {
      moves?: Array<{
        san: string;
        white: number;
        draws: number;
        black: number;
      }>;
    } | null;
  };
}

export function OpeningsDrillTab({
  drillChess,
  activeSide,
  handleDrillMove,
  drillSession,
  drillEco,
  drillEval,
  drillHint,
  handleStartDrill,
  handleShowDrillHint,
  drillExplorer
}: OpeningsDrillTabProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 480px) 1fr", gap: "24px" }}>
      <div>
        <div className="panel" style={{ padding: "16px" }}>
          <BoardView
            game={drillChess}
            orientation={activeSide}
            onMove={handleDrillMove}
            interactive={!drillSession.completed}
          />
          {drillEco && (
            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  background: "rgba(183,227,106,0.18)",
                  color: "var(--lime)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 700,
                  fontSize: "10px",
                  fontFamily: "monospace"
                }}
              >
                {drillEco.eco}
              </span>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{drillEco.name}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="panel" style={{ padding: "18px" }}>
          <div className="eyebrow">ACTIVE RECALL PRACTICE</div>
          <h2 style={{ fontSize: "16px", margin: "4px 0 10px" }}>
            Drill {activeSide === "white" ? "White" : "Black"} Repertoire
          </h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
            Play your prepared repertoire moves on the board. ChessForge responds automatically with
            candidate opponent moves.
          </p>

          {/* Status Banner */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              background:
                drillEval.status === "correct"
                  ? "rgba(183,227,106,0.12)"
                  : drillEval.status === "incorrect"
                  ? "rgba(248,113,113,0.12)"
                  : "var(--raised)",
              color:
                drillEval.status === "correct"
                  ? "var(--lime)"
                  : drillEval.status === "incorrect"
                  ? "#f87171"
                  : "var(--fg)",
              border: `1px solid ${
                drillEval.status === "correct"
                  ? "var(--lime)"
                  : drillEval.status === "incorrect"
                  ? "#f87171"
                  : "var(--border)"
              }`
            }}
          >
            {drillEval.message || "Ready to drill."}
          </div>

          {/* Hint Box if requested */}
          {drillHint && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(183,227,106,0.1)",
                border: "1px dashed var(--lime)",
                borderRadius: "6px",
                marginBottom: "14px",
                fontSize: "12px",
                color: "var(--lime)"
              }}
            >
              💡 {drillHint}
            </div>
          )}

          {/* Drill Score Card */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "16px"
            }}
          >
            <div
              className="panel"
              style={{ padding: "12px", textAlign: "center", background: "var(--sunken)" }}
            >
              <div className="eyebrow">MOVES TESTED</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{drillSession.total}</div>
            </div>
            <div
              className="panel"
              style={{ padding: "12px", textAlign: "center", background: "var(--sunken)" }}
            >
              <div className="eyebrow">ACCURACY</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--lime)" }}>
                {drillSession.total > 0
                  ? `${Math.round((drillSession.correct / drillSession.total) * 100)}%`
                  : "—"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="button button-primary" onClick={handleStartDrill} style={{ flex: 1 }}>
              <RotateCcw size={14} /> Restart Drill
            </button>
            {!drillSession.completed && (
              <button
                className="button button-secondary"
                onClick={handleShowDrillHint}
                title="Show hint for expected repertoire move"
              >
                💡 Hint
              </button>
            )}
          </div>
        </div>

        {/* Practice Move Suggestions & Win Percentages */}
        {drillExplorer.data && drillExplorer.data.moves && drillExplorer.data.moves.length > 0 && (
          <div className="panel" style={{ padding: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px"
              }}
            >
              <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>COMMON MOVES &amp; WIN RATES</span>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "none" }}>
                  (Position Context)
                </span>
              </div>
              {drillExplorer.loading && (
                <Activity
                  size={12}
                  style={{ color: "var(--muted)", animation: "spin 1s linear infinite" }}
                />
              )}
            </div>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px" }}>
              Most common continuations played from this position across online games:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {drillExplorer.data.moves.slice(0, 4).map((m, idx) => {
                const total = m.white + m.draws + m.black;
                return (
                  <div
                    key={idx}
                    style={{ padding: "8px 12px", background: "var(--sunken)", borderRadius: "6px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "4px"
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "14px",
                          fontFamily: "monospace",
                          color: "var(--lime)"
                        }}
                      >
                        {m.san}
                      </strong>
                      <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                        {(total / 1000).toFixed(total >= 1000000 ? 0 : 1)}k games
                      </span>
                    </div>
                    <WinBar white={m.white} draws={m.draws} black={m.black} />
                    <WinBarLabels white={m.white} draws={m.draws} black={m.black} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
