import React, { useState, useMemo, useEffect, useRef } from "react";
import { Chess, type Square } from "chess.js";
import {
  Brain,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Timer,
  Target,
  Zap,
  HelpCircle,
  Trophy
} from "lucide-react";
import { BoardView } from "./BoardView";
import {
  CALCULATION_DRILLS,
  getCalculatedFen,
  formatUnseenMoves,
  validateCalculationSolution,
  generateRandomSquare,
  getRandomSquareExcluding,
  checkSquareMatch,
  loadCalculationStats,
  recordCalculationAttempt,
  type CalculationDrill,
  type BlindfoldPieceMode,
  type CalculationStatsMap
} from "../lib/endgames";

type TrainerSubTab = "drills" | "coordinates" | "playground";

export function CalculationTrainer() {
  const [activeTab, setActiveTab] = useState<TrainerSubTab>("drills");
  const [stats, setStats] = useState<CalculationStatsMap>(() => loadCalculationStats());

  return (
    <div className="calculation-trainer" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Sub-navigation bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "#17242d",
          border: "1px solid #2a3a43",
          borderRadius: "8px",
          padding: "10px 16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "#2a3d36",
              color: "var(--lime)",
              display: "grid",
              placeItems: "center"
            }}
          >
            <Brain size={16} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#e8ede7" }}>
              Calculation & Blindfold Memory Lab
            </div>
            <div style={{ fontSize: "10px", color: "var(--muted)" }}>
              Train deep visualization, mental move-stepping, and board coordinate reflexes
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            className={`button button-small ${activeTab === "drills" ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveTab("drills")}
          >
            <Sparkles size={12} />
            Mental Drills
          </button>
          <button
            className={`button button-small ${activeTab === "coordinates" ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveTab("coordinates")}
          >
            <Target size={12} />
            Coordinate Sight
          </button>
          <button
            className={`button button-small ${activeTab === "playground" ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveTab("playground")}
          >
            <EyeOff size={12} />
            Blindfold Playground
          </button>
        </div>
      </div>

      {activeTab === "drills" && (
        <DrillsRoom
          stats={stats}
          onUpdateStats={updated => setStats(updated)}
        />
      )}

      {activeTab === "coordinates" && <CoordinateSightTrainer />}

      {activeTab === "playground" && <BlindfoldPlayground />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. MENTAL DRILLS ROOM                                                      */
/* -------------------------------------------------------------------------- */

interface DrillsRoomProps {
  stats: CalculationStatsMap;
  onUpdateStats: (stats: CalculationStatsMap) => void;
}

function DrillsRoom({ stats, onUpdateStats }: DrillsRoomProps) {
  const [drillIndex, setDrillIndex] = useState(0);
  const [isPeeking, setIsPeeking] = useState(false);
  const [blindfoldMode, setBlindfoldMode] = useState<BlindfoldPieceMode>("normal");
  const [userMoveInput, setUserMoveInput] = useState("");
  const [result, setResult] = useState<{
    submitted: boolean;
    correct: boolean;
    message: string;
    showSolution: boolean;
  }>({
    submitted: false,
    correct: false,
    message: "",
    showSolution: false
  });

  const currentDrill = CALCULATION_DRILLS[drillIndex];

  // Calculated target position
  const targetData = useMemo(() => {
    return getCalculatedFen(currentDrill.initialFen, currentDrill.unseenMoves);
  }, [currentDrill]);

  // Visual board state
  const displayedGame = useMemo(() => {
    if (isPeeking || result.correct || result.showSolution) {
      return new Chess(targetData.fen);
    }
    return new Chess(currentDrill.initialFen);
  }, [currentDrill, isPeeking, targetData, result]);

  const formattedMoves = useMemo(() => {
    return formatUnseenMoves(currentDrill.initialFen, currentDrill.unseenMoves);
  }, [currentDrill]);

  // Reset attempt state when switching drills
  useEffect(() => {
    setIsPeeking(false);
    setUserMoveInput("");
    setResult({
      submitted: false,
      correct: false,
      message: "",
      showSolution: false
    });
  }, [drillIndex]);

  const handleSubmit = (overrideMove?: string) => {
    const move = (overrideMove !== undefined ? overrideMove : userMoveInput).trim();
    if (!move) return;

    const validation = validateCalculationSolution(currentDrill, move);
    if (validation.correct) {
      const updated = recordCalculationAttempt(currentDrill.id, true);
      onUpdateStats(updated);
      setResult({
        submitted: true,
        correct: true,
        message: `Excellent! ${currentDrill.solutionMove} is the correct solution.`,
        showSolution: true
      });
    } else {
      const updated = recordCalculationAttempt(currentDrill.id, false);
      onUpdateStats(updated);
      setResult({
        submitted: true,
        correct: false,
        message: `Not quite. "${move}" is not the optimal move from the visualized position. Try again or reveal the solution.`,
        showSolution: false
      });
    }
  };

  const handleBoardMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    // If user interacts with board, submit the move
    const promo = promotion ? promotion : "";
    const uci = `${from}${to}${promo}`;
    handleSubmit(uci);
  };

  const isSolved = stats[currentDrill.id]?.solved;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)",
        gap: "1.5rem",
        alignItems: "start"
      }}
    >
      {/* LEFT: Chess Board */}
      <div
        style={{
          background: "#17242d",
          border: "1px solid #2a3a43",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          alignItems: "center"
        }}
      >
        <div style={{ width: "100%", maxWidth: "460px", aspectRatio: "1 / 1" }}>
          <BoardView
            game={displayedGame}
            orientation={currentDrill.sideToMove}
            interactive={true}
            onMove={handleBoardMove}
            blindfoldMode={blindfoldMode}
          />
        </div>

        {/* Board Controls Toolbar */}
        <div
          style={{
            width: "100%",
            maxWidth: "460px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "6px",
            borderTop: "1px solid #2a3a43"
          }}
        >
          {/* Peek button */}
          <button
            className={`button button-small ${isPeeking ? "button-primary" : "button-secondary"}`}
            onMouseDown={() => setIsPeeking(true)}
            onMouseUp={() => setIsPeeking(false)}
            onMouseLeave={() => setIsPeeking(false)}
            title="Hold down to temporarily peek at the board position after unseen moves"
          >
            <Eye size={13} />
            {isPeeking ? "Showing Target..." : "Hold to Peek Target"}
          </button>

          {/* Blindfold Mode Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--muted)" }}>Pieces:</span>
            {(["normal", "ghost", "blind"] as BlindfoldPieceMode[]).map(mode => (
              <button
                key={mode}
                className={`button button-small ${blindfoldMode === mode ? "button-primary" : "button-secondary"}`}
                style={{ padding: "0 8px", textTransform: "capitalize", fontSize: "9px" }}
                onClick={() => setBlindfoldMode(mode)}
              >
                {mode === "blind" ? <EyeOff size={11} /> : mode === "ghost" ? <Eye size={11} /> : null}
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Drill Details & Calculation Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Navigation & Header */}
        <div
          style={{
            background: "#17242d",
            border: "1px solid #2a3a43",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#22333c",
                  color: "var(--lime)",
                  fontFamily: "var(--mono)"
                }}
              >
                Drill {drillIndex + 1} of {CALCULATION_DRILLS.length}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: isSolved ? "#1f382a" : "#2a3a43",
                  color: isSolved ? "#86efac" : "var(--muted)"
                }}
              >
                {isSolved ? "✓ Mastered" : "Unsolved"}
              </span>
            </div>

            {/* Prev / Next controls */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className="button button-secondary button-small"
                disabled={drillIndex === 0}
                onClick={() => setDrillIndex(drillIndex - 1)}
                title="Previous drill"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                className="button button-secondary button-small"
                disabled={drillIndex === CALCULATION_DRILLS.length - 1}
                onClick={() => setDrillIndex(drillIndex + 1)}
                title="Next drill"
              >
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#e8ede7", margin: "0 0 4px 0" }}>
              {currentDrill.title}
            </h2>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Theme: <span style={{ color: "var(--soft)" }}>{currentDrill.tacticalTheme}</span>
            </div>
          </div>
        </div>

        {/* Calculation Stepping Challenge Card */}
        <div
          style={{
            background: "#17242d",
            border: "1px solid #2a3a43",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--lime)", fontSize: "11px", fontWeight: 600 }}>
            <Zap size={14} />
            Step Ahead: Visualize These Unseen Moves
          </div>

          {/* Formatted move pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {formattedMoves.map((moveStr, idx) => (
              <span
                key={idx}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "12px",
                  background: "#101820",
                  border: "1px solid #2e414c",
                  padding: "4px 10px",
                  borderRadius: "5px",
                  color: "#dce5df"
                }}
              >
                {moveStr}
              </span>
            ))}
          </div>

          <div
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              color: "#cbd5e1",
              background: "#121d24",
              border: "1px solid #22323a",
              padding: "10px 14px",
              borderRadius: "6px"
            }}
          >
            {currentDrill.prompt}
          </div>

          {/* Input & Action */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="e.g. Kf4 or play on board"
              value={userMoveInput}
              onChange={e => setUserMoveInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{
                flex: 1,
                height: "34px",
                background: "#101820",
                border: "1px solid #2e414c",
                borderRadius: "6px",
                padding: "0 12px",
                color: "#e8ede7",
                fontSize: "12px",
                fontFamily: "var(--mono)"
              }}
            />
            <button
              className="button button-primary"
              onClick={() => handleSubmit()}
              disabled={!userMoveInput.trim()}
            >
              Verify Move
            </button>
            <button
              className="button button-secondary button-small"
              onClick={() => {
                setResult({
                  submitted: true,
                  correct: false,
                  message: `Solution: ${currentDrill.solutionMove}. ${currentDrill.explanation}`,
                  showSolution: true
                });
              }}
              title="Reveal answer and explanation"
            >
              <HelpCircle size={13} />
              Reveal
            </button>
          </div>

          {/* Feedback banner */}
          {result.submitted && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "6px",
                background: result.correct ? "#152e22" : "#321e1e",
                border: `1px solid ${result.correct ? "#22c55e44" : "#ef444444"}`,
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                {result.correct ? (
                  <CheckCircle2 size={16} color="#4ade80" />
                ) : (
                  <AlertCircle size={16} color="#f87171" />
                )}
                <strong style={{ fontSize: "12px", color: result.correct ? "#86efac" : "#fca5a5" }}>
                  {result.correct ? "Solved Correctly!" : "Needs Recalculation"}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#e2e8f0", lineHeight: 1.5 }}>
                {result.message}
              </p>
              {result.showSolution && !result.correct && (
                <div style={{ fontSize: "11px", color: "var(--soft)", marginTop: "4px" }}>
                  <strong>Key Idea: </strong>
                  {currentDrill.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. COORDINATE SIGHT REFLEX TRAINER                                         */
/* -------------------------------------------------------------------------- */

const COORD_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const COORD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function CoordinateSightTrainer() {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targetSquare, setTargetSquare] = useState<string>("e4");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem("chessforge:best-coord-score") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [lastFeedback, setLastFeedback] = useState<"correct" | "wrong" | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSession = () => {
    setScore(0);
    setStreak(0);
    setTimeLeft(30);
    setTargetSquare(generateRandomSquare());
    setIsRunning(true);
    setLastFeedback(null);
  };

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Update best score
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem("chessforge:best-coord-score", String(score));
      } catch {
        // ignore
      }
    }
  }, [score, bestScore]);

  const handleSquareClick = (square: string) => {
    if (!isRunning) return;

    if (checkSquareMatch(square, targetSquare)) {
      setScore(s => s + 1);
      setStreak(st => st + 1);
      setLastFeedback("correct");
      setTargetSquare(getRandomSquareExcluding([square]));
    } else {
      setStreak(0);
      setLastFeedback("wrong");
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 480px) minmax(0, 1fr)",
        gap: "1.5rem",
        alignItems: "start"
      }}
    >
      {/* Interactive 8x8 Board Grid */}
      <div
        style={{
          background: "#17242d",
          border: "1px solid #2a3a43",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            aspectRatio: "1 / 1",
            display: "grid",
            gridTemplateRows: "repeat(8, 1fr)",
            border: "2px solid #2d3e48",
            borderRadius: "4px",
            overflow: "hidden"
          }}
        >
          {COORD_RANKS.map((r, rIdx) => (
            <div key={r} style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)" }}>
              {COORD_FILES.map((f, fIdx) => {
                const sq = `${f}${r}`;
                const isLight = (rIdx + fIdx) % 2 === 0;
                return (
                  <button
                    key={sq}
                    onClick={() => handleSquareClick(sq)}
                    style={{
                      background: isLight ? "#d8dac5" : "#829a8b",
                      border: "none",
                      padding: 0,
                      cursor: isRunning ? "pointer" : "default",
                      position: "relative",
                      outline: "none"
                    }}
                    title={sq}
                  >
                    {/* Rank label on a-file */}
                    {f === "a" && (
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: "3px",
                          fontSize: "9px",
                          fontFamily: "var(--mono)",
                          color: isLight ? "#829a8b" : "#d8dac5",
                          fontWeight: 700
                        }}
                      >
                        {r}
                      </span>
                    )}
                    {/* File label on 1st rank */}
                    {r === "1" && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: "2px",
                          right: "3px",
                          fontSize: "9px",
                          fontFamily: "var(--mono)",
                          color: isLight ? "#829a8b" : "#d8dac5",
                          fontWeight: 700
                        }}
                      >
                        {f}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Challenge Metrics & Controller */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{
            background: "#17242d",
            border: "1px solid #2a3a43",
            borderRadius: "8px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--lime)", fontSize: "11px", fontWeight: 700 }}>
              <Timer size={14} />
              30-Second Rapid Sight Challenge
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--copper)", fontSize: "11px" }}>
              <Trophy size={14} />
              Best: <strong>{bestScore}</strong>
            </div>
          </div>

          {/* Large Target Square Display */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#101820",
              border: "1px solid #2b3b44",
              borderRadius: "8px",
              padding: "24px 16px"
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>
              {isRunning ? "CLICK SQUARE:" : "READY FOR SPRINT?"}
            </div>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 800,
                fontFamily: "var(--display)",
                color: isRunning ? "var(--lime)" : "#64748b",
                letterSpacing: "1px"
              }}
            >
              {isRunning ? targetSquare.toUpperCase() : "--"}
            </div>
          </div>

          {/* Real-time stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div style={{ background: "#131f26", border: "1px solid #23343d", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--muted)" }}>Time</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: timeLeft <= 5 && isRunning ? "#ef4444" : "#e8ede7" }}>
                {timeLeft}s
              </div>
            </div>
            <div style={{ background: "#131f26", border: "1px solid #23343d", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--muted)" }}>Score</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--lime)" }}>
                {score}
              </div>
            </div>
            <div style={{ background: "#131f26", border: "1px solid #23343d", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--muted)" }}>Streak</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8" }}>
                {streak}
              </div>
            </div>
          </div>

          {/* Start / Reset Button */}
          <button
            className={`button ${isRunning ? "button-secondary" : "button-primary"}`}
            style={{ width: "100%", height: "38px", fontSize: "12px" }}
            onClick={startSession}
          >
            {isRunning ? "Restart Challenge" : "Start 30s Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. BLINDFOLD PLAYGROUND                                                    */
/* -------------------------------------------------------------------------- */

function BlindfoldPlayground() {
  const [game, setGame] = useState(() => new Chess());
  const [blindfoldMode, setBlindfoldMode] = useState<BlindfoldPieceMode>("blind");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const handleMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    try {
      const nextGame = new Chess(game.fen());
      const res = nextGame.move({ from, to, promotion: promotion || "q" });
      if (res) {
        setGame(nextGame);
        setMoveHistory(prev => [...prev, res.san]);
      }
    } catch {
      // Illegal move
    }
  };

  const handleReset = () => {
    setGame(new Chess());
    setMoveHistory([]);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 480px) minmax(0, 1fr)",
        gap: "1.5rem",
        alignItems: "start"
      }}
    >
      <div
        style={{
          background: "#17242d",
          border: "1px solid #2a3a43",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          alignItems: "center"
        }}
      >
        <div style={{ width: "100%", maxWidth: "420px", aspectRatio: "1 / 1" }}>
          <BoardView
            game={game}
            interactive={true}
            onMove={handleMove}
            blindfoldMode={blindfoldMode}
          />
        </div>

        {/* Toolbar */}
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "6px",
            borderTop: "1px solid #2a3a43"
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            {(["normal", "ghost", "blind"] as BlindfoldPieceMode[]).map(mode => (
              <button
                key={mode}
                className={`button button-small ${blindfoldMode === mode ? "button-primary" : "button-secondary"}`}
                style={{ textTransform: "capitalize", fontSize: "9px" }}
                onClick={() => setBlindfoldMode(mode)}
              >
                {mode === "blind" ? <EyeOff size={11} /> : mode === "ghost" ? <Eye size={11} /> : null}
                {mode}
              </button>
            ))}
          </div>

          <button className="button button-secondary button-small" onClick={handleReset}>
            <RotateCcw size={12} />
            Reset Board
          </button>
        </div>
      </div>

      {/* History and Instructions */}
      <div
        style={{
          background: "#17242d",
          border: "1px solid #2a3a43",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#e8ede7" }}>
          Blindfold Free Play
        </div>
        <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
          Play moves freely on the board with invisible pieces to test your spatial memory. Switch to "Ghost" mode if you need faint visual cues, or "Normal" to verify the exact state.
        </p>

        <div style={{ borderTop: "1px solid #2a3a43", paddingTop: "10px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--soft)", marginBottom: "6px" }}>
            Move History ({moveHistory.length} plies)
          </div>
          <div
            style={{
              maxHeight: "180px",
              overflowY: "auto",
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              background: "#101820",
              border: "1px solid #23343d",
              borderRadius: "6px",
              padding: "8px"
            }}
          >
            {moveHistory.length === 0 ? (
              <span style={{ fontSize: "10px", color: "#64748b" }}>No moves played yet</span>
            ) : (
              moveHistory.map((m, idx) => (
                <span
                  key={idx}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "#94a3b8",
                    padding: "2px 6px",
                    background: "#182731",
                    borderRadius: "3px"
                  }}
                >
                  {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ""}
                  {m}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
