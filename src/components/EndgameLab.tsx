import { useState, useMemo, useRef, useEffect } from "react";
import { Chess, type Square } from "chess.js";
import {
  Crown,
  ArrowLeft,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Trophy,
  Search,
  Filter,
  Check
} from "lucide-react";
import { BoardView } from "./BoardView";
import {
  ENDGAME_CURRICULUM,
  startEndgamePractice,
  attemptEndgameMove,
  advanceOpponentMove,
  chessAtEndgamePly,
  loadEndgameProgress,
  recordEndgameRun,
  expectedSan,
  isUserTurn,
  isCleanRun,
  type EndgamePosition,
  type EndgameCategory,
  type EndgameDifficulty,
  type EndgameProgressMap
} from "../lib/endgames";

interface EndgameLabProps {
  onBackToDashboard?: () => void;
}

const CATEGORY_LABELS: Record<EndgameCategory, string> = {
  pawn: "King & Pawn",
  rook: "Rook Endgames",
  minor: "Minor Pieces",
  queen: "Queen Endgames",
  checkmate: "Basic Checkmates"
};

const DIFFICULTY_COLORS: Record<EndgameDifficulty, string> = {
  beginner: "#22c55e",
  intermediate: "#eab308",
  advanced: "#a855f7",
  master: "#ef4444"
};

