import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import {
  Sparkles, ShieldAlert, Award, ArrowRight, RotateCcw, Lightbulb,
  Flag, CheckCircle2, XCircle, ChevronRight, HelpCircle, Trophy,
  Play, ThumbsUp, Flame, ArrowLeft
} from "lucide-react";
import { BoardView } from "./BoardView";
import type {
  ExerciseWithSchedule,
  ExerciseGrade,
  TrainingExerciseRecord,
  SolutionMove
} from "../lib/training/types";
import {
  getDueExercises,
  recordAttemptAndAdvanceSchedule,
  flagExercise
} from "../lib/training/training-service";
import { inferGrade } from "../lib/training/sm2";

interface TrainingDeskProps {
  onBackToDashboard: () => void;
  onNavigateToQueue: () => void;
  userId?: string;
}

export function TrainingDesk({
  onBackToDashboard,
  onNavigateToQueue,
  userId
}: TrainingDeskProps) {
  const [exercises, setExercises] = useState<ExerciseWithSchedule[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Active exercise solving state
  const [game, setGame] = useState<Chess>(new Chess());
  const [solvingStatus, setSolvingStatus] = useState<"solving" | "correct" | "incorrect" | "revealed">("solving");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [movesTried, setMovesTried] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [selectedGrade, setSelectedGrade] = useState<ExerciseGrade | null>(null);

  // Flag modal
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("Multiple equally good moves");

  // Session summary
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionScore, setSessionScore] = useState<{ total: number; correct: number }>({ total: 0, correct: 0 });

  // Load due exercises
  const loadExercises = useCallback(async () => {
    setLoading(true);
    const due = await getDueExercises(userId, 10);
    setExercises(due);
    setCurrentIndex(0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const currentExercise = exercises[currentIndex] || null;

  // Initialize board whenever currentExercise changes
  useEffect(() => {
    if (currentExercise) {
      try {
        const c = new Chess(currentExercise.fen);
        setGame(c);
      } catch {
        setGame(new Chess());
      }
      setSolvingStatus("solving");
      setFeedback(null);
      setHintsUsed(0);
      setHintText(null);
      setMovesTried([]);
      setStartTime(Date.now());
      setSelectedGrade(null);
    }
  }, [currentExercise]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    if (!currentExercise || solvingStatus === "correct" || solvingStatus === "revealed") return;

    try {
      const tempGame = new Chess(game.fen());
      const move = tempGame.move({ from, to, promotion: promotion || "q" });
      if (!move) return;

      const playedUci = `${from}${to}${promotion || ""}`;
      const playedSan = move.san;
      const newMovesTried = [...movesTried, playedSan];
      setMovesTried(newMovesTried);

      // Check if move matches accepted solutions
      const isCorrectSolution = currentExercise.solutions.some(
        sol => sol.uci === playedUci || sol.san === playedSan
      );

      if (isCorrectSolution) {
        // Correct move!
        setGame(tempGame);
        setSolvingStatus("correct");
        setFeedback("Excellent! You found the best continuation.");

        const durationMs = Date.now() - startTime;
        const autoGrade = inferGrade({
          correct: true,
          hintsUsed,
          durationMs
        });
        setSelectedGrade(autoGrade);

        // Record attempt
        recordAttemptAndAdvanceSchedule(
          currentExercise,
          {
            correct: true,
            durationMs,
            hintsUsed,
            movesTried: newMovesTried,
            grade: autoGrade
          },
          userId
        );

        setSessionScore(prev => ({
          total: prev.total + 1,
          correct: prev.correct + 1
        }));
      } else {
        // Check if user replayed their real-game blunder
        const isGameBlunder =
          currentExercise.blunder_move &&
          (currentExercise.blunder_move.uci === playedUci ||
            currentExercise.blunder_move.san === playedSan);

        setGame(tempGame);
        setSolvingStatus("incorrect");

        if (isGameBlunder) {
          setFeedback(`That's the move you played in your game (${playedSan})! It gave away the advantage. Look for a better move.`);
        } else {
          setFeedback(`Not the best move (${playedSan}). Look for a more active continuation.`);
        }

        // Reset board after brief pause so they can try again
        setTimeout(() => {
          try {
            setGame(new Chess(currentExercise.fen));
            setSolvingStatus("solving");
          } catch { /* ignore */ }
        }, 1200);
      }
    } catch {
      // invalid move
    }
  }, [currentExercise, game, solvingStatus, movesTried, startTime, hintsUsed, userId]);

  function handleHint() {
    if (!currentExercise || currentExercise.solutions.length === 0) return;
    const bestMove = currentExercise.solutions[0];
    const uci = bestMove.uci;
    const fromSquare = uci.slice(0, 2);
    const toSquare = uci.slice(2, 4);

    if (hintsUsed === 0) {
      setHintsUsed(1);
      const piece = game.get(fromSquare as Square);
      const pieceName = piece ? piece.type.toUpperCase() : "piece";
      setHintText(`Hint: Look at your ${pieceName} on ${fromSquare}.`);
    } else {
      setHintsUsed(2);
      setHintText(`Hint: Move ${fromSquare} to ${toSquare} (${bestMove.san}).`);
    }
  }

  function handleRevealSolution() {
    if (!currentExercise || currentExercise.solutions.length === 0) return;
    const bestMove = currentExercise.solutions[0];

    try {
      const tempGame = new Chess(currentExercise.fen);
      tempGame.move(bestMove.san);
      setGame(tempGame);
    } catch { /* ignore */ }

    setSolvingStatus("revealed");
    setFeedback(`Solution: ${bestMove.san}.`);
    setSelectedGrade("Again");

    const durationMs = Date.now() - startTime;
    recordAttemptAndAdvanceSchedule(
      currentExercise,
      {
        correct: false,
        durationMs,
        hintsUsed: 2,
        movesTried: [...movesTried, "gave_up"],
        grade: "Again"
      },
      userId
    );

    setSessionScore(prev => ({
      total: prev.total + 1,
      correct: prev.correct
    }));
  }

  function handleNextExercise(overrideGrade?: ExerciseGrade) {
    if (currentIndex + 1 < exercises.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSessionCompleted(true);
    }
  }

  async function handleFlagExercise() {
    if (!currentExercise) return;
    await flagExercise(currentExercise.id, flagReason, userId);
    setShowFlagModal(false);
    handleNextExercise();
  }

  if (loading) {
    return (
      <div className="content placeholder-page" style={{ padding: "40px" }}>
        <p>Loading your training queue…</p>
      </div>
    );
  }

  // Session complete view
  if (sessionCompleted || exercises.length === 0) {
    return (
      <div className="content placeholder-page">
        <div className="placeholder-hero">
          <div className="placeholder-icon" style={{ background: "rgba(183, 227, 106, 0.15)", color: "var(--lime)" }}>
            <Trophy size={32} />
          </div>
          <div className="eyebrow">SESSION COMPLETE</div>
          <h1>{exercises.length === 0 ? "You're all caught up!" : "Training completed."}</h1>
          <p>
            {exercises.length === 0
              ? "No exercises are due right now. Import more games or review past positions in your library."
              : `You completed ${sessionScore.total} exercises with ${sessionScore.correct} solved correctly.`}
          </p>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button className="button button-primary" onClick={onBackToDashboard}>
              <ArrowLeft size={14} /> Back to dashboard
            </button>
            <button className="button button-secondary" onClick={onNavigateToQueue}>
              View review queue <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const exerciseTypeChip = {
    attack: { label: "ATTACK", bg: "rgba(183, 227, 106, 0.15)", border: "var(--lime)", color: "var(--lime)" },
    defence: { label: "DEFENCE", bg: "rgba(251, 191, 36, 0.15)", border: "#fbbf24", color: "#fbbf24" },
    avoid_blunder: { label: "AVOID THE BLUNDER", bg: "rgba(96, 165, 250, 0.15)", border: "#60a5fa", color: "#60a5fa" }
  }[currentExercise.exercise_type];

  return (
    <div className="content training-content" style={{ maxWidth: "1050px", margin: "0 auto", padding: "20px 24px" }}>
      {/* Top Bar / Progress */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button className="icon-btn" onClick={onBackToDashboard} title="Back to dashboard">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Flame size={13} style={{ color: "var(--lime)" }} /> DAILY TRAINING QUEUE
            </div>
            <h2 style={{ fontSize: "16px", margin: 0 }}>
              Exercise {currentIndex + 1} of {exercises.length}
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: 700,
              fontFamily: "var(--mono)",
              background: exerciseTypeChip.bg,
              border: `1px solid ${exerciseTypeChip.border}`,
              color: exerciseTypeChip.color
            }}
          >
            {exerciseTypeChip.label}
          </span>
          <button
            className="button button-secondary button-small"
            onClick={() => setShowFlagModal(true)}
            title="Flag as bad exercise"
          >
            <Flag size={12} /> Bad exercise
          </button>
        </div>
      </div>

      {/* Main Solving Desk Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
        {/* Left: Interactive Board */}
        <div className="panel" style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "100%", marginBottom: "10px", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ fontWeight: 600 }}>
              {currentExercise.user_colour === "white" ? "White to move" : "Black to move"}
            </span>
            <span style={{ color: "var(--muted)", fontSize: "11px" }}>
              Difficulty: {currentExercise.difficulty}
            </span>
          </div>

          <div style={{ width: "100%", maxWidth: "520px" }}>
            <BoardView
              game={game}
              orientation={currentExercise.user_colour}
              onMove={handleMove}
              interactive={solvingStatus === "solving" || solvingStatus === "incorrect"}
            />
          </div>

          {/* Feedback message banner */}
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

        {/* Right: Controls & Prompts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Prompt card */}
          <div className="panel" style={{ padding: "16px" }}>
            <div className="eyebrow" style={{ marginBottom: "6px" }}>OBJECTIVE</div>
            <p style={{ fontSize: "13px", lineHeight: "1.5", margin: "0 0 12px 0" }}>
              {currentExercise.prompt}
            </p>

            {currentExercise.blunder_move && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "5px",
                  background: "var(--raised)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  border: "1px dashed var(--line)"
                }}
              >
                In the game, you played: <strong>{currentExercise.blunder_move.san}</strong>
              </div>
            )}
          </div>

          {/* Hints & Actions */}
          <div className="panel" style={{ padding: "16px" }}>
            <div className="eyebrow" style={{ marginBottom: "8px" }}>ASSISTANCE</div>

            {hintText && (
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
                {hintText}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="button button-secondary"
                style={{ flex: 1 }}
                onClick={handleHint}
                disabled={hintsUsed >= 2 || solvingStatus === "correct" || solvingStatus === "revealed"}
              >
                <Lightbulb size={13} /> {hintsUsed === 0 ? "Get hint" : "Next hint"}
              </button>
              <button
                className="button button-secondary"
                style={{ flex: 1 }}
                onClick={handleRevealSolution}
                disabled={solvingStatus === "correct" || solvingStatus === "revealed"}
              >
                <RotateCcw size={13} /> Show solution
              </button>
            </div>
          </div>

          {/* SM-2 Result & Next Button */}
          {(solvingStatus === "correct" || solvingStatus === "revealed") && (
            <div className="panel" style={{ padding: "16px" }}>
              <div className="eyebrow" style={{ marginBottom: "6px" }}>SM-2 REVIEW RATING</div>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px 0" }}>
                How easy was this position to calculate?
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px" }}>
                {(["Again", "Hard", "Good", "Easy"] as ExerciseGrade[]).map(grade => (
                  <button
                    key={grade}
                    className={`button ${selectedGrade === grade ? "button-primary" : "button-secondary"}`}
                    style={{ fontSize: "11px", padding: "6px 8px" }}
                    onClick={() => setSelectedGrade(grade)}
                  >
                    {grade}
                  </button>
                ))}
              </div>

              <button
                className="button button-primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => handleNextExercise()}
              >
                Next exercise <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Flag Exercise Modal */}
      {showFlagModal && (
        <div className="modal-backdrop">
          <div className="auth-modal panel" style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <h2>Flag bad exercise</h2>
              <button className="icon-btn" onClick={() => setShowFlagModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "14px" }}>
              Why should this position be removed from your training queue?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {[
                "Multiple equally good moves",
                "Unclear tactical theme",
                "Unrealistic position",
                "Too difficult for current level",
                "Other reason"
              ].map(reason => (
                <label key={reason} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="flagReason"
                    value={reason}
                    checked={flagReason === reason}
                    onChange={() => setFlagReason(reason)}
                  />
                  {reason}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="button button-secondary" onClick={() => setShowFlagModal(false)}>Cancel</button>
              <button className="button button-primary" onClick={handleFlagExercise}>Flag & Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
