import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarClock, Trophy, Play, CheckCircle2, AlertTriangle, ArrowRight,
  Flame, Filter, Search, RotateCcw, Brain, ShieldCheck
} from "lucide-react";
import type { TrainingExerciseRecord, ReviewScheduleRecord, ExerciseWithSchedule } from "../lib/training/types";
import { getDueExercises, getTrainingStats } from "../lib/training/training-service";

interface ReviewQueueProps {
  onStartSession: () => void;
  onSelectExercise?: (exercise: ExerciseWithSchedule) => void;
  userId?: string;
}

export function ReviewQueue({
  onStartSession,
  onSelectExercise,
  userId
}: ReviewQueueProps) {
  const [exercises, setExercises] = useState<ExerciseWithSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"due" | "all" | "mastered">("due");
  const [search, setSearch] = useState("");

  const refreshList = useCallback(async () => {
    setLoading(true);
    // Fetch up to 50 items for queue browser
    const due = await getDueExercises(userId, 50);
    setExercises(due);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const stats = useMemo(() => getTrainingStats(userId), [userId, exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      if (tab === "due") {
        if (ex.status !== "active") return false;
        if (!ex.schedule) return true;
        return new Date(ex.schedule.due_at).getTime() <= Date.now() + 60000;
      }
      if (tab === "mastered") {
        return ex.status === "mastered";
      }
      // "all"
      return ex.status === "active";
    });
  }, [exercises, tab]);

  return (
    <div className="content review-content" style={{ maxWidth: "1050px", margin: "0 auto", padding: "20px 24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px"
        }}
      >
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CalendarClock size={13} /> SPACED REPETITION ENGINE
          </div>
          <h1 style={{ margin: "4px 0" }}>Review Queue</h1>
          <p className="subheading">
            Personal exercises extracted from your games, scheduled with adaptive intervals.
          </p>
        </div>

        <button
          className="button button-primary"
          onClick={onStartSession}
          disabled={stats.dueCount === 0}
          style={{ padding: "8px 16px" }}
        >
          <Play size={14} fill="currentColor" /> Start training ({stats.dueCount} due)
        </button>
      </div>

      {/* Metric Cards */}
      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-top">
            <span>DUE TODAY</span>
            <span className={`stat-icon ${stats.dueCount > 0 ? "lime" : ""}`}>
              <CalendarClock size={16} />
            </span>
          </div>
          <div className="stat-value">{stats.dueCount}</div>
          <div className="stat-change">{stats.dueCount > 0 ? "Ready for review" : "All caught up"}</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>ACTIVE POSITIONS</span>
            <span className="stat-icon"><Brain size={16} /></span>
          </div>
          <div className="stat-value">{stats.totalActive}</div>
          <div className="stat-change">In spaced repetition</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>MASTERED</span>
            <span className="stat-icon lime"><Trophy size={16} /></span>
          </div>
          <div className="stat-value">{stats.masteredCount}</div>
          <div className="stat-change">5+ consecutive successes</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>TRAINING STREAK</span>
            <span className="stat-icon"><Flame size={16} /></span>
          </div>
          <div className="stat-value">{stats.streakDays} days</div>
          <div className="stat-change">{stats.streakDays > 0 ? "Keep the habit alive" : "Solve 1 to begin"}</div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "10px",
          marginBottom: "16px"
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          {(["due", "all", "mastered"] as const).map(t => (
            <button
              key={t}
              className={`button button-small ${tab === t ? "button-primary" : "button-secondary"}`}
              onClick={() => setTab(t)}
            >
              {t === "due" ? `Due now (${stats.dueCount})` : t === "all" ? `All active (${stats.totalActive})` : `Mastered (${stats.masteredCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Items */}
      {loading ? (
        <p style={{ color: "var(--muted)", padding: "20px 0" }}>Loading queue…</p>
      ) : filteredExercises.length === 0 ? (
        <div className="empty-activity panel" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div className="empty-icon"><CalendarClock size={24} /></div>
          <strong>{tab === "due" ? "No exercises due for review" : "No positions found"}</strong>
          <p style={{ fontSize: "12px", color: "var(--muted)", maxWidth: "400px", margin: "8px auto" }}>
            {tab === "due"
              ? "When you analyse your games, ChessForge finds your mistakes and schedules them for practice here."
              : "Positions will appear here as you analyse more games."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredExercises.map(ex => {
            const isDue = ex.schedule && new Date(ex.schedule.due_at).getTime() <= Date.now();
            return (
              <div
                key={ex.id}
                className="panel"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  fontSize: "12px"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "9px",
                        fontWeight: 700,
                        fontFamily: "var(--mono)",
                        background:
                          ex.exercise_type === "attack"
                            ? "rgba(183, 227, 106, 0.15)"
                            : ex.exercise_type === "defence"
                            ? "rgba(251, 191, 36, 0.15)"
                            : "rgba(96, 165, 250, 0.15)",
                        color:
                          ex.exercise_type === "attack"
                            ? "var(--lime)"
                            : ex.exercise_type === "defence"
                            ? "#fbbf24"
                            : "#60a5fa"
                      }}
                    >
                      {ex.exercise_type.toUpperCase()}
                    </span>
                    <strong style={{ fontSize: "13px" }}>{ex.prompt}</strong>
                  </div>

                  <div style={{ color: "var(--muted)", fontSize: "11px", display: "flex", gap: "12px" }}>
                    <span>Playing: {ex.user_colour.toUpperCase()}</span>
                    {ex.blunder_move && <span>Played: {ex.blunder_move.san}</span>}
                    {ex.schedule && (
                      <span>
                        Repetitions: {ex.schedule.repetitions} · Interval: {ex.schedule.interval_days}d
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {isDue ? (
                    <span style={{ color: "var(--lime)", fontSize: "11px", fontWeight: 600 }}>Due now</span>
                  ) : ex.schedule ? (
                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                      Due {new Date(ex.schedule.due_at).toLocaleDateString()}
                    </span>
                  ) : null}

                  <button
                    className="button button-secondary button-small"
                    onClick={onStartSession}
                  >
                    Train
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
