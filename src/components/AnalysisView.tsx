import React, { useState, useMemo, useEffect } from "react";
import { Chess, type Square } from "chess.js";
import {
  Crown,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Undo2,
  ArrowDownRight,
  Sparkles,
  Plus,
  Zap,
  X,
  Brain,
  ShieldCheck
} from "lucide-react";
import { BoardView } from "./BoardView";
import { EvalGraph } from "./EvalGraph";
import { StockfishEngine } from "../lib/engine/stockfish-engine";
import type { PositionEvaluation, PositionRecord, MoveAnalysisReport } from "../lib/engine/types";
import type { GameRecord } from "../lib/games";

export function EvaluationRail({ value = 0.35 }: { value?: number }) {
  const whitePct = Math.max(8, Math.min(92, 50 + value * 14));
  return (
    <div className="eval-rail" aria-label={`Evaluation ${value > 0 ? "+" : ""}${value.toFixed(2)}`}>
      <div className="eval-black" style={{ height: `${100 - whitePct}%` }} />
      <div className="eval-white" style={{ height: `${whitePct}%` }} />
      <span className="eval-number">
        {value > 0 ? "+" : ""}
        {value.toFixed(2)}
      </span>
    </div>
  );
}

interface AnalysisViewProps {
  game: Chess;
  onMove: (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => void;
  onUndo: () => void;
  history: any[];
  movePairs: any[];
  historyIndex: number;
  goToMove: (i: number) => void;
  orientation: "white" | "black";
  setOrientation: React.Dispatch<React.SetStateAction<"white" | "black">>;
  activeGame: GameRecord | null;
  onClearActiveGame: () => void;
  analysisPositions: PositionRecord[];
  moveReports: MoveAnalysisReport[];
  isAnalyzing: boolean;
  analysisProgress: number;
  onAnalyzeGame: () => void;
  onCancelAnalysis: () => void;
  hasMoves?: boolean;
}

export function AnalysisView({
  game,
  onMove,
  onUndo,
  history,
  movePairs,
  historyIndex,
  goToMove,
  orientation,
  setOrientation,
  activeGame,
  onClearActiveGame,
  analysisPositions,
  moveReports,
  isAnalyzing,
  analysisProgress,
  onAnalyzeGame,
  onCancelAnalysis,
  hasMoves = false
}: AnalysisViewProps) {
  const [liveEval, setLiveEval] = useState<PositionEvaluation | null>(null);
  const [isLiveCalculating, setIsLiveCalculating] = useState(false);
  const [engineEnabled, setEngineEnabled] = useState(true);

  // Build report lookup by ply for badge rendering
  const reportByPly = useMemo(
    () => Object.fromEntries(moveReports.map(r => [r.ply, r])),
    [moveReports]
  );

  // Look up pre-computed evaluation for current ply
  const cachedEval = useMemo(() => {
    if (analysisPositions.length === 0) return null;
    return analysisPositions.find(p => p.ply === historyIndex) ?? analysisPositions[historyIndex] ?? null;
  }, [analysisPositions, historyIndex]);

  // Live Stockfish evaluation for current position on board
  useEffect(() => {
    if (!engineEnabled) {
      setLiveEval(null);
      setIsLiveCalculating(false);
      return;
    }

    if (cachedEval) {
      setLiveEval(cachedEval as unknown as PositionEvaluation);
      setIsLiveCalculating(false);
      return;
    }

    const fen = game.fen();
    const controller = new AbortController();
    setIsLiveCalculating(true);

    const liveEngine = new StockfishEngine({ depth: 12, multiPv: 3 });
    liveEngine
      .evaluatePosition(fen, {
        depth: 12,
        multiPv: 3,
        signal: controller.signal,
        ply: historyIndex
      })
      .then(result => {
        setLiveEval(result);
        setIsLiveCalculating(false);
      })
      .catch(err => {
        if ((err as DOMException).name !== "AbortError") {
          console.warn("Live evaluation:", err);
        }
        setIsLiveCalculating(false);
      });

    return () => {
      controller.abort();
      liveEngine.dispose();
    };
  }, [game, historyIndex, cachedEval, engineEnabled]);

  const currentEval = cachedEval || liveEval;

  const mateIn = currentEval
    ? "mateIn" in currentEval
      ? currentEval.mateIn
      : (currentEval as any).mate_in
    : null;

  const scoreCp = currentEval
    ? "scoreCp" in currentEval
      ? currentEval.scoreCp
      : (currentEval as any).score_cp
    : null;

  // Derive an eval-rail value from current position evaluation (centipawns → ±N)
  const evalValue =
    mateIn !== null && mateIn !== undefined
      ? mateIn > 0
        ? 5
        : -5
      : (scoreCp ?? 0) / 100;

  const evalLabel =
    mateIn !== null && mateIn !== undefined
      ? `M${Math.abs(mateIn)}`
      : scoreCp !== null && scoreCp !== undefined
      ? `${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(2)}`
      : isLiveCalculating
      ? "…"
      : "0.00";

  const isCheckmatePosition = game.isCheckmate();
  const isCheckPosition = game.inCheck() && !game.isCheckmate();

  // MultiPV candidate lines to display
  const candidateLines = useMemo(() => {
    if (!currentEval) return [];
    if ("lines" in currentEval && Array.isArray((currentEval as any).lines))
      return (currentEval as any).lines;
    if ("pv_lines" in currentEval && Array.isArray((currentEval as any).pv_lines))
      return (currentEval as any).pv_lines;
    return [];
  }, [currentEval]);

  const currentReport = reportByPly[historyIndex];

  return (
    <div className="analysis-content">
      <div className="analysis-layout">
        <section className="board-panel panel">
          <div className="board-topline">
            <span>
              <span className="live-dot" /> BOARD
            </span>
            <span className="turn-label">
              {isCheckmatePosition ? (
                <span
                  className="status-pill status-checkmate"
                  style={{
                    color: "#ff5252",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Crown size={13} /> CHECKMATE · {game.turn() === "w" ? "Black" : "White"} wins
                </span>
              ) : game.isStalemate() || (game.isDraw() && !game.isCheckmate()) ? (
                <span className="status-pill status-draw" style={{ color: "#fbbf24", fontWeight: 600 }}>
                  DRAW · {game.isStalemate() ? "Stalemate" : "Drawn game"}
                </span>
              ) : isCheckPosition ? (
                <span
                  className="status-pill status-check"
                  style={{
                    color: "#ff5252",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <AlertTriangle size={13} /> {game.turn() === "w" ? "White" : "Black"} in check
                </span>
              ) : (
                `${game.turn() === "w" ? "White" : "Black"} to move`
              )}
            </span>
          </div>

          {/* Checkmate banner */}
          {isCheckmatePosition && (
            <div className="analysis-checkmate-banner">
              <Crown size={18} />
              <strong>{game.turn() === "w" ? "Black" : "White"} wins by checkmate</strong>
              <span>Game over</span>
            </div>
          )}

          {/* Check highlight banner */}
          {isCheckPosition && (
            <div className="analysis-check-banner">
              <AlertTriangle size={15} />
              <strong>{game.turn() === "w" ? "White" : "Black"} is in check</strong>
            </div>
          )}

          <div className="board-wrapper">
            {/* Top player above board (Left-aligned) */}
            {(() => {
              const topIsBlack = orientation === "white";
              const topColor = topIsBlack ? "b" : "w";
              const topName = activeGame
                ? topIsBlack
                  ? activeGame.black
                  : activeGame.white
                : topIsBlack
                ? "Black"
                : "White";
              const topElo = activeGame
                ? topIsBlack
                  ? activeGame.black_elo
                  : activeGame.white_elo
                : null;
              const topIsUser = activeGame?.user_colour
                ? topIsBlack
                  ? activeGame.user_colour === "black"
                  : activeGame.user_colour === "white"
                : false;

              return (
                <div
                  className="board-player-tag board-player-top"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "2px 0 6px 20px",
                    flexShrink: 0
                  }}
                >
                  <div
                    className={`player-avatar ${topColor === "w" ? "white-avatar" : "black-avatar"}`}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "5px",
                      fontSize: "10px",
                      fontWeight: 700
                    }}
                  >
                    {topColor === "w" ? "W" : "B"}
                  </div>
                  <strong style={{ fontSize: "12px", fontWeight: 600 }}>{topName}</strong>
                  {topElo && (
                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>({topElo})</span>
                  )}
                  {topIsUser && (
                    <span
                      style={{
                        fontSize: "9px",
                        background: "rgba(183, 227, 106, 0.15)",
                        color: "var(--lime)",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        fontWeight: 600
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Board and evaluation rail */}
            <div className="board-stage">
              <EvaluationRail value={evalValue} />
              <BoardView game={game} orientation={orientation} onMove={onMove} />
            </div>

            {/* Bottom player below board (Left-aligned) */}
            {(() => {
              const bottomIsBlack = orientation !== "white";
              const bottomColor = bottomIsBlack ? "b" : "w";
              const bottomName = activeGame
                ? bottomIsBlack
                  ? activeGame.black
                  : activeGame.white
                : bottomIsBlack
                ? "Black"
                : "White";
              const bottomElo = activeGame
                ? bottomIsBlack
                  ? activeGame.black_elo
                  : activeGame.white_elo
                : null;
              const bottomIsUser = activeGame?.user_colour
                ? bottomIsBlack
                  ? activeGame.user_colour === "black"
                  : activeGame.user_colour === "white"
                : false;

              return (
                <div
                  className="board-player-tag board-player-bottom"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 0 2px 20px",
                    flexShrink: 0
                  }}
                >
                  <div
                    className={`player-avatar ${bottomColor === "w" ? "white-avatar" : "black-avatar"}`}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "5px",
                      fontSize: "10px",
                      fontWeight: 700
                    }}
                  >
                    {bottomColor === "w" ? "W" : "B"}
                  </div>
                  <strong style={{ fontSize: "12px", fontWeight: 600 }}>{bottomName}</strong>
                  {bottomElo && (
                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>({bottomElo})</span>
                  )}
                  {bottomIsUser && (
                    <span
                      style={{
                        fontSize: "9px",
                        background: "rgba(183, 227, 106, 0.15)",
                        color: "var(--lime)",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        fontWeight: 600
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="board-controls">
              <button
                className="icon-btn"
                onClick={() => goToMove(0)}
                title="Go to start (Home)"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                className="icon-btn"
                onClick={() => goToMove(historyIndex - 1)}
                title="Previous move (←)"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() => goToMove(historyIndex + 1)}
                title="Next move (→)"
              >
                <ChevronRight size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() => goToMove(history.length)}
                title="Go to end"
              >
                <ArrowRight size={15} />
              </button>
              <span className="move-position">
                {historyIndex === 0
                  ? "Starting position"
                  : `After ${Math.ceil(historyIndex / 2)}.${historyIndex % 2 ? " White" : " Black"}`}
              </span>
              <button
                className="icon-btn"
                onClick={onUndo}
                disabled={history.length === 0}
                title="Undo last move (Ctrl+Z)"
                style={{ marginLeft: "auto", opacity: history.length === 0 ? 0.3 : 1 }}
              >
                <Undo2 size={15} />
              </button>
              <button
                className="icon-btn flip-btn"
                onClick={() =>
                  setOrientation((prev: string) => (prev === "white" ? "black" : "white"))
                }
                title="Flip board"
              >
                <ArrowDownRight size={15} />
              </button>
            </div>

            {/* Evaluation Graph — shown below board controls once analysis is available */}
            {analysisPositions.length > 1 && (
              <div style={{ flexShrink: 0 }}>
                <EvalGraph
                  positions={analysisPositions}
                  currentPly={historyIndex}
                  onSelectPly={goToMove}
                  reports={moveReports}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="analysis-side">
          {/* Analysis workspace title & engine actions */}
          <div className="analysis-heading">
            <div>
              <div className="eyebrow">
                {activeGame ? (
                  <>
                    <Sparkles size={13} /> {activeGame.platform.toUpperCase()} GAME
                    <span
                      className="demo-pill"
                      style={{
                        color: "var(--lime)",
                        borderColor: "var(--lime-dark)",
                        background: "#1c2a1e"
                      }}
                    >
                      LIBRARY GAME
                    </span>
                  </>
                ) : (
                  <>
                    GAME REVIEW <span className="demo-pill">INTERACTIVE PREVIEW</span>
                  </>
                )}
              </div>
              <h1>Analysis workspace</h1>
              <p className="subheading">
                {activeGame
                  ? `${activeGame.white} (${activeGame.white_elo || "unrated"}) vs ${activeGame.black} (${activeGame.black_elo || "unrated"}) · Result: ${activeGame.result} · ${activeGame.moves_count} moves`
                  : "Explore a position, navigate moves and inspect the analysis layout."}
              </p>
            </div>
            <div className="analysis-actions">
              {activeGame && (
                <button
                  className="button button-secondary"
                  onClick={onClearActiveGame}
                  title="Clear loaded game and start new board"
                >
                  <Plus size={14} /> New board
                </button>
              )}
              <button
                className="button button-secondary"
                onClick={() => setEngineEnabled(!engineEnabled)}
                title={engineEnabled ? "Disable live evaluation" : "Enable live evaluation"}
              >
                <Zap size={14} style={{ color: engineEnabled ? "var(--lime)" : "var(--muted)" }} />
                {engineEnabled ? "Engine ON" : "Engine OFF"}
              </button>
              {isAnalyzing ? (
                <button
                  className="button button-secondary analysis-cancel-btn"
                  onClick={onCancelAnalysis}
                >
                  <X size={14} /> Cancel ({analysisProgress}%)
                </button>
              ) : (
                <button
                  className="button button-primary"
                  onClick={onAnalyzeGame}
                  disabled={!activeGame && !hasMoves}
                  title={
                    !activeGame && !hasMoves
                      ? "Make moves on the board or load a game to analyse"
                      : undefined
                  }
                >
                  <Sparkles size={14} />{" "}
                  {analysisPositions.length > 0 ? "Re-analyse" : "Analyse game"}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isAnalyzing && (
            <div className="analysis-progress-track">
              <div
                className="analysis-progress-bar"
                style={{ width: `${analysisProgress}%` }}
              />
              <span className="analysis-progress-label">
                Analysing… {analysisProgress}%
              </span>
            </div>
          )}

          {/* Engine Evaluation Panel */}
          <section className="panel evaluation-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">ENGINE EVALUATION</div>
                <h2>Position assessment</h2>
              </div>
              {engineEnabled ? (
                <span
                  className="engine-badge"
                  onClick={() => setEngineEnabled(false)}
                  title="Click to pause engine"
                  style={{ cursor: "pointer" }}
                >
                  <span className="status-live" />{" "}
                  {isLiveCalculating ? "Calculating…" : "SF19 · Online"}
                </span>
              ) : (
                <span
                  className="engine-badge"
                  onClick={() => setEngineEnabled(true)}
                  title="Click to resume engine"
                  style={{ cursor: "pointer" }}
                >
                  <span className="status-muted" /> Offline (Paused)
                </span>
              )}
            </div>

            <div className="eval-main">
              <span className="eval-score">{evalLabel}</span>
              <span className="eval-caption">
                {mateIn !== null && mateIn !== undefined
                  ? `Forced mate in ${Math.abs(mateIn)}`
                  : evalValue > 1
                  ? "White is better"
                  : evalValue < -1
                  ? "Black is better"
                  : "Roughly equal"}
              </span>
            </div>

            {/* MultiPV candidate lines */}
            {candidateLines.length > 0 && (
              <div className="candidate-lines">
                {candidateLines.map((line: any) => {
                  const lineMate = line.mateIn ?? line.mate_in ?? null;
                  const lineCp = line.scoreCp ?? line.score_cp ?? 0;
                  return (
                    <div
                      key={line.rank}
                      className="candidate-line"
                      onClick={() => {
                        if (line.uci && line.uci.length >= 4) {
                          onMove(
                            line.uci.slice(0, 2) as Square,
                            line.uci.slice(2, 4) as Square,
                            line.uci[4] as any
                          );
                        }
                      }}
                      title="Click to play this move on board"
                    >
                      <span className="rank-badge">{line.rank === 1 ? "★" : `${line.rank}.`}</span>
                      <div className="candidate-body">
                        <div className="candidate-header">
                          <strong className="candidate-san">{line.san || line.uci || "—"}</strong>
                          <span className="candidate-score">
                            {lineMate !== null && lineMate !== undefined
                              ? `M${Math.abs(lineMate)}`
                              : `${lineCp > 0 ? "+" : ""}${(lineCp / 100).toFixed(2)}`}
                          </span>
                        </div>
                        {line.pvSan && (
                          <span className="candidate-continuation">{line.pvSan}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="engine-settings">
              <span>
                Depth <b>12</b>
              </span>
              <span>
                MultiPV <b>3</b>
              </span>
              <span>
                Engine <b>Stockfish 19 Lite</b>
              </span>
            </div>
          </section>

          {/* Moves / Notation Panel */}
          <section className="panel moves-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">NOTATION</div>
                <h2>Moves</h2>
              </div>
              <span className="move-count">{history.length} plies</span>
            </div>
            {history.length === 0 ? (
              <div className="moves-empty">
                <div className="moves-empty-board">♟</div>
                <strong>Ready for a game</strong>
                <p>Make legal moves on the board or import a PGN to review a real game.</p>
              </div>
            ) : (
              <div className="move-list">
                {movePairs.map((pair: any, i: number) => (
                  <div className="move-row" key={pair.n}>
                    <span className="move-number">{pair.n}.</span>
                    <button
                      className={historyIndex === i * 2 + 1 ? "move-active" : ""}
                      onClick={() => goToMove(i * 2 + 1)}
                    >
                      {pair.white?.san || "—"}
                      {reportByPly[i * 2 + 1]?.classification === "blunder" && (
                        <span className="badge-blunder" title="Blunder">
                          ??
                        </span>
                      )}
                      {reportByPly[i * 2 + 1]?.classification === "mistake" && (
                        <span className="badge-mistake" title="Mistake">
                          ?
                        </span>
                      )}
                      {reportByPly[i * 2 + 1]?.classification === "inaccuracy" && (
                        <span className="badge-inaccuracy" title="Inaccuracy">
                          ?!
                        </span>
                      )}
                    </button>
                    <button
                      className={historyIndex === i * 2 + 2 ? "move-active" : ""}
                      onClick={() => goToMove(i * 2 + 2)}
                    >
                      {pair.black?.san || ""}
                      {reportByPly[i * 2 + 2]?.classification === "blunder" && (
                        <span className="badge-blunder" title="Blunder">
                          ??
                        </span>
                      )}
                      {reportByPly[i * 2 + 2]?.classification === "mistake" && (
                        <span className="badge-mistake" title="Mistake">
                          ?
                        </span>
                      )}
                      {reportByPly[i * 2 + 2]?.classification === "inaccuracy" && (
                        <span className="badge-inaccuracy" title="Inaccuracy">
                          ?!
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel lesson-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">LEARNING NOTES</div>
                <h2>What to look for</h2>
              </div>
              <Brain size={16} className="muted" />
            </div>
            {currentReport?.tags && currentReport.tags.length > 0 ? (
              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="badge-blunder" style={{ padding: "2px 6px", fontSize: "11px" }}>
                    {currentReport.classification.toUpperCase()}
                  </span>
                  <strong style={{ fontSize: "12px", color: "var(--text)" }}>Tactical Diagnosis</strong>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {currentReport.tags.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "rgba(183, 227, 106, 0.12)",
                        color: "var(--lime)",
                        border: "1px solid rgba(183, 227, 106, 0.25)",
                        fontWeight: 500
                      }}
                    >
                      {t.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                  Loss of {currentReport.loss}% win probability. Recommended move was{" "}
                  <b style={{ color: "var(--text)" }}>
                    {currentReport.bestSan || currentReport.bestUci}
                  </b>
                  .
                </p>
              </div>
            ) : (
              <div className="lesson-empty">
                <Sparkles size={15} />
                <span>
                  After engine analysis, ChessForge will explain critical moments, tag
                  recurring tactical blindspots, and suggest positions worth practising.
                </span>
              </div>
            )}
          </section>

          {/* Footnote at the bottom of the scrollable right panel */}
          <div className="analysis-footnote">
            <ShieldCheck size={13} /> Engine analysis is for post-game review only. No live-game
            assistance is ever provided.
          </div>
        </aside>
      </div>
    </div>
  );
}
