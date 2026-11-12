/**
 * OpeningsView — Opening Repertoires, Practice Drilling, and Game Deviation Alerts
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import {
  BookOpen,
  Plus,
  Play,
  RotateCcw,
  AlertTriangle,
  Check,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  Sparkles,
  ArrowRight,
  Layers,
  Activity,
  Edit2,
  Compass
} from "lucide-react";
import { BoardView } from "./BoardView";
import type { GameRecord } from "../lib/games";
import {
  type RepertoireRecord,
  type RepertoireLineNode,
  type RepertoireTreeNode,
  type RepertoireSide,
  type GameDeviation,
  createDefaultRepertoiresIfEmpty,
  getRepertoires,
  getRepertoireLines,
  addRepertoireMove,
  deleteRepertoireMove,
  importPgnToRepertoire,
  buildRepertoireTree,
  exportTreeToPgn,
  startDrillSession,
  submitDrillMove,
  detectAllDeviations,
  START_FEN,
  normalizeFen
} from "../lib/openings";

interface OpeningsViewProps {
  userId?: string | null;
  games: GameRecord[];
  onOpenAnalysis?: (game: GameRecord) => void;
}

export function OpeningsView({ userId, games, onOpenAnalysis }: OpeningsViewProps) {
  const [repertoires, setRepertoires] = useState<RepertoireRecord[]>([]);
  const [activeSide, setActiveSide] = useState<RepertoireSide>("white");
  const [activeTab, setActiveTab] = useState<"build" | "drill" | "deviations">("build");
  const [lines, setLines] = useState<RepertoireLineNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Board navigation state
  const [currentHistory, setCurrentHistory] = useState<Array<{ san: string; uci: string; node?: RepertoireLineNode }>>([]);
  const [moveComment, setMoveComment] = useState("");
  const [importPgnModal, setImportPgnModal] = useState(false);
  const [pgnInput, setPgnInput] = useState("");
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Drilling state
  const [drillActive, setDrillActive] = useState(false);
  const [drillChess, setDrillChess] = useState<Chess>(new Chess());
  const [drillEval, setDrillEval] = useState<{
    status: "correct" | "incorrect" | "out_of_book" | "idle";
    message: string;
  }>({ status: "idle", message: "" });
  const [drillSession, setDrillSession] = useState<{
    currentFen: string;
    currentNode: RepertoireTreeNode | null;
    total: number;
    correct: number;
    completed: boolean;
  }>({ currentFen: START_FEN, currentNode: null, total: 0, correct: 0, completed: false });

  // Load repertoires on mount / user change
  const loadData = useCallback(async () => {
    setLoading(true);
    const uId = userId || "local-user";
    const reps = await createDefaultRepertoiresIfEmpty(uId);
    setRepertoires(reps);

    const activeRep = reps.find(r => r.side === activeSide) || reps[0];
    if (activeRep) {
      const repLines = await getRepertoireLines(activeRep.id, uId);
      setLines(repLines);
    }
    setLoading(false);
  }, [userId, activeSide]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Current active repertoire
  const currentRepertoire = useMemo(() => {
    return repertoires.find(r => r.side === activeSide) || repertoires[0];
  }, [repertoires, activeSide]);

  // Build tree from flat lines
  const repertoireTree = useMemo(() => {
    return buildRepertoireTree(lines);
  }, [lines]);

  // Build interactive chess instance from current move history
  const explorerChess = useMemo(() => {
    const c = new Chess();
    for (const m of currentHistory) {
      try {
        c.move(m.san);
      } catch {
        // ignore
      }
    }
    return c;
  }, [currentHistory]);

  // Current parent node ID (the last move in current history, or null if starting pos)
  const currentParentNode = useMemo(() => {
    if (currentHistory.length === 0) return null;
    return currentHistory[currentHistory.length - 1].node || null;
  }, [currentHistory]);

  // Available candidate repertoire moves from the current position
  const candidateMoves = useMemo(() => {
    const parentId = currentParentNode ? currentParentNode.id : null;
    return lines.filter(l => (l.parent_id ?? null) === parentId);
  }, [lines, currentParentNode]);

  // Handle board move in Explorer mode
  const handleExplorerMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    try {
      const temp = new Chess(explorerChess.fen());
      const move = temp.move({ from, to, promotion: promotion || "q" });
      if (!move) return;

      const ply = currentHistory.length + 1;
      const isUserMove = activeSide === "white" ? move.color === "w" : move.color === "b";
      const uci = `${from}${to}${promotion || ""}`;

      // Check if move is already recorded
      const existing = candidateMoves.find(c => c.san === move.san || c.uci === uci);

      if (existing) {
        // Step into existing line
        setCurrentHistory(prev => [...prev, { san: move.san, uci, node: existing }]);
        setMoveComment(existing.comment || "");
      } else {
        // Add new move to repertoire automatically
        const uId = userId || "local-user";
        addRepertoireMove(currentRepertoire.id, uId, {
          parentId: currentParentNode ? currentParentNode.id : null,
          ply,
          fen: temp.fen(),
          san: move.san,
          uci,
          sideToMove: move.color === "w" ? "white" : "black",
          isUserMove,
          comment: "",
        }).then(newNode => {
          setLines(prev => [...prev, newNode]);
          setCurrentHistory(prev => [...prev, { san: move.san, uci, node: newNode }]);
          setMoveComment("");
        });
      }
    } catch {
      // invalid move
    }
  };

  // Jump to specific point in explorer history
  const handleJumpToHistory = (index: number) => {
    if (index === -1) {
      setCurrentHistory([]);
      setMoveComment("");
      return;
    }
    const sliced = currentHistory.slice(0, index + 1);
    setCurrentHistory(sliced);
    const lastNode = sliced[sliced.length - 1]?.node;
    setMoveComment(lastNode?.comment || "");
  };

  // Delete current move and variations
  const handleDeleteCurrentMove = async () => {
    if (!currentParentNode) return;
    const uId = userId || "local-user";
    await deleteRepertoireMove(currentParentNode.id, uId);
    handleJumpToHistory(currentHistory.length - 2);
    const updated = await getRepertoireLines(currentRepertoire.id, uId);
    setLines(updated);
  };

  // Save comment on current node
  const handleSaveComment = async () => {
    if (!currentParentNode) return;
    const uId = userId || "local-user";
    const updatedNode = { ...currentParentNode, comment: moveComment };
    setLines(prev => prev.map(l => (l.id === updatedNode.id ? updatedNode : l)));
    // Add/update via addRepertoireMove duplicate handler
    await addRepertoireMove(currentRepertoire.id, uId, {
      parentId: updatedNode.parent_id,
      ply: updatedNode.ply,
      fen: updatedNode.fen,
      san: updatedNode.san,
      uci: updatedNode.uci,
      sideToMove: updatedNode.side_to_move,
      isUserMove: updatedNode.is_user_move,
      comment: moveComment,
    });
  };

  // PGN Import handler
  const handleImportPgn = async () => {
    if (!pgnInput.trim()) return;
    const uId = userId || "local-user";
    const importedCount = await importPgnToRepertoire(
      currentRepertoire.id,
      uId,
      pgnInput,
      activeSide
    );
    setImportNotice(`Successfully imported ${importedCount} move nodes into your ${activeSide} repertoire!`);
    setPgnInput("");
    setImportPgnModal(false);
    const repLines = await getRepertoireLines(currentRepertoire.id, uId);
    setLines(repLines);
    setTimeout(() => setImportNotice(null), 4000);
  };

  // PGN Export handler
  const handleExportPgn = () => {
    const pgn = exportTreeToPgn(repertoireTree, activeSide, currentRepertoire.title);
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSide}-repertoire.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Practice / Drilling Logic ──────────────────────────────────────────────

  const handleStartDrill = () => {
    const { state, initialOpponentMove } = startDrillSession(repertoireTree, activeSide);
    const ch = new Chess(state.currentFen);
    setDrillChess(ch);
    setDrillSession({
      currentFen: state.currentFen,
      currentNode: state.currentNode,
      total: 0,
      correct: 0,
      completed: state.isCompleted,
    });
    setDrillEval({
      status: "idle",
      message: initialOpponentMove
        ? `Opponent opened with ${initialOpponentMove}. Your turn!`
        : "Your turn: Play your repertoire opening move.",
    });
    setDrillActive(true);
  };

  const handleDrillMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    try {
      const temp = new Chess(drillChess.fen());
      const move = temp.move({ from, to, promotion: promotion || "q" });
      if (!move) return;

      const playedSan = move.san;
      const { evaluation, nextState } = submitDrillMove(
        {
          currentFen: drillSession.currentFen,
          historyMoves: [],
          currentNode: drillSession.currentNode,
          side: activeSide,
          totalSteps: drillSession.total,
          correctSteps: drillSession.correct,
          failedSteps: 0,
          isCompleted: false,
        },
        repertoireTree,
        playedSan
      );

      if (evaluation.status === "correct") {
        const updatedChess = new Chess(nextState.currentFen);
        setDrillChess(updatedChess);
        setDrillSession({
          currentFen: nextState.currentFen,
          currentNode: nextState.currentNode,
          total: nextState.totalSteps,
          correct: nextState.correctSteps,
          completed: nextState.isCompleted,
        });

        if (nextState.isCompleted) {
          setDrillEval({
            status: "correct",
            message: `✓ Correct (${playedSan})! Repertoire line completed!`,
          });
        } else {
          setDrillEval({
            status: "correct",
            message: `✓ Correct! Opponent replied ${evaluation.opponentReplySan}. Your turn!`,
          });
        }
      } else {
        // Incorrect
        setDrillEval({
          status: "incorrect",
          message: `✗ ${playedSan} is not in your repertoire. Expected: ${evaluation.expectedSan}${evaluation.comment ? ` (${evaluation.comment})` : ""}`,
        });
      }
    } catch {
      // invalid move
    }
  };

  // ── Deviations Detection ───────────────────────────────────────────────────

  const deviations = useMemo(() => {
    // Collect both white and black repertoire trees
    return detectAllDeviations(games, repertoireTree, repertoireTree);
  }, [games, repertoireTree]);

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="content" style={{ maxWidth: "1280px" }}>
      {/* Top Header */}
      <div className="welcome-row" style={{ marginBottom: "16px" }}>
        <div>
          <div className="eyebrow">
            <BookOpen size={13} /> OPENING REPERTOIRES (PHASE 7)
          </div>
          <h1>Repertoire Studio</h1>
          <p className="subheading">
            Build White and Black repertoire trees, practice active recall, and identify game deviations.
          </p>
        </div>

        {/* Repertoire Side Selector */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="tab-group" style={{ display: "flex", gap: "4px", background: "var(--sunken)", padding: "3px", borderRadius: "8px" }}>
            <button
              className={`button button-small ${activeSide === "white" ? "button-primary" : "button-ghost"}`}
              onClick={() => { setActiveSide("white"); setCurrentHistory([]); setDrillActive(false); }}
            >
              ♔ White Repertoire
            </button>
            <button
              className={`button button-small ${activeSide === "black" ? "button-primary" : "button-ghost"}`}
              onClick={() => { setActiveSide("black"); setCurrentHistory([]); setDrillActive(false); }}
            >
              ♚ Black Repertoire
            </button>
          </div>
        </div>
      </div>

      {importNotice && (
        <div style={{ padding: "10px 14px", background: "rgba(183,227,106,0.12)", border: "1px solid var(--lime)", borderRadius: "6px", color: "var(--lime)", marginBottom: "16px", fontSize: "13px" }}>
          <Check size={14} style={{ display: "inline", marginRight: "6px" }}/>
          {importNotice}
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border)", marginBottom: "18px", paddingBottom: "8px" }}>
        <button
          className={`tab-btn ${activeTab === "build" ? "active" : ""}`}
          onClick={() => { setActiveTab("build"); setDrillActive(false); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "build" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "build" ? 600 : 400 }}
        >
          <Layers size={14}/> Repertoire Tree ({lines.length} moves)
        </button>
        <button
          className={`tab-btn ${activeTab === "drill" ? "active" : ""}`}
          onClick={() => { setActiveTab("drill"); handleStartDrill(); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "drill" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "drill" ? 600 : 400 }}
        >
          <Play size={14}/> Practice &amp; Drill
        </button>
        <button
          className={`tab-btn ${activeTab === "deviations" ? "active" : ""}`}
          onClick={() => { setActiveTab("deviations"); setDrillActive(false); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "deviations" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "deviations" ? 600 : 400 }}
        >
          <Compass size={14}/> Game Deviations ({deviations.length})
        </button>
      </div>

      {/* ── Mode 1: Repertoire Tree Builder ──────────────────────────────── */}
      {activeTab === "build" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 480px) 1fr", gap: "24px" }}>
          {/* Interactive Chessboard */}
          <div>
            <div className="panel" style={{ padding: "16px" }}>
              <BoardView
                game={explorerChess}
                orientation={activeSide}
                onMove={handleExplorerMove}
                interactive={true}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "11px", color: "var(--muted)" }}>
                <span>Playing as: <strong>{activeSide.toUpperCase()}</strong></span>
                <span>Drag pieces on board to explore or add lines</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Repertoire Details & Variations */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Action Bar */}
            <div className="panel" style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>{currentRepertoire?.title}</h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {lines.length} recorded positions · {activeSide === "white" ? "1. e4 / 1. d4 / 1. c4 lines" : "Responses as Black"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="button button-secondary button-small" onClick={() => setImportPgnModal(true)} title="Import PGN into repertoire">
                  <Upload size={13}/> Import PGN
                </button>
                <button className="button button-secondary button-small" onClick={handleExportPgn} title="Export repertoire to PGN">
                  <Download size={13}/> Export PGN
                </button>
              </div>
            </div>

            {/* Current Variation Breadcrumb Navigation */}
            <div className="panel" style={{ padding: "14px" }}>
              <div className="eyebrow" style={{ marginBottom: "8px" }}>ACTIVE LINE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                <button
                  className={`badge ${currentHistory.length === 0 ? "badge-primary" : "badge-secondary"}`}
                  onClick={() => handleJumpToHistory(-1)}
                  style={{ cursor: "pointer" }}
                >
                  Start
                </button>
                {currentHistory.map((m, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight size={12} style={{ color: "var(--muted)" }}/>
                    <button
                      className={`badge ${idx === currentHistory.length - 1 ? "badge-primary" : "badge-secondary"}`}
                      onClick={() => handleJumpToHistory(idx)}
                      style={{ cursor: "pointer", fontWeight: 600 }}
                    >
                      {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ""}{m.san}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Candidate Next Moves in this Position */}
            <div className="panel" style={{ padding: "14px" }}>
              <div className="eyebrow" style={{ marginBottom: "8px" }}>
                {explorerChess.turn() === (activeSide === "white" ? "w" : "b")
                  ? "YOUR REPERTOIRE RESPONSES"
                  : "OPPONENT'S CANDIDATE REPLIES"}
              </div>

              {candidateMoves.length === 0 ? (
                <div style={{ padding: "14px", textAlign: "center", background: "var(--sunken)", borderRadius: "6px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "12px", color: "var(--muted)" }}>
                    No planned moves from this position yet.
                  </p>
                  <span style={{ fontSize: "11px", color: "var(--lime)" }}>
                    Play a move on the board to record it into your repertoire!
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {candidateMoves.map(candidate => (
                    <div
                      key={candidate.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--raised)",
                        borderRadius: "6px",
                        fontSize: "12px"
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", color: "var(--lime)", marginRight: "8px" }}>
                          {candidate.san}
                        </strong>
                        <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                          {candidate.comment || "No notes"}
                        </span>
                      </div>
                      <button
                        className="button button-secondary button-small"
                        onClick={() => {
                          setCurrentHistory(prev => [...prev, { san: candidate.san, uci: candidate.uci, node: candidate }]);
                          setMoveComment(candidate.comment || "");
                        }}
                      >
                        Explore <ArrowRight size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Move Explanation / Comment Editor */}
            {currentParentNode && (
              <div className="panel" style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div className="eyebrow">NOTES FOR {currentParentNode.san}</div>
                  <button
                    className="button button-ghost button-small"
                    onClick={handleDeleteCurrentMove}
                    style={{ color: "var(--red, #f87171)" }}
                    title="Delete this move and all sub-variations"
                  >
                    <Trash2 size={12}/> Delete Line
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={3}
                  value={moveComment}
                  onChange={e => setMoveComment(e.target.value)}
                  placeholder="Explain the plan, ideas, or tactical motifs behind this move..."
                  style={{ width: "100%", fontSize: "12px", marginBottom: "8px" }}
                />
                <button className="button button-primary button-small" onClick={handleSaveComment}>
                  Save Notes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mode 2: Interactive Practice & Drill ────────────────────────── */}
      {activeTab === "drill" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 480px) 1fr", gap: "24px" }}>
          <div>
            <div className="panel" style={{ padding: "16px" }}>
              <BoardView
                game={drillChess}
                orientation={activeSide}
                onMove={handleDrillMove}
                interactive={!drillSession.completed}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="panel" style={{ padding: "18px" }}>
              <div className="eyebrow">ACTIVE RECALL PRACTICE</div>
              <h2 style={{ fontSize: "16px", margin: "4px 0 10px" }}>
                Drill {activeSide === "white" ? "White" : "Black"} Repertoire
              </h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
                Play your prepared repertoire moves on the board. ChessForge responds automatically with candidate opponent moves.
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
                  }`,
                }}
              >
                {drillEval.message || "Ready to drill."}
              </div>

              {/* Drill Score Card */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div className="panel" style={{ padding: "12px", textAlign: "center", background: "var(--sunken)" }}>
                  <div className="eyebrow">MOVES TESTED</div>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>{drillSession.total}</div>
                </div>
                <div className="panel" style={{ padding: "12px", textAlign: "center", background: "var(--sunken)" }}>
                  <div className="eyebrow">ACCURACY</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--lime)" }}>
                    {drillSession.total > 0 ? `${Math.round((drillSession.correct / drillSession.total) * 100)}%` : "—"}
                  </div>
                </div>
              </div>

              <button className="button button-primary" onClick={handleStartDrill}>
                <RotateCcw size={14}/> Restart Drill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode 3: Game Deviations Report ──────────────────────────────── */}
      {activeTab === "deviations" && (
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
      )}

      {/* ── Modal: Import PGN into Repertoire ────────────────────────────── */}
      {importPgnModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "500px" }}>
            <h3 style={{ margin: "0 0 10px" }}>Import Lines into {activeSide.toUpperCase()} Repertoire</h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px" }}>
              Paste a PGN game, study, or line. All moves will be merged into your repertoire tree.
            </p>
            <textarea
              className="input"
              rows={6}
              value={pgnInput}
              onChange={e => setPgnInput(e.target.value)}
              placeholder='1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6...'
              style={{ width: "100%", fontSize: "12px", marginBottom: "14px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="button button-ghost" onClick={() => setImportPgnModal(false)}>
                Cancel
              </button>
              <button className="button button-primary" onClick={handleImportPgn}>
                Import Lines
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
