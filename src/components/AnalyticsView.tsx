import React, { useState, useEffect, useMemo } from "react";
import { Chess, type Square } from "chess.js";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  ExternalLink,
  Flame,
  HelpCircle,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap
} from "lucide-react";
import {
  getWeaknessAnalysis,
  getLocalMistakes,
  computeWeaknessAnalysis,
  type WeaknessAnalysisReport,
  type TagFrequency
} from "../lib/insight/trend-service";
import type { MistakeTag } from "../lib/insight/mistake-tagger";
import type { MistakeRecord } from "../lib/training/types";
import type { GameRecord } from "../lib/games";
import { BoardView } from "./BoardView";
import { batchAnalyzeGames } from "../lib/engine/fast-batch-analyzer";

interface AnalyticsViewProps {
  userId?: string;
  totalGamesCount: number;
  games: GameRecord[];
  onOpenAnalysis: (game: GameRecord) => void;
  onNavigateToTrain: () => void;
}

const TAG_LABELS: Record<MistakeTag, { label: string; desc: string; color: string; advice: string }> = {
  hanging_piece: {
    label: "Hanging Piece",
    desc: "Undefended pieces or moving into attacked squares.",
    color: "#ef4444",
    advice: "Before making a move, scan all your pieces: ask 'Is my piece defended if attacked?' and check opponent piece rays."
  },
  missed_mate: {
    label: "Missed Mate",
    desc: "Forced checkmate sequence was available but not played.",
    color: "#ec4899",
    advice: "Prioritize forcing moves: checks, captures, and threats (CCT). Always calculate checks to completion."
  },
  missed_fork: {
    label: "Missed Fork",
    desc: "Tactical fork / double attack opportunity missed.",
    color: "#8b5cf6",
    advice: "Look for geometric alignments: two opponent pieces on the same rank, file, or knight-fork hop."
  },
  back_rank_weakness: {
    label: "Back-Rank Weakness",
    desc: "Vulnerability or checkmate threat along the 1st/8th rank.",
    color: "#f59e0b",
    advice: "Create 'luft' (an escape square like h3/g3 or h6/g6) before opening central files for major pieces."
  },
  time_trouble: {
    label: "Time Trouble",
    desc: "Errors committed with under 30 seconds on the clock.",
    color: "#06b6d4",
    advice: "Manage your clock: spend less time on routine opening moves so you have reserve time for critical middlegame transitions."
  },
  missed_tactic: {
    label: "Tactical Blunder",
    desc: "General tactical error or sudden win-probability collapse.",
    color: "#10b981",
    advice: "Verify candidate moves: ask 'What is my opponent's most dangerous reply?' before releasing the piece."
  }
};