export function EndgameLab({ onBackToDashboard }: EndgameLabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<EndgameCategory | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<EndgameDifficulty | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [progress, setProgress] = useState<EndgameProgressMap>(() => loadEndgameProgress());

  const activePosition = useMemo(
    () => ENDGAME_CURRICULUM.find(p => p.id === selectedId) ?? null,
    [selectedId]
  );

  // Filtered curriculum list
  const filteredPositions = useMemo(() => {
    return ENDGAME_CURRICULUM.filter(pos => {
      if (categoryFilter !== "all" && pos.category !== categoryFilter) return false;
      if (difficultyFilter !== "all" && pos.difficulty !== difficultyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          pos.title.toLowerCase().includes(q) ||
          pos.keyConcept.toLowerCase().includes(q) ||
          pos.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoryFilter, difficultyFilter, searchQuery]);

  // Summary metrics
  const totalCount = ENDGAME_CURRICULUM.length;
  const masteredCount = Object.values(progress).filter(p => p.cleared).length;
  const inProgressCount = Object.values(progress).filter(p => !p.cleared && p.attempts > 0).length;

  return (
    <div className="content endgame-lab-page" style={{ maxWidth: "1240px", margin: "0 auto", padding: "1.5rem" }}>
      {activePosition ? (
        <EndgameDrillRoom
          position={activePosition}
          progress={progress}
          onBack={() => setSelectedId(null)}
          onRecordSuccess={clean => {
            const updated = recordEndgameRun(progress, activePosition.id, clean);
            setProgress(updated);
          }}
          onSelectNext={() => {
            const currentIndex = ENDGAME_CURRICULUM.findIndex(p => p.id === activePosition.id);
            const next = ENDGAME_CURRICULUM[(currentIndex + 1) % ENDGAME_CURRICULUM.length];
            setSelectedId(next.id);
          }}
        />
      ) : (
        <CurriculumBrowser
          positions={filteredPositions}
          progress={progress}
          totalCount={totalCount}
          masteredCount={masteredCount}
          inProgressCount={inProgressCount}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          difficultyFilter={difficultyFilter}
          setDifficultyFilter={setDifficultyFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectPosition={id => setSelectedId(id)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. CURRICULUM BROWSER                                                      */
/* -------------------------------------------------------------------------- */

interface BrowserProps {
  positions: EndgamePosition[];
  progress: EndgameProgressMap;
  totalCount: number;
  masteredCount: number;
  inProgressCount: number;
  categoryFilter: EndgameCategory | "all";
  setCategoryFilter: (c: EndgameCategory | "all") => void;
  difficultyFilter: EndgameDifficulty | "all";
  setDifficultyFilter: (d: EndgameDifficulty | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectPosition: (id: string) => void;
}

function CurriculumBrowser({
  positions,
  progress,
  totalCount,
  masteredCount,
  inProgressCount,
  categoryFilter,
  setCategoryFilter,
  difficultyFilter,
  setDifficultyFilter,
  searchQuery,
  setSearchQuery,
  onSelectPosition
}: BrowserProps) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px", background: "rgba(183, 227, 106, 0.15)", borderRadius: "8px" }}>
              <Crown size={22} style={{ color: "var(--lime)" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                Endgame Lab & Technical Mastery
              </h1>
              <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "3px 0 0" }}>
                Master theoretical pawn endgames, Lucena bridge building, Philidor cutting, and piece coordination.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Pills */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div className="stat-pill" style={{ padding: "0.4rem 0.8rem", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Total Drills</span>
            <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{totalCount}</span>
          </div>
          <div className="stat-pill" style={{ padding: "0.4rem 0.8rem", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Mastered</span>
            <span style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--lime)" }}>{masteredCount}</span>
          </div>
          <div className="stat-pill" style={{ padding: "0.4rem 0.8rem", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>In Progress</span>
            <span style={{ fontSize: "1.1rem", fontWeight: "700", color: "#eab308" }}>{inProgressCount}</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {/* Category Pills */}
        <div style={{ display: "flex", gap: "4px", background: "var(--sunken, #101b22)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)", flexWrap: "wrap" }}>
          <button
            className={`button button-small ${categoryFilter === "all" ? "button-primary" : "button-secondary"}`}
            style={{ fontSize: "11px", padding: "4px 9px" }}
            onClick={() => setCategoryFilter("all")}
          >
            All Categories
          </button>
          {(Object.keys(CATEGORY_LABELS) as EndgameCategory[]).map(cat => (
            <button
              key={cat}
              className={`button button-small ${categoryFilter === cat ? "button-primary" : "button-secondary"}`}
              style={{ fontSize: "11px", padding: "4px 9px" }}
              onClick={() => setCategoryFilter(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Difficulty Selector */}
        <select
          value={difficultyFilter}
          onChange={e => setDifficultyFilter(e.target.value as EndgameDifficulty | "all")}
          style={{
            background: "var(--panel2)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            outline: "none"
          }}
        >
          <option value="all">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="text"
            placeholder="Search endgame by title, concept..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px 6px 30px",
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              color: "var(--text)",
              fontSize: "12px",
              outline: "none"
            }}
          />
        </div>
      </div>

      {/* Grid of Positions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
        {positions.map(pos => {
          const prog = progress[pos.id];
          const isMastered = prog?.cleared;
          const diffColor = DIFFICULTY_COLORS[pos.difficulty];

          return (
            <div
              key={pos.id}
              onClick={() => onSelectPosition(pos.id)}
              style={{
                background: "var(--panel)",
                border: isMastered ? "1px solid var(--lime)" : "1px solid var(--line)",
                borderRadius: "10px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              className="endgame-card"
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: `${diffColor}1a`,
                        color: diffColor,
                        border: `1px solid ${diffColor}40`
                      }}
                    >
                      {pos.difficulty}
                    </span>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: pos.objective === "win" ? "rgba(34, 197, 94, 0.12)" : "rgba(59, 130, 246, 0.12)",
                        color: pos.objective === "win" ? "#4ade80" : "#60a5fa",
                        border: pos.objective === "win" ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(59, 130, 246, 0.3)"
                      }}
                    >
                      {pos.objective === "win" ? "🏆 Win" : "🛡️ Draw"}
                    </span>
                  </div>

                  <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "capitalize" }}>
                    {pos.sideToMove} to move
                  </span>
                </div>

                <strong style={{ fontSize: "1rem", color: "var(--text)", display: "block" }}>
                  {pos.title}
                </strong>
                <span style={{ fontSize: "11px", color: "var(--lime)", display: "block", marginTop: "2px" }}>
                  {pos.keyConcept}
                </span>

                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.45 }}>
                  {pos.description}
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
                {isMastered ? (
                  <span style={{ fontSize: "11px", color: "var(--lime)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={13} /> Mastered
                  </span>
                ) : prog && prog.attempts > 0 ? (
                  <span style={{ fontSize: "11px", color: "#eab308" }}>
                    Learning ({prog.cleanStreak}/2 clean runs)
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Not trained yet
                  </span>
                )}

                <button className="button button-secondary button-small" style={{ fontSize: "11px" }}>
                  Train Drill →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. INTERACTIVE DRILL ROOM                                                  */
/* -------------------------------------------------------------------------- */

interface DrillRoomProps {
  position: EndgamePosition;
  progress: EndgameProgressMap;
  onBack: () => void;
  onRecordSuccess: (clean: boolean) => void;
  onSelectNext: () => void;
}

function EndgameDrillRoom({
  position,
  progress,
  onBack,
  onRecordSuccess,
  onSelectNext
}: DrillRoomProps) {
  const [state, setState] = useState(() => startEndgamePractice(position));
  const [feedback, setFeedback] = useState<string>("");
  const [hintActive, setHintActive] = useState<boolean>(false);
  const [flipped, setFlipped] = useState(false);
  const recorded = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setState(startEndgamePractice(position));
    setFeedback("");
    setHintActive(false);
    recorded.current = false;
    return () => window.clearTimeout(timer.current);
  }, [position]);

  const currentBoard = useMemo(
    () => chessAtEndgamePly(position, state.history),
    [position, state.history]
  );

  const userTurn = isUserTurn(state.ply);
  const currentOrientation = flipped
    ? position.sideToMove === "white" ? "black" : "white"
    : position.sideToMove;

  const currentExpected = expectedSan(position, state.ply);

  // Record drill completion exactly once
  useEffect(() => {
    if (state.finished && state.success && !recorded.current) {
      recorded.current = true;
      onRecordSuccess(isCleanRun(state));
    }
  }, [state, onRecordSuccess]);

  function handleUserMove(from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") {
    if (!userTurn || state.finished) return;

    let san: string | null = null;
    try {
      const copy = new Chess(currentBoard.fen());
      const res = copy.move({ from, to, promotion });
      if (res) san = res.san;
    } catch {
      return;
    }

    if (!san) return;

    const res = attemptEndgameMove(position, state, san);
    setState(res.state);

    if (!res.correct) {
      setFeedback(res.message || "That move deviates from optimal endgame theory.");
      return;
    }

    setFeedback("");
    setHintActive(false);

    // If drill not finished, trigger opponent reply after short delay
    if (!res.state.finished) {
      timer.current = window.setTimeout(() => {
        setState(s => advanceOpponentMove(position, s));
      }, 450);
    }
  }

  function handleHint() {
    if (!userTurn || state.finished) return;
    setHintActive(true);
    setState(s => ({ ...s, hintsUsed: s.hintsUsed + 1 }));
  }

  function handleRestart() {
    window.clearTimeout(timer.current);
    recorded.current = false;
    setState(startEndgamePractice(position));
    setFeedback("");
    setHintActive(false);
  }

  const prog = progress[position.id];
  const isMastered = prog?.cleared;

  return (
    <div>
      <button className="ol-back" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", marginBottom: "1rem" }}>
        <ArrowLeft size={14} /> Back to All Endgames
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 520px) 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column: Board card */}
        <div className="panel" style={{ padding: "14px", background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: position.objective === "win" ? "rgba(34, 197, 94, 0.12)" : "rgba(59, 130, 246, 0.12)",
                  color: position.objective === "win" ? "#4ade80" : "#60a5fa"
                }}
              >
                {position.objective === "win" ? "🏆 WINNING DRILL" : "🛡️ DRAWING DEFENSE"}
              </span>
              <strong style={{ fontSize: "14px" }}>
                {userTurn ? `Your turn as ${position.sideToMove}` : "Opponent replying…"}
              </strong>
            </div>

            <button
              className="icon-btn"
              onClick={() => setFlipped(f => !f)}
              style={{ width: "28px", height: "28px", display: "grid", placeItems: "center" }}
              title="Flip board"
            >
              ↺
            </button>
          </div>

          <div style={{ width: "100%", aspectRatio: "1 / 1" }}>
            <BoardView
              game={currentBoard}
              orientation={currentOrientation}
              interactive={userTurn && !state.finished}
              onMove={handleUserMove}
              maxWidth="100%"
            />
          </div>

          {/* Controls toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <button className="button button-secondary button-small" onClick={handleRestart}>
                <RotateCcw size={12} /> Restart
              </button>
              <button
                className="button button-secondary button-small"
                onClick={handleHint}
                disabled={!userTurn || state.finished}
              >
                <Lightbulb size={12} /> Hint
              </button>
            </div>

            <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
              Mistakes: {state.mistakes} · Hints: {state.hintsUsed}
            </span>
          </div>
        </div>

        {/* Right Column: Guidance, feedback & completion */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Title & Metadata Card */}
          <div className="panel" style={{ padding: "16px", background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {CATEGORY_LABELS[position.category]} · {position.difficulty}
                </span>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "2px 0 0" }}>
                  {position.title}
                </h2>
              </div>

              {isMastered ? (
                <span style={{ fontSize: "11px", color: "var(--lime)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                  <CheckCircle2 size={14} /> Mastered
                </span>
              ) : (
                <span style={{ fontSize: "11px", color: "#eab308" }}>
                  Streak: {prog?.cleanStreak ?? 0}/2
                </span>
              )}
            </div>

            <div style={{ padding: "8px 12px", background: "var(--panel2)", borderRadius: "6px", borderLeft: "3px solid var(--lime)", marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Key Theoretical Rule:</span>
              <strong style={{ fontSize: "13px", color: "var(--text)" }}>{position.keyConcept}</strong>
            </div>

            <p style={{ fontSize: "13px", color: "var(--soft)", lineHeight: 1.5, margin: 0 }}>
              {position.explanation}
            </p>
          </div>

          {/* Practice Feedback / Hint Card */}
          {hintActive && currentExpected && (
            <div style={{ padding: "12px 14px", background: "rgba(234, 179, 8, 0.12)", border: "1px solid rgba(234, 179, 8, 0.35)", borderRadius: "8px", fontSize: "13px", color: "#fef08a", display: "flex", alignItems: "center", gap: "8px" }}>
              <Lightbulb size={16} />
              <span>Hint: The master-level theoretical move in this position is <strong>{currentExpected}</strong>.</span>
            </div>
          )}

          {feedback && (
            <div style={{ padding: "12px 14px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", fontSize: "13px", color: "#fca5a5" }}>
              {feedback}
            </div>
          )}

          {/* Success / Completion Card */}
          {state.finished && state.success && (
            <div style={{ padding: "16px", background: "rgba(183, 227, 106, 0.12)", border: "1px solid var(--lime)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 size={20} style={{ color: "var(--lime)" }} />
                <strong style={{ fontSize: "1rem", color: "var(--text)" }}>
                  Drill Completed Successfully!
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--soft)", lineHeight: 1.45 }}>
                {isCleanRun(state)
                  ? "Clean run! No mistakes or hints used. 2 clean runs in a row achieve mastery."
                  : `Finished with ${state.mistakes} mistake(s) and ${state.hintsUsed} hint(s). Keep training to achieve a clean run.`}
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button className="button button-primary button-small" onClick={handleRestart}>
                  Practise Again
                </button>
                <button className="button button-secondary button-small" onClick={onSelectNext}>
                  Next Drill →
                </button>
              </div>
            </div>
          )}

          {/* Moves Played List */}
          <div className="panel" style={{ padding: "14px", background: "var(--panel)", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Moves Sequence Played:
            </span>
            {state.history.length === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Make your first move on the board.</span>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {state.history.map((m, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "12px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background: "var(--panel2)",
                      border: "1px solid var(--line)",
                      fontFamily: "var(--mono)"
                    }}
                  >
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ""}{m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
