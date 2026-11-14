import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chess, type Square } from "chess.js";
import { BoardView } from "./BoardView";
import {
  getOrFetchPuzzles,
  type LichessPuzzle,
  FALLBACK_PUZZLES
} from "../lib/training/lichess-puzzles";
import {
  ArrowLeft,
  Lightbulb,
  RotateCcw,
  ChevronRight,
  Star,
  CheckCircle2,
  XCircle,
  Sparkles,
  Shuffle,
  RefreshCw
} from "lucide-react";

interface PuzzleTrainerProps {
  onBack?: () => void;
}

export function PuzzleTrainer({ onBack }: PuzzleTrainerProps) {
  const [puzzles, setPuzzles] = useState<LichessPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Solving state
  const [game, setGame] = useState<Chess>(new Chess());
  const [solvingStatus, setSolvingStatus] = useState<"solving" | "correct" | "incorrect" | "revealed">("solving");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [solutionIndex, setSolutionIndex] = useState(1); // 0 is opponent setup move, 1 is user's first move
  const [hintActive, setHintActive] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);

  const replyTimer = useRef<number | undefined>(undefined);

  // Load puzzles on mount
  const loadPuzzles = useCallback(async () => {
    setLoading(true);
    const list = await getOrFetchPuzzles();
    setPuzzles(list.length > 0 ? list : FALLBACK_PUZZLES);
    setCurrentIndex(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPuzzles();
    return () => window.clearTimeout(replyTimer.current);
  }, [loadPuzzles]);

  const currentPuzzle = puzzles[currentIndex] || null;

  // Initialize current puzzle
  useEffect(() => {
    if (!currentPuzzle) return;
    window.clearTimeout(replyTimer.current);

    try {
      const c = new Chess(currentPuzzle.initialFen);
      setGame(c);
      setSolutionIndex(0); // user starts from solution[0]
      setSolvingStatus("solving");
      setFeedback(null);
      setHintActive(false);
    } catch {
      setGame(new Chess());
    }
  }, [currentPuzzle]);

  // Determine user orientation based on turn to move
  const orientation = game.turn() === "w" ? "white" : "black";

  const handleMove = useCallback((from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    if (!currentPuzzle || solvingStatus !== "solving") return;

    const playedUci = `${from}${to}${promotion || ""}`;
    const expectedUci = currentPuzzle.solution[solutionIndex];

    try {
      const tempGame = new Chess(game.fen());
      const move = tempGame.move({ from, to, promotion: promotion || "q" });
      if (!move) return;

      if (playedUci === expectedUci || (expectedUci && playedUci.startsWith(expectedUci))) {
        // Correct move!
        setGame(tempGame);
        setHintActive(false);

        const nextOpponentIndex = solutionIndex + 1;
        if (nextOpponentIndex >= currentPuzzle.solution.length) {
          // Solved the puzzle completely!
          setSolvingStatus("correct");
          setFeedback("Splendid! You solved the puzzle!");
          setSolvedCount(prev => prev + 1);
        } else {
          // Play opponent's response after a brief delay
          setFeedback("Good move! Playing opponent response...");
          replyTimer.current = window.setTimeout(() => {
            try {
              const oppUci = currentPuzzle.solution[nextOpponentIndex];
              const oFrom = oppUci.slice(0, 2) as Square;
              const oTo = oppUci.slice(2, 4) as Square;
              const oPromo = oppUci.length > 4 ? (oppUci[4] as "q" | "r" | "b" | "n") : undefined;
              tempGame.move({ from: oFrom, to: oTo, promotion: oPromo || "q" });
              setGame(new Chess(tempGame.fen()));
              const nextUserIndex = nextOpponentIndex + 1;
              if (nextUserIndex >= currentPuzzle.solution.length) {
                setSolvingStatus("correct");
                setFeedback("Splendid! You solved the puzzle!");
                setSolvedCount(prev => prev + 1);
              } else {
                setSolutionIndex(nextUserIndex);
                setFeedback(null);
              }
            } catch {
              // fallback
            }
          }, 450);
        }
      } else {
        // Wrong move
        setSolvingStatus("incorrect");
        setFeedback("Not the best move. Try again!");
        // Revert board after brief pause
        replyTimer.current = window.setTimeout(() => {
          setSolvingStatus("solving");
          setFeedback(null);
        }, 1200);
      }
    } catch {
      // invalid move
    }
  }, [currentPuzzle, game, solvingStatus, solutionIndex]);

  function handleHint() {
    if (!currentPuzzle || solvingStatus !== "solving") return;
    const expectedUci = currentPuzzle.solution[solutionIndex];
    if (expectedUci) {
      setHintActive(true);
    }
  }

  function handleReveal() {
    if (!currentPuzzle) return;
    setSolvingStatus("revealed");
    setFeedback("Solution revealed.");
  }

  function handleNext() {
    if (currentIndex + 1 < puzzles.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      loadPuzzles();
    }
  }

  if (loading) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
        <RefreshCw size={24} className="spin" style={{ margin: "0 auto 12px", color: "var(--lime)" }} />
        <p style={{ color: "var(--muted)" }}>Loading open-source Lichess tactical puzzles...</p>
      </div>
    );
  }

  if (!currentPuzzle) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
        <p>No puzzles available right now.</p>
        <button className="button button-primary" onClick={loadPuzzles} style={{ marginTop: "12px" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onBack && (
            <button className="icon-btn" onClick={onBack} title="Back">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={13} style={{ color: "var(--lime)" }} /> OPEN-SOURCE TACTICAL DRILLS (LICHESS)
            </div>
            <h2 style={{ fontSize: "16px", margin: 0 }}>
              Puzzle {currentIndex + 1} of {puzzles.length}
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "var(--mono)",
              background: "rgba(234, 179, 8, 0.15)",
              border: "1px solid #eab308",
              color: "#eab308"
            }}
          >
            <Star size={12} /> Rating {currentPuzzle.rating}
          </span>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              color: "var(--soft)"
            }}
          >
            Solved: {solvedCount}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
        {/* Left: Board */}
        <div className="panel" style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "100%", marginBottom: "10px", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ fontWeight: 600 }}>
              {orientation === "white" ? "White to move" : "Black to move"}
            </span>
            <span style={{ color: "var(--muted)", fontSize: "11px" }}>
              Find the best tactical sequence
            </span>
          </div>

          <div style={{ width: "100%", maxWidth: "520px" }}>
            <BoardView
              game={game}
              orientation={orientation}
              onMove={handleMove}
              interactive={solvingStatus === "solving"}
            />
          </div>

          {feedback && (
            <div
              style={{
                marginTop: "14px",
                width: "100%",
                maxWidth: "520px",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background:
                  solvingStatus === "correct"
                    ? "rgba(183, 227, 106, 0.15)"
                    : solvingStatus === "incorrect"
                    ? "rgba(255, 82, 82, 0.15)"
                    : "var(--raised)",
                border: `1px solid ${
                  solvingStatus === "correct"
                    ? "var(--lime)"
                    : solvingStatus === "incorrect"
                    ? "#ff5252"
                    : "var(--line)"
                }`,
                color:
                  solvingStatus === "correct"
                    ? "var(--lime)"
                    : solvingStatus === "incorrect"
                    ? "#ff8a80"
                    : "var(--fg)"
              }}
            >
              {solvingStatus === "correct" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{feedback}</span>
            </div>
          )}
        </div>

        {/* Right: Controls & Themes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Themes Panel */}
          <div className="panel" style={{ padding: "16px" }}>
            <div className="eyebrow" style={{ marginBottom: "8px" }}>TACTICAL THEMES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {currentPuzzle.themes.length > 0 ? (
                currentPuzzle.themes.map(t => (
                  <span
                    key={t}
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      background: "var(--panel2)",
                      border: "1px solid var(--line)",
                      color: "var(--lime)"
                    }}
                  >
                    #{t}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Tactics & Endgame</span>
              )}
            </div>
          </div>

          {/* Assistance & Controls */}
          <div className="panel" style={{ padding: "16px" }}>
            <div className="eyebrow" style={{ marginBottom: "8px" }}>ASSISTANCE</div>

            {hintActive && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "5px",
                  background: "rgba(251, 191, 36, 0.12)",
                  border: "1px solid rgba(251, 191, 36, 0.3)",
                  color: "#fbbf24",
                  fontSize: "11px",
                  marginBottom: "12px"
                }}
              >
                Hint: Target square involves {currentPuzzle.solution[solutionIndex]?.slice(0, 2)}.
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                className="button button-secondary"
                style={{ flex: 1 }}
                onClick={handleHint}
                disabled={solvingStatus !== "solving" || hintActive}
              >
                <Lightbulb size={13} /> Hint
              </button>
              <button
                className="button button-secondary"
                style={{ flex: 1 }}
                onClick={handleReveal}
                disabled={solvingStatus === "correct" || solvingStatus === "revealed"}
              >
                <RotateCcw size={13} /> Reveal
              </button>
            </div>

            <button
              className="button button-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleNext}
            >
              {solvingStatus === "correct" ? "Next Puzzle" : "Skip to Next"} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