export function AnalyticsView({
  userId,
  totalGamesCount,
  games,
  onOpenAnalysis,
  onNavigateToTrain
}: AnalyticsViewProps) {
  const initialCount = Math.max(totalGamesCount, games.length);
  const initialLocal = useMemo(() => computeWeaknessAnalysis(getLocalMistakes(), initialCount), [initialCount]);

  const [report, setReport] = useState<WeaknessAnalysisReport>(initialLocal);
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<MistakeTag | "all">("all");
  const [selectedMistake, setSelectedMistake] = useState<MistakeRecord | null>(
    initialLocal.mistakes.length > 0 ? initialLocal.mistakes[0] : null
  );
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const loadData = () => {
    const count = Math.max(totalGamesCount, games.length);
    const totalMoves = games.reduce((sum, g) => sum + (g.moves_count || 0), 0);
    // Refresh local immediately
    const freshLocal = computeWeaknessAnalysis(getLocalMistakes(), count, totalMoves);
    setReport(freshLocal);
    if (freshLocal.mistakes.length > 0 && !selectedMistake) {
      setSelectedMistake(freshLocal.mistakes[0]);
    }

    // Then background fetch remote if available
    getWeaknessAnalysis(userId, count, totalMoves).then(data => {
      setReport(data);
      if (data.mistakes.length > 0) {
        setSelectedMistake(prev => (prev && data.mistakes.some(m => m.id === prev.id) ? prev : data.mistakes[0]));
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [userId, totalGamesCount]);

  const handleStartBatchScan = async () => {
    if (isBatchScanning || games.length === 0) return;
    setIsBatchScanning(true);
    setBatchProgress({ current: 0, total: games.length });

    try {
      await batchAnalyzeGames(games, userId, (current, total) => {
        setBatchProgress({ current, total });
      });

      // Instantly load the fresh local analysis with real move counts
      const updatedCount = Math.max(totalGamesCount, games.length);
      const totalMoves = games.reduce((sum, g) => sum + (g.moves_count || 0), 0);
      const freshAnalysis = computeWeaknessAnalysis(getLocalMistakes(), updatedCount, totalMoves);
      setReport(freshAnalysis);
      if (freshAnalysis.mistakes.length > 0) {
        setSelectedMistake(freshAnalysis.mistakes[0]);
      }
    } catch (err) {
      console.error("Batch scan error:", err);
    } finally {
      setIsBatchScanning(false);
    }
  };

  // Filter mistakes list
  const filteredMistakes = useMemo(() => {
    if (!report?.mistakes) return [];
    if (selectedTag === "all") return report.mistakes;
    return report.mistakes.filter(m => Array.isArray(m.tags) && m.tags.includes(selectedTag));
  }, [report, selectedTag]);

  // Active preview board state
  const previewGame = useMemo(() => {
    if (!selectedMistake?.fen) return new Chess();
    return new Chess(selectedMistake.fen);
  }, [selectedMistake]);

  if (loading || !report) {
    return (
      <div className="empty-state" style={{ minHeight: "400px", display: "grid", placeContent: "center" }}>
        <div className="spinner" />
        <p style={{ marginTop: "12px", color: "var(--muted)" }}>Analyzing game history and diagnostic patterns...</p>
      </div>
    );
  }

  const maxTagCount = Math.max(1, ...report.tagFrequencies.map(t => t.count));
  const hasMistakes = report.totalMistakes > 0;

  return (
    <div className="analytics-view" style={{ padding: "1.5rem", maxWidth: "1240px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ padding: "8px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "8px" }}>
              <Brain size={22} style={{ color: "var(--lime)" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0 }}>
                Weakness Diagnosis & Missed Move Navigator
              </h1>
              <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "3px 0 0" }}>
                Deep tactical inspection: pinpoint exact blunders, compare your move vs engine recommendations, and train solutions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Batch scan button */}
          {games.length > 0 && (
            <button
              className="button button-primary"
              onClick={handleStartBatchScan}
              disabled={isBatchScanning}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Quickly scan all library games to find tactical mistakes and populate diagnostics"
            >
              <Zap size={15} />
              {isBatchScanning
                ? `Scanning (${batchProgress.current}/${batchProgress.total})...`
                : hasMistakes
                ? "Re-scan Library Games"
                : "Deep Scan Library (Find Misses)"}
            </button>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div className="stat-pill" style={{ padding: "0.4rem 0.8rem", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Library Games</span>
              <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{report.totalGames}</span>
            </div>
            <div className="stat-pill" style={{ padding: "0.4rem 0.8rem", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Detected Blunders</span>
              <span style={{ fontSize: "1.1rem", fontWeight: "700", color: report.totalBlunders > 0 ? "#ef4444" : "var(--lime)" }}>
                {report.totalBlunders}
              </span>
            </div>
            <div className="stat-pill" style={{ padding: "0.4rem 0.8rem", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Rate / 100 Moves</span>
              <span style={{ fontSize: "1.1rem", fontWeight: "700", color: report.blundersPer100Moves > 3 ? "#ef4444" : "var(--lime)" }}>
                {report.blundersPer100Moves}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Zero mistakes banner prompt */}
      {!hasMistakes && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1.25rem",
            borderRadius: "10px",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Sparkles size={22} style={{ color: "var(--lime)" }} />
            </div>
            <div>
              <strong style={{ fontSize: "1rem", display: "block", color: "var(--text)" }}>
                Scan your library to unlock mistake breakdowns
              </strong>
              <p style={{ margin: "3px 0 0", fontSize: "0.825rem", color: "var(--muted)" }}>
                You have {report.totalGames} games in your library. Click "Deep Scan Library" to evaluate all positions, discover your tactical misses, and generate proper move guidelines.
              </p>
            </div>
          </div>
          <button
            className="button button-primary"
            onClick={handleStartBatchScan}
            disabled={isBatchScanning}
            style={{ padding: "8px 18px" }}
          >
            <Zap size={14} /> {isBatchScanning ? `Scanning ${batchProgress.current}/${batchProgress.total}...` : "Run Deep Scan Now"}
          </button>
        </div>
      )}

      {/* Main Diagnostic Workspace Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Left Column: Tactical Blindspots Radar & Filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Card: Tactical Blindspots */}
          <div style={{ background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)", padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: "600", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Crosshair size={18} style={{ color: "#8b5cf6" }} />
                Recurring Tactical Blindspots
              </h2>
              <button
                className={`tag-pill ${selectedTag === "all" ? "active" : ""}`}
                onClick={() => setSelectedTag("all")}
                style={{
                  fontSize: "10px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  border: "1px solid var(--line)",
                  background: selectedTag === "all" ? "var(--lime)" : "transparent",
                  color: selectedTag === "all" ? "#17211a" : "var(--muted)",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                All ({report.totalMistakes})
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {report.tagFrequencies.map(tf => {
                const info = TAG_LABELS[tf.tag] || { label: tf.tag, desc: "", color: "#94a3b8", advice: "" };
                const barWidth = Math.max(3, Math.round((tf.count / maxTagCount) * 100));
                const isSelected = selectedTag === tf.tag;

                return (
                  <div
                    key={tf.tag}
                    onClick={() => setSelectedTag(isSelected ? "all" : tf.tag)}
                    style={{
                      cursor: "pointer",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(255, 255, 255, 0.05)" : "transparent",
                      border: isSelected ? `1px solid ${info.color}` : "1px solid transparent",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                      <span style={{ fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: info.color }} />
                        {info.label}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                        {tf.count} ({tf.percentage}%)
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: "100%",
                          background: info.color,
                          borderRadius: "3px"
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "0.725rem", color: "var(--muted)", marginTop: "4px" }}>
                      {info.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Specific Tactical Remedy Guide */}
          <div style={{ background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)", padding: "1.25rem" }}>
            <h3 style={{ fontSize: "0.925rem", fontWeight: "600", margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Lightbulb size={16} style={{ color: "var(--lime)" }} />
              Targeted Improvement Strategy
            </h3>

            {selectedTag !== "all" && TAG_LABELS[selectedTag] ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: TAG_LABELS[selectedTag].color }} />
                  <strong style={{ fontSize: "0.85rem", color: "var(--text)" }}>{TAG_LABELS[selectedTag].label} Protocol</strong>
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  {TAG_LABELS[selectedTag].advice}
                </p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Select any tactical category above to review specific diagnostic rules and psychological habits to eliminate recurring errors.
              </p>
            )}

            <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Turn these mistakes into exercises:</span>
              <button className="button button-secondary button-small" onClick={onNavigateToTrain}>
                <Play size={12} /> Open Training Desk
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Mistake Inspector & Board Navigator */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {selectedMistake ? (
            <div style={{ background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: selectedMistake.engine_class === "blunder" ? "#ef4444" : "#f59e0b",
                        color: "#fff"
                      }}
                    >
                      {selectedMistake.engine_class.toUpperCase()}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                      Move {Math.ceil(selectedMistake.ply / 2)}: {selectedMistake.played_san}
                    </h3>
                  </div>
                  <span style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "2px", display: "block" }}>
                    Loss: <b>-{selectedMistake.win_pct_loss}%</b> win probability · Tags: {selectedMistake.tags.join(", ") || "tactical"}
                  </span>
                </div>

                {/* Jump to Analysis */}
                {(() => {
                  const targetGame = games.find(g => g.id === selectedMistake.game_id);
                  return targetGame ? (
                    <button
                      className="button button-secondary button-small"
                      onClick={() => onOpenAnalysis(targetGame)}
                      title="Open full game in Analysis workspace"
                    >
                      <ExternalLink size={12} /> View in Game
                    </button>
                  ) : null;
                })()}
              </div>

              {/* Board and Guide Layout */}
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", alignItems: "start" }}>
                {/* 300px Preview Board */}
                <div style={{ width: "300px", height: "300px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--line)" }}>
                  <BoardView
                    game={previewGame}
                    orientation={selectedMistake.ply % 2 === 1 ? "white" : "black"}
                    interactive={false}
                  />
                </div>

                {/* Move Guidance Card */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  {/* What Was Played */}
                  <div style={{ padding: "10px 12px", background: "rgba(239, 68, 68, 0.08)", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "#ef4444", fontWeight: 600 }}>
                      <XCircle size={14} /> PLAYED MOVE (MISTAKE)
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "700", marginTop: "2px" }}>
                      {selectedMistake.played_san} ({selectedMistake.played_uci})
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      Severely damaged your position, conceding {selectedMistake.win_pct_loss}% win probability.
                    </div>
                  </div>

                  {/* Proper Move Recommended */}
                  <div style={{ padding: "10px 12px", background: "rgba(183, 227, 106, 0.08)", borderRadius: "8px", border: "1px solid rgba(183, 227, 106, 0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--lime)", fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> RECOMMENDED PROPER MOVE
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "700", marginTop: "2px", color: "var(--text)" }}>
                      {selectedMistake.best_san || selectedMistake.best_uci || "Best Move"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      Maintains optimal counterplay, tactical safety, and positional control.
                    </div>
                  </div>

                  {/* Why this is tagged */}
                  <div style={{ padding: "10px 12px", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
                    <strong style={{ color: "var(--text)", display: "block", marginBottom: "4px" }}>
                      Diagnostic Rule & Guidance
                    </strong>
                    <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.45 }}>
                      {selectedMistake.tags.includes("hanging_piece")
                        ? "Piece Left En Prise: You moved into an attacked square or left a piece undefended without adequate recapture."
                        : selectedMistake.tags.includes("missed_fork")
                        ? "Tactical Blindspot: The engine move would have attacked 2+ pieces simultaneously."
                        : selectedMistake.tags.includes("back_rank_weakness")
                        ? "Back-Rank Defect: The 1st or 8th rank was left vulnerable to penetration."
                        : selectedMistake.tags.includes("missed_mate")
                        ? "Checkmate Available: A forced mating continuation was missed in calculation."
                        : "Tactical Concession: This move dropped substantial win equity compared to the best engine alternative."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)", padding: "2.5rem", textAlign: "center" }}>
              <Compass size={32} style={{ color: "var(--muted)", margin: "0 auto 10px" }} />
              <h3 style={{ margin: 0 }}>No mistake selected</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                Select an entry from the list below to preview the position and view proper move instructions.
              </p>
            </div>
          )}

          {/* Missed Moves Table */}
          <div style={{ background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)", padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "600", margin: 0 }}>
                Logged Misses ({filteredMistakes.length})
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Click row to inspect on board
              </span>
            </div>

            {filteredMistakes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                No mistakes found matching this category.
              </div>
            ) : (
              <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {filteredMistakes.map(m => {
                  const isSelected = selectedMistake?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMistake(m)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        background: isSelected ? "rgba(183, 227, 106, 0.12)" : "var(--panel2)",
                        border: isSelected ? "1px solid var(--lime)" : "1px solid var(--line)",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: "3px",
                            background: m.engine_class === "blunder" ? "#ef4444" : "#f59e0b",
                            color: "#fff"
                          }}
                        >
                          {m.engine_class.toUpperCase()}
                        </span>
                        <div>
                          <strong style={{ fontSize: "0.85rem" }}>
                            Move {Math.ceil(m.ply / 2)}: {m.played_san}
                          </strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "8px" }}>
                            Better was: <b style={{ color: "var(--text)" }}>{m.best_san || m.best_uci}</b>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {m.tags.slice(0, 2).map(t => (
                            <span
                              key={t}
                              style={{
                                fontSize: "9px",
                                padding: "1px 5px",
                                borderRadius: "3px",
                                background: "rgba(255,255,255,0.06)",
                                color: "var(--muted)"
                              }}
                            >
                              {t.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ef4444" }}>
                          -{m.win_pct_loss}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
