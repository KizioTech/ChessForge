import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight,
  ArrowUpRight, BarChart3, BookOpen, Brain, CalendarClock, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CloudDownload,
  Command, Crosshair, Crown, Database, Download, FileUp, Filter, Flame, FolderOpen,
  Gauge, LayoutDashboard, Menu, MoreHorizontal, PanelLeftClose, Play,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Target, Trophy, Upload,
  X, Zap, Undo2
} from "lucide-react";
import type { Page } from "./types";
import { BoardView } from "./components/BoardView";
import { AuthModal } from "./components/AuthModal";
import { ProfileModal } from "./components/ProfileModal";
import { ImportDialog } from "./components/ImportDialog";
import { GameLibrary } from "./components/GameLibrary";
import { Sidebar } from "./components/Sidebar";
import { EvalGraph } from "./components/EvalGraph";
import { TrainingDesk } from "./components/TrainingDesk";
import { ReviewQueue } from "./components/ReviewQueue";
import { SettingsView } from "./components/SettingsView";
import { AnalyticsView } from "./components/AnalyticsView";
import { useAuth } from "./lib/auth";
import { getSettings, applyTheme } from "./lib/settings";
import { getGames, deleteGame, type GameRecord } from "./lib/games";
import { getAnalysisForGame } from "./lib/analyses";
import { analyzeGame, computeMoveClassifications } from "./lib/engine/game-analyzer";
import { StockfishEngine } from "./lib/engine/stockfish-engine";
import type { PositionEvaluation, PositionRecord, MoveAnalysisReport } from "./lib/engine/types";
import { generateExercisesFromGame } from "./lib/training/exercise-generator";
import logoUrl from "./assets/logo.png";
import {
  saveGeneratedExercises,
  getTrainingStats,
  type TrainingStats
} from "./lib/training/training-service";
import { exportGamesToPgn, exportAllDataAsJson, triggerDownload } from "./lib/export";
import { getWeaknessAnalysis, type WeaknessAnalysisReport } from "./lib/insight/trend-service";

function ChessKnight({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5" />
      <path d="M7 21v-3.5c0-1.8 1-3.2 2.3-4.2L8 10.5C7.4 9.4 8 8 9.2 7.5l2.2-1C12.8 5.8 14.2 6 15.2 7c1.2 1.2 1.6 2.8 1.4 4.5 1.5.8 2.4 2.2 2.4 4V21" />
      <path d="M10 10.5h.01" />
    </svg>
  );
}

const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const pieceGlyph: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
};
const squareNames = "abcdefgh";

function ChessBoard({ game, onMove, selected, setSelected, legalTargets }: {
  game: Chess; onMove: (from: Square, to: Square) => void;
  selected: Square | null; setSelected: (s: Square | null) => void;
  legalTargets: string[];
}) {
  const board = game.board();
  return <div className="board-frame">
    <div className="board-files top-files">{[..."abcdefgh"].map(f => <span key={f}>{f}</span>)}</div>
    <div className="board-inner">
      {board.map((rank, r) => <div className="board-rank" key={r}>
        <span className="rank-label">{8-r}</span>
        {rank.map((piece, c) => {
          const square = `${squareNames[c]}${8-r}` as Square;
          const isLight = (r + c) % 2 === 0;
          const isSelected = selected === square;
          const isTarget = legalTargets.includes(square);
          return <button
            key={square}
            className={`square ${isLight ? "light" : "dark"} ${isSelected ? "selected" : ""} ${isTarget ? "target" : ""}`}
            aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
            onClick={() => {
              if (selected && selected !== square && legalTargets.includes(square)) onMove(selected, square);
              else if (piece && piece.color === game.turn()) setSelected(isSelected ? null : square);
              else setSelected(null);
            }}
          >
            {piece && <span className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}`}>{pieceGlyph[`${piece.color}${piece.type}`]}</span>}
            {isTarget && !piece && <span className="move-dot"/>}
            {isTarget && piece && <span className="capture-ring"/>}
            {c === 0 && <span className="square-rank">{8-r}</span>}
            {r === 7 && <span className="square-file">{squareNames[c]}</span>}
          </button>;
        })}
      </div>)}
    </div>
    <div className="board-files bottom-files">{[..."abcdefgh"].map(f => <span key={f}>{f}</span>)}</div>
  </div>;
}

function EvaluationRail({ value = 0.35 }: { value?: number }) {
  const whitePct = Math.max(8, Math.min(92, 50 + value * 14));
  return <div className="eval-rail" aria-label={`Evaluation ${value > 0 ? "+" : ""}${value.toFixed(2)}`}>
    <div className="eval-black" style={{ height: `${100-whitePct}%` }}/>
    <div className="eval-white" style={{ height: `${whitePct}%` }}/>
    <span className="eval-number">{value > 0 ? "+" : ""}{value.toFixed(2)}</span>
  </div>;
}

function App() {
  const { user, profile, signOut } = useAuth();

  useEffect(() => {
    const s = getSettings();
    applyTheme(s.theme);
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [page, setPage] = useState<Page>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [moves, setMoves] = useState<string[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<GameRecord[]>([]);
  const [activeGame, setActiveGame] = useState<GameRecord | null>(null);

  // ── Phase 3: Engine analysis state ─────────────────────────────────────────
  const [analysisPositions, setAnalysisPositions] = useState<PositionRecord[]>([]);
  const [moveReports, setMoveReports] = useState<MoveAnalysisReport[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisAbortController, setAnalysisAbortController] = useState<AbortController | null>(null);

  // ── Phase 4: Training & Spaced Repetition stats ────────────────────────────
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({
    dueCount: 0,
    totalActive: 0,
    masteredCount: 0,
    streakDays: 0,
    blundersPer100Moves: 0
  });

  const refreshTrainingStats = useCallback(() => {
    setTrainingStats(getTrainingStats(user?.id));
  }, [user?.id]);

  const refreshGames = useCallback(() => {
    getGames(user?.id).then(setGames);
    refreshTrainingStats();
  }, [user?.id, refreshTrainingStats]);

  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  function openAnalysisForGame(gameRecord: GameRecord) {
    // Clear prior analysis state whenever a new game is loaded
    setAnalysisPositions([]);
    setMoveReports([]);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setAnalysisAbortController(null);
    try {
      const chess = new Chess(gameRecord.start_fen || undefined);
      chess.loadPgn(gameRecord.pgn, { strict: false });
      const sanMoves = chess.history();
      setMoves(sanMoves);
      setHistoryIndex(sanMoves.length);
      setOrientation(gameRecord.user_colour === "black" ? "black" : "white");
      setActiveGame(gameRecord);
      setPage("Analysis");
    } catch {
      setActiveGame(gameRecord);
      setPage("Analysis");
    }
    // Load cached analysis if available (non-blocking)
    getAnalysisForGame(gameRecord.id, user?.id).then(({ positions }) => {
      if (positions.length > 0) {
        setAnalysisPositions(positions);
        setMoveReports(computeMoveClassifications(positions));
      }
    }).catch(() => { /* silently ignore */ });
  }

  function handleClearActiveGame() {
    analysisAbortController?.abort();
    setActiveGame(null);
    setMoves([]);
    setHistoryIndex(0);
    setSelected(null);
    setAnalysisPositions([]);
    setMoveReports([]);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setAnalysisAbortController(null);
  }

  async function handleAnalyzeGame() {
    if (isAnalyzing) return;

    let targetGame = activeGame;
    if (!targetGame) {
      if (moves.length === 0) return;
      const now = new Date().toISOString();
      targetGame = {
        id: `free-${Date.now()}`,
        user_id: user?.id,
        platform: "local",
        fingerprint: `free-${moves.join("")}`,
        pgn: game.pgn() || moves.join(" "),
        white: "White",
        black: "Black",
        user_colour: "unknown",
        result: game.isCheckmate() ? (game.turn() === "w" ? "0-1" : "1-0") : "*",
        moves_count: moves.length,
        rated: false,
        variant: "standard",
        source: "upload",
        created_at: now,
        updated_at: now
      };
      setActiveGame(targetGame);
    }

    if (!targetGame) return;

    const gameToAnalyze = targetGame;
    const controller = new AbortController();
    setAnalysisAbortController(controller);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    try {
      const result = await analyzeGame(gameToAnalyze, {
        depth: 12,
        multiPv: 3,
        signal: controller.signal,
        onProgress: p => setAnalysisProgress(p.percent)
      });
      setAnalysisPositions(result.positions);
      const classifications = computeMoveClassifications(result.positions);
      setMoveReports(classifications);

      // Phase 4: Automatically generate training exercises and mistakes from analysis
      try {
        const generated = generateExercisesFromGame({
          game: gameToAnalyze,
          positions: result.positions,
          reports: classifications,
          userColour: gameToAnalyze.user_colour === "black" ? "black" : "white"
        });
        if (generated.exercises.length > 0 || generated.mistakes.length > 0) {
          await saveGeneratedExercises(generated.mistakes, generated.exercises, user?.id);
          refreshTrainingStats();
        }
      } catch (genErr) {
        console.warn("Exercise generation non-fatal error:", genErr);
      }
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        console.error("Analysis failed:", err);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisAbortController(null);
    }
  }

  async function handleDeleteGame(gameId: string) {
    await deleteGame(gameId, user?.id);
    refreshGames();
  }

  // Replay all moves up to the full length to build the "master" game state
  const game = useMemo(() => {
    const g = new Chess();
    moves.forEach(san => g.move(san));
    return g;
  }, [moves]);

  const history = game.history({ verbose: true });

  // Build the display game up to historyIndex (for move navigation)
  const displayGame = useMemo(() => {
    const g = new Chess();
    history.slice(0, historyIndex).forEach(m => g.move(m.san));
    return g;
  }, [historyIndex, history]);

  const legalTargets = selected
    ? displayGame.moves({ square: selected, verbose: true }).map(m => m.to)
    : [];

  function makeMove(from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") {
    try {
      // Build a temporary game at the current display position to validate the move
      const temp = new Chess(displayGame.fen());
      const result = temp.move({ from, to, promotion: promotion || "q" });
      if (!result) { setSelected(null); return; }

      // Truncate any future moves after historyIndex, then append the new SAN
      const newMoves = [...moves.slice(0, historyIndex), result.san];
      setMoves(newMoves);
      setHistoryIndex(newMoves.length);
      setSelected(null);
    } catch { setSelected(null); }
  }

  function goToMove(index: number) {
    setHistoryIndex(Math.max(0, Math.min(history.length, index)));
    setSelected(null);
  }

  /** Remove the last move from the line and step back to it. */
  function undoMove() {
    if (moves.length === 0) return;
    const newMoves = moves.slice(0, -1);
    setMoves(newMoves);
    // Stay at the end of the (now shorter) line
    setHistoryIndex(newMoves.length);
    setSelected(null);
  }

  // Keyboard shortcuts: ← / → navigate, Home/End, F flip, Ctrl+Z undo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in an input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undoMove(); }
        return;
      }

      if (e.key === "ArrowLeft")  { e.preventDefault(); goToMove(historyIndex - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goToMove(historyIndex + 1); }
      else if (e.key === "Home") { e.preventDefault(); goToMove(0); }
      else if (e.key === "End") { e.preventDefault(); goToMove(history.length); }
      else if (e.key === "f" || e.key === "F") { setOrientation((prev: string) => (prev === "white" ? "black" : "white")); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex, moves, history.length]);

  const movePairs = [];
  for (let i=0; i<history.length; i+=2) movePairs.push({ n: i/2+1, white: history[i], black: history[i+1] });


  return <div className="app-shell">
    <header className="titlebar">
      <div className="titlebar-brand">
        <img
          src={logoUrl}
          alt="ChessForge logo"
          style={{ width: "20px", height: "20px", borderRadius: "4px", objectFit: "contain" }}
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
        <span>CHESSFORGE</span>
        <span className="brand-divider">/</span>
        <span className="titlebar-context">{page}</span>
      </div>
      <div className="titlebar-actions">
        <button className="icon-btn" title="Help"><CircleHelp size={15}/></button>
        <button className="icon-btn" title="Settings" onClick={() => setPage("Settings")}><Settings2 size={15}/></button>
      </div>
    </header>

    <div className="app-body">
      <Sidebar
        page={page}
        onNavigate={setPage}
        user={user}
        profile={profile}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onSignOut={signOut}
        isOpen={sidebarOpen}
      />

      <main className="main-area">
        <div className="page-toolbar">
          <div className="toolbar-left"><button className="icon-btn collapse-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar"><PanelLeftClose size={16}/></button><span className="breadcrumb">Workspace</span><ChevronRight size={13}/><strong>{page}</strong></div>
          <div className="toolbar-right">
            <div className="search-box"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ChessForge"/><kbd>⌘ K</kbd></div>
            <button className="button button-secondary" onClick={() => setShowImport(true)}><Upload size={14}/> Import games</button>
            {games.length > 0 && (
              <button
                className="button button-secondary"
                onClick={() => {
                  const pgn = exportGamesToPgn(games);
                  triggerDownload(pgn, "chessforge-games.pgn", "application/x-chess-pgn");
                }}
                title="Export all games to PGN"
              >
                <Download size={14}/> Export PGN
              </button>
            )}
          </div>
        </div>

        {page === "Dashboard" && (
          <Dashboard
            games={games}
            trainingStats={trainingStats}
            onNavigate={setPage}
            onImport={() => setShowImport(true)}
            onOpenAnalysis={openAnalysisForGame}
            userId={user?.id}
          />
        )}
        {page === "My Games" && <GameLibrary games={games} onImport={() => setShowImport(true)} onOpenAnalysis={openAnalysisForGame} onDeleteGame={handleDeleteGame} />}
        {page === "Analysis" && (
          <Analysis
            game={displayGame}
            onMove={makeMove}
            onUndo={undoMove}
            history={history}
            movePairs={movePairs}
            historyIndex={historyIndex}
            goToMove={goToMove}
            orientation={orientation}
            setOrientation={setOrientation}
            activeGame={activeGame}
            onClearActiveGame={handleClearActiveGame}
            analysisPositions={analysisPositions}
            moveReports={moveReports}
            isAnalyzing={isAnalyzing}
            analysisProgress={analysisProgress}
            onAnalyzeGame={handleAnalyzeGame}
            onCancelAnalysis={() => analysisAbortController?.abort()}
            hasMoves={moves.length > 0}
          />
        )}
        {page === "Train" && (
          <TrainingDesk
            onBackToDashboard={() => { refreshTrainingStats(); setPage("Dashboard"); }}
            onNavigateToQueue={() => { refreshTrainingStats(); setPage("Review Queue"); }}
            userId={user?.id}
          />
        )}
        {page === "Review Queue" && (
          <ReviewQueue
            onStartSession={() => setPage("Train")}
            userId={user?.id}
          />
        )}
        {page === "Settings" && (
          <SettingsView
            games={games}
            onRefreshData={refreshGames}
          />
        )}
        {page === "Analytics" && (
          <AnalyticsView
            userId={user?.id}
            totalGamesCount={games.length}
            games={games}
            onOpenAnalysis={openAnalysisForGame}
            onNavigateToTrain={() => setPage("Train")}
          />
        )}
        {page !== "Dashboard" && page !== "My Games" && page !== "Analysis" && page !== "Train" && page !== "Review Queue" && page !== "Settings" && page !== "Analytics" && (
          <Placeholder page={page} onImport={() => setShowImport(true)} onNavigate={setPage}/>
        )}
      </main>
    </div>
    <ImportDialog
      isOpen={showImport}
      onClose={() => setShowImport(false)}
      onImportComplete={refreshGames}
      onNavigateToGames={() => setPage("My Games")}
    />
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    <ProfileModal
      isOpen={showProfileModal}
      onClose={() => setShowProfileModal(false)}
      user={user}
      profile={profile}
      onSignOut={signOut}
    />
  </div>;
}

function Dashboard({
  games,
  trainingStats,
  onNavigate,
  onImport,
  onOpenAnalysis,
  userId
}: {
  games: GameRecord[];
  trainingStats: TrainingStats;
  onNavigate: (p: Page) => void;
  onImport: () => void;
  onOpenAnalysis: (g: GameRecord) => void;
  userId?: string;
}) {
  const recentGames = games.slice(0, 3);
  const [weakness, setWeakness] = useState<WeaknessAnalysisReport | null>(null);

  useEffect(() => {
    const totalMoves = games.reduce((sum, g) => sum + (g.moves_count || 0), 0);
    getWeaknessAnalysis(userId, games.length, totalMoves).then(setWeakness);
  }, [userId, games.length]);

  return <div className="content dashboard-content">
    <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13}/> YOUR TRAINING DESK</div><h1>Good afternoon.</h1><p className="subheading">A clearer picture of your chess. One decision at a time.</p></div><div className="date-chip"><CalendarClock size={14}/> Tuesday, 3 November 2026</div></div>
    <div className="stat-grid">
      <StatCard
        label="BLUNDERS / 100 MOVES"
        value={weakness ? `${weakness.blundersPer100Moves}` : `${trainingStats.blundersPer100Moves || "—"}`}
        change={weakness && weakness.totalMistakes > 0 ? `${weakness.totalMistakes} logged mistakes` : "Evaluate games to track"}
        icon={<Gauge size={16}/>}
        tone={weakness && weakness.blundersPer100Moves > 3 ? undefined : "lime"}
      />
      <StatCard
        label="GAMES IN LIBRARY"
        value={games.length > 0 ? `${games.length}` : "—"}
        change={games.length >= 20 ? "Baseline sample met" : `${games.length}/20 baseline games`}
        icon={<Activity size={16}/>}
        tone={games.length >= 20 ? "lime" : undefined}
      />
      <StatCard
        label="REVIEW POSITIONS"
        value={trainingStats.dueCount > 0 ? `${trainingStats.dueCount} due` : trainingStats.totalActive > 0 ? `${trainingStats.totalActive} active` : "0"}
        change={trainingStats.dueCount > 0 ? "Ready for spaced repetition" : trainingStats.totalActive > 0 ? "All caught up" : "Analyse games to generate"}
        icon={<Target size={16}/>}
        tone={trainingStats.dueCount > 0 ? "lime" : undefined}
      />
      <StatCard
        label="TRAINING STREAK"
        value={`${trainingStats.streakDays} days`}
        change={trainingStats.streakDays > 0 ? "Habit active" : "Your first session awaits"}
        icon={<Flame size={16}/>}
        tone={trainingStats.streakDays > 0 ? "lime" : undefined}
      />
    </div>
    <div className="dashboard-grid">
      <section className="panel training-feature">
        <div className="panel-head"><div><div className="eyebrow">NEXT BEST ACTION</div><h2>Build your tactical eye</h2></div><span className="recommend-tag"><Sparkles size={12}/> Suggested start</span></div>
        <div className="feature-body">
          <div className="mini-board">
            {["♜","","♝","♛","","♚","","","♟","♟","","","","♟","♟","","","","♞","","","","","","","","♙","","♙","","","","","","♘","","","","","","","♙","","","","♙","","♙","♙","","","","♕","","♔","",""].slice(0,64).map((p,i)=><div key={i} className={(Math.floor(i/8)+i%8)%2===0?"mini-light":"mini-dark"}>{p}</div>)}
          </div>
          <div className="feature-copy"><div className="feature-kicker">TACTICAL CALCULATION <span>·</span> 15 MIN</div><h3>See the forcing move.</h3><p>Train yourself to look for checks, captures and threats before committing to a move.</p><div className="feature-meta"><span><Target size={13}/> Pattern recognition</span><span><Brain size={13}/> Adaptive difficulty later</span></div><button className="button button-primary" onClick={()=>onNavigate("Train")}><Play size={14} fill="currentColor"/> Start a session <ArrowRight size={14}/></button></div>
        </div>
      </section>
      <section className="panel focus-panel">
        <div className="panel-head"><div><div className="eyebrow">YOUR FOCUS</div><h2>Weakness Diagnosis</h2></div><button className="icon-btn" onClick={()=>onNavigate("Analytics")} title="Open full analytics view"><BarChart3 size={17}/></button></div>
        {weakness && weakness.totalMistakes > 0 ? (
          <div className="empty-insight" style={{ textAlign: "left", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div className="insight-icon" style={{ margin: 0 }}><Brain size={19}/></div>
              <strong style={{ fontSize: "14px" }}>
                {weakness.tagFrequencies[0]?.tag
                  ? `Primary blindspot: ${weakness.tagFrequencies[0].tag.replace(/_/g, " ")}`
                  : "Tactical patterns identified"}
              </strong>
            </div>
            <p style={{ margin: "4px 0 10px", fontSize: "12px", lineHeight: "1.4" }}>
              {weakness.insufficientData
                ? `Preliminary data from ${games.length}/20 baseline games (${weakness.totalMistakes} mistakes detected).`
                : `Verified across ${games.length} games. ${weakness.tagFrequencies[0]?.count || 0} occurrences (${weakness.tagFrequencies[0]?.percentage || 0}% of mistakes).`}
            </p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
              {weakness.tagFrequencies.filter(t => t.count > 0).slice(0, 3).map(tf => (
                <span
                  key={tf.tag}
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "12px",
                    background: "rgba(183, 227, 106, 0.12)",
                    color: "var(--lime)",
                    border: "1px solid rgba(183, 227, 106, 0.25)"
                  }}
                >
                  {tf.tag.replace(/_/g, " ")} ({tf.count})
                </span>
              ))}
            </div>
            <button className="button button-primary button-small" onClick={()=>onNavigate("Analytics")}>
              View Weakness Breakdown <ArrowRight size={13}/>
            </button>
          </div>
        ) : games.length >= 20 ? (
          <div className="empty-insight">
            <div className="insight-icon"><Brain size={19}/></div>
            <strong>{games.length} games imported!</strong>
            <p>Baseline sample met. Analyse your games in the Analysis tab to automatically identify tactical blindspots.</p>
            <button className="text-button" onClick={()=>onNavigate("My Games")}>Explore your games <ArrowRight size={13}/></button>
          </div>
        ) : (
          <div className="empty-insight">
            <div className="insight-icon"><Brain size={19}/></div>
            <strong>{games.length > 0 ? `${games.length} of 20 baseline games loaded` : "Your chess profile is waiting."}</strong>
            <p>Import 15–20 recent rapid games. ChessForge will look for recurring patterns before recommending what to study.</p>
            <button className="text-button" onClick={onImport}>{games.length > 0 ? "Import more games" : "Import your first games"} <ArrowRight size={13}/></button>
          </div>
        )}
        <div className="focus-footer"><ShieldCheck size={14}/> Evidence over assumptions: Requires N &ge; 20 games for verified diagnosis.</div>
      </section>
      <section className="panel performance-panel">
        <div className="panel-head"><div><div className="eyebrow">PERFORMANCE</div><h2>Rating & consistency</h2></div><button className="select-button">Last 30 days <ChevronDown size={13}/></button></div>
        <div className="chart-placeholder">
          <div className="chart-y"><span>1,300</span><span>1,250</span><span>1,200</span><span>1,150</span></div>
          <svg viewBox="0 0 620 150" preserveAspectRatio="none" className="line-chart" role="img" aria-label="No rating history imported yet">
            <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b7e36a" stopOpacity=".18"/><stop offset="100%" stopColor="#b7e36a" stopOpacity="0"/></linearGradient></defs>
            {[15,55,95,135].map(y=><line key={y} x1="0" x2="620" y1={y} y2={y} stroke="#2a3941" strokeDasharray="3 5"/>)}
            <path d="M0 130 L620 130" stroke="#718087" strokeDasharray="4 5" fill="none"/>
            <text x="310" y="78" fill="#829197" fontSize="12" textAnchor="middle">{games.length > 0 ? `${games.length} games recorded in library` : "Import games to build your rating history"}</text>
          </svg>
        </div>
        <div className="chart-legend"><span><i className="legend-dot lime"/> Chess.com Rapid</span><span><i className="legend-dot copper"/> Lichess Rapid</span><span className="chart-note">Platforms tracked separately</span></div>
      </section>
      <section className="panel activity-panel">
        <div className="panel-head"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Pick up where you left off</h2></div><button className="text-button" onClick={()=>onNavigate("My Games")}>View games <ArrowRight size={13}/></button></div>
        {recentGames.length === 0 ? (
          <div className="empty-activity"><div className="empty-icon"><Database size={19}/></div><div><strong>No games in your library</strong><p>Your imported games and analysis reports will appear here.</p></div><button className="button button-secondary button-small" onClick={onImport}><Plus size={13}/> Add games</button></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
            {recentGames.map(g => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--raised)",
                  borderRadius: "6px",
                  fontSize: "11px",
                  cursor: "pointer"
                }}
                onClick={() => onOpenAnalysis(g)}
              >
                <div>
                  <strong>{g.white} vs {g.black}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "10px" }}>
                    {g.result} · {g.time_class || g.platform} · {g.moves_count} moves
                  </div>
                </div>
                <button className="button button-secondary button-small" onClick={e => { e.stopPropagation(); onOpenAnalysis(g); }}>
                  Analyse
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    <div className="dashboard-bottom">
      <span><span className="status-dot"/> All systems ready</span>
      <span>{games.length > 0 ? `${games.length} games loaded in repository` : "Sample workspace · No personal game data loaded"}</span>
      <button onClick={()=>onNavigate(games.length > 0 ? "My Games" : "Analysis")}>Explore library <ArrowRight size={13}/></button>
    </div>
  </div>;
}

function StatCard({ label, value, change, icon, tone }: {label:string;value:string;change:string;icon:React.ReactNode;tone?:string}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone||""}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-change">{change}</div></div>;
}

function Analysis({
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
}: {
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
}) {
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
    liveEngine.evaluatePosition(fen, {
      depth: 12,
      multiPv: 3,
      signal: controller.signal,
      ply: historyIndex
    }).then(result => {
      setLiveEval(result);
      setIsLiveCalculating(false);
    }).catch(err => {
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
    ? ("mateIn" in currentEval ? currentEval.mateIn : (currentEval as any).mate_in)
    : null;

  const scoreCp = currentEval
    ? ("scoreCp" in currentEval ? currentEval.scoreCp : (currentEval as any).score_cp)
    : null;

  // Derive an eval-rail value from current position evaluation (centipawns → ±N)
  const evalValue = mateIn !== null && mateIn !== undefined
    ? (mateIn > 0 ? 5 : -5)
    : (scoreCp ?? 0) / 100;

  const evalLabel = mateIn !== null && mateIn !== undefined
    ? `M${Math.abs(mateIn)}`
    : scoreCp !== null && scoreCp !== undefined
      ? `${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(2)}`
      : isLiveCalculating ? "…" : "0.00";

  const isCheckmatePosition = game.isCheckmate();
  const isCheckPosition = game.inCheck() && !game.isCheckmate();

  // MultiPV candidate lines to display
  const candidateLines = useMemo(() => {
    if (!currentEval) return [];
    if ("lines" in currentEval && Array.isArray((currentEval as any).lines)) return (currentEval as any).lines;
    if ("pv_lines" in currentEval && Array.isArray((currentEval as any).pv_lines)) return (currentEval as any).pv_lines;
    return [];
  }, [currentEval]);

  const currentReport = reportByPly[historyIndex];

  return <div className="analysis-content">
    <div className="analysis-layout">
      <section className="board-panel panel">
        <div className="board-topline">
          <span><span className="live-dot"/> BOARD</span>
          <span className="turn-label">
            {isCheckmatePosition ? (
              <span className="status-pill status-checkmate" style={{ color: "#ff5252", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Crown size={13} /> CHECKMATE · {game.turn() === "w" ? "Black" : "White"} wins
              </span>
            ) : game.isStalemate() || (game.isDraw() && !game.isCheckmate()) ? (
              <span className="status-pill status-draw" style={{ color: "#fbbf24", fontWeight: 600 }}>
                DRAW · {game.isStalemate() ? "Stalemate" : "Drawn game"}
              </span>
            ) : isCheckPosition ? (
              <span className="status-pill status-check" style={{ color: "#ff5252", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
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
            <Crown size={18}/>
            <strong>{game.turn() === "w" ? "Black" : "White"} wins by checkmate</strong>
            <span>Game over</span>
          </div>
        )}

        {/* Check highlight banner */}
        {isCheckPosition && (
          <div className="analysis-check-banner">
            <AlertTriangle size={15}/>
            <strong>{game.turn() === "w" ? "White" : "Black"} is in check</strong>
          </div>
        )}

        <div className="board-wrapper">
          {/* Top player above board (Left-aligned) */}
          {(() => {
            const topIsBlack = orientation === "white";
            const topColor = topIsBlack ? "b" : "w";
            const topName = activeGame ? (topIsBlack ? activeGame.black : activeGame.white) : (topIsBlack ? "Black" : "White");
            const topElo = activeGame ? (topIsBlack ? activeGame.black_elo : activeGame.white_elo) : null;
            const topIsUser = activeGame?.user_colour ? (topIsBlack ? activeGame.user_colour === "black" : activeGame.user_colour === "white") : false;

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
                  style={{ width: "22px", height: "22px", borderRadius: "5px", fontSize: "10px", fontWeight: 700 }}
                >
                  {topColor === "w" ? "W" : "B"}
                </div>
                <strong style={{ fontSize: "12px", fontWeight: 600 }}>{topName}</strong>
                {topElo && <span style={{ color: "var(--muted)", fontSize: "11px" }}>({topElo})</span>}
                {topIsUser && (
                  <span style={{ fontSize: "9px", background: "rgba(183, 227, 106, 0.15)", color: "var(--lime)", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>
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
            const bottomName = activeGame ? (bottomIsBlack ? activeGame.black : activeGame.white) : (bottomIsBlack ? "Black" : "White");
            const bottomElo = activeGame ? (bottomIsBlack ? activeGame.black_elo : activeGame.white_elo) : null;
            const bottomIsUser = activeGame?.user_colour ? (bottomIsBlack ? activeGame.user_colour === "black" : activeGame.user_colour === "white") : false;

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
                  style={{ width: "22px", height: "22px", borderRadius: "5px", fontSize: "10px", fontWeight: 700 }}
                >
                  {bottomColor === "w" ? "W" : "B"}
                </div>
                <strong style={{ fontSize: "12px", fontWeight: 600 }}>{bottomName}</strong>
                {bottomElo && <span style={{ color: "var(--muted)", fontSize: "11px" }}>({bottomElo})</span>}
                {bottomIsUser && (
                  <span style={{ fontSize: "9px", background: "rgba(183, 227, 106, 0.15)", color: "var(--lime)", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>
                    YOU
                  </span>
                )}
              </div>
            );
          })()}
          <div className="board-controls">
            <button className="icon-btn" onClick={()=>goToMove(0)} title="Go to start (Home)"><ArrowLeft size={15}/></button>
            <button className="icon-btn" onClick={()=>goToMove(historyIndex-1)} title="Previous move (←)"><ChevronLeft size={16}/></button>
            <button className="icon-btn" onClick={()=>goToMove(historyIndex+1)} title="Next move (→)"><ChevronRight size={16}/></button>
            <button className="icon-btn" onClick={()=>goToMove(history.length)} title="Go to end"><ArrowRight size={15}/></button>
            <span className="move-position">{historyIndex===0?"Starting position":`After ${Math.ceil(historyIndex/2)}.${historyIndex%2?" White":" Black"}`}</span>
            <button
              className="icon-btn"
              onClick={onUndo}
              disabled={history.length === 0}
              title="Undo last move (Ctrl+Z)"
              style={{ marginLeft: "auto", opacity: history.length === 0 ? 0.3 : 1 }}
            >
              <Undo2 size={15}/>
            </button>
            <button className="icon-btn flip-btn" onClick={()=>setOrientation((prev: string)=>prev==="white"?"black":"white")} title="Flip board"><ArrowDownRight size={15}/></button>
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
                  <Sparkles size={13}/> {activeGame.platform.toUpperCase()} GAME
                  <span className="demo-pill" style={{ color: "var(--lime)", borderColor: "var(--lime-dark)", background: "#1c2a1e" }}>
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
              <button className="button button-secondary" onClick={onClearActiveGame} title="Clear loaded game and start new board">
                <Plus size={14}/> New board
              </button>
            )}
            <button
              className="button button-secondary"
              onClick={() => setEngineEnabled(!engineEnabled)}
              title={engineEnabled ? "Disable live evaluation" : "Enable live evaluation"}
            >
              <Zap size={14} style={{ color: engineEnabled ? "var(--lime)" : "var(--muted)" }}/>
              {engineEnabled ? "Engine ON" : "Engine OFF"}
            </button>
            {isAnalyzing ? (
              <button className="button button-secondary analysis-cancel-btn" onClick={onCancelAnalysis}>
                <X size={14}/> Cancel ({analysisProgress}%)
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={onAnalyzeGame}
                disabled={!activeGame && !hasMoves}
                title={!activeGame && !hasMoves ? "Make moves on the board or load a game to analyse" : undefined}
              >
                <Sparkles size={14}/> {analysisPositions.length > 0 ? "Re-analyse" : "Analyse game"}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isAnalyzing && (
          <div className="analysis-progress-track">
            <div className="analysis-progress-bar" style={{ width: `${analysisProgress}%` }} />
            <span className="analysis-progress-label">Analysing… {analysisProgress}%</span>
          </div>
        )}
        {/* Engine Evaluation Panel */}
        <section className="panel evaluation-panel">
          <div className="panel-head">
            <div><div className="eyebrow">ENGINE EVALUATION</div><h2>Position assessment</h2></div>
            {engineEnabled ? (
              <span className="engine-badge" onClick={() => setEngineEnabled(false)} title="Click to pause engine" style={{ cursor: "pointer" }}>
                <span className="status-live"/> {isLiveCalculating ? "Calculating…" : "SF19 · Online"}
              </span>
            ) : (
              <span className="engine-badge" onClick={() => setEngineEnabled(true)} title="Click to resume engine" style={{ cursor: "pointer" }}>
                <span className="status-muted"/> Offline (Paused)
              </span>
            )}
          </div>

          <div className="eval-main">
            <span className="eval-score">{evalLabel}</span>
            <span className="eval-caption">
              {mateIn !== null && mateIn !== undefined
                ? `Forced mate in ${Math.abs(mateIn)}`
                : evalValue > 1 ? "White is better" : evalValue < -1 ? "Black is better" : "Roughly equal"}
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
                        onMove(line.uci.slice(0, 2) as Square, line.uci.slice(2, 4) as Square, line.uci[4] as any);
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
                      {line.pvSan && <span className="candidate-continuation">{line.pvSan}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="engine-settings">
            <span>Depth <b>12</b></span>
            <span>MultiPV <b>3</b></span>
            <span>Engine <b>Stockfish 19 Lite</b></span>
          </div>
        </section>

        {/* Moves / Notation Panel */}
        <section className="panel moves-panel"><div className="panel-head"><div><div className="eyebrow">NOTATION</div><h2>Moves</h2></div><span className="move-count">{history.length} plies</span></div>
          {history.length===0 ? <div className="moves-empty"><div className="moves-empty-board">♟</div><strong>Ready for a game</strong><p>Make legal moves on the board or import a PGN to review a real game.</p></div> :
            <div className="move-list">{movePairs.map((pair:any,i:number)=><div className="move-row" key={pair.n}><span className="move-number">{pair.n}.</span>
              <button className={historyIndex===i*2+1?"move-active":""} onClick={()=>goToMove(i*2+1)}>
                {pair.white?.san||"—"}
                {reportByPly[i*2+1]?.classification === "blunder" && <span className="badge-blunder" title="Blunder">??</span>}
                {reportByPly[i*2+1]?.classification === "mistake" && <span className="badge-mistake" title="Mistake">?</span>}
                {reportByPly[i*2+1]?.classification === "inaccuracy" && <span className="badge-inaccuracy" title="Inaccuracy">?!</span>}
              </button>
              <button className={historyIndex===i*2+2?"move-active":""} onClick={()=>goToMove(i*2+2)}>
                {pair.black?.san||""}
                {reportByPly[i*2+2]?.classification === "blunder" && <span className="badge-blunder" title="Blunder">??</span>}
                {reportByPly[i*2+2]?.classification === "mistake" && <span className="badge-mistake" title="Mistake">?</span>}
                {reportByPly[i*2+2]?.classification === "inaccuracy" && <span className="badge-inaccuracy" title="Inaccuracy">?!</span>}
              </button>
            </div>)}</div>}
        </section>

        <section className="panel lesson-panel">
          <div className="panel-head"><div><div className="eyebrow">LEARNING NOTES</div><h2>What to look for</h2></div><Brain size={16} className="muted"/></div>
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
                <b style={{ color: "var(--text)" }}>{currentReport.bestSan || currentReport.bestUci}</b>.
              </p>
            </div>
          ) : (
            <div className="lesson-empty">
              <Sparkles size={15}/>
              <span>After engine analysis, ChessForge will explain critical moments, tag recurring tactical blindspots, and suggest positions worth practising.</span>
            </div>
          )}
        </section>

        {/* Footnote at the bottom of the scrollable right panel */}
        <div className="analysis-footnote"><ShieldCheck size={13}/> Engine analysis is for post-game review only. No live-game assistance is ever provided.</div>
      </aside>
    </div>
  </div>;
}

function Placeholder({page,onImport,onNavigate}:{page:Page;onImport:()=>void;onNavigate:(p:Page)=>void}) {
  const config:Record<string,{icon:any;title:string;desc:string;action:string}> = {
    "My Games":{icon:FolderOpen,title:"Your games, in one place.",desc:"Import your Chess.com and Lichess games or upload PGN files. ChessForge will build a searchable library for review.",action:"Import games"},
    "Train":{icon:Crosshair,title:"Training built around your chess.",desc:"Your exercises will come from patterns found in your own games, alongside carefully selected foundational practice.",action:"Explore analysis"},
    "Review Queue":{icon:CalendarClock,title:"Nothing due. Yet.",desc:"Positions you struggle with will return at carefully spaced intervals, helping you retain what you learn.",action:"View training"},
    "Openings":{icon:BookOpen,title:"Understand your opening choices.",desc:"Build White and Black repertoires, review your lines and identify where your games leave familiar territory.",action:"Import a PGN"},
    "Endgames":{icon:Crown,title:"Make the technical positions count.",desc:"Practise king and pawn endings, rook endings, basic mates and practical conversion technique.",action:"Start training"},
    "Analytics":{icon:BarChart3,title:"Evidence before assumptions.",desc:"ChessForge will track your results, recurring mistakes, tactical opportunities and training progress over time.",action:"Import games"}
  };
  const c=config[page]||config.Train; const Icon=c.icon;
  return <div className="content placeholder-page"><div className="placeholder-hero"><div className="placeholder-icon"><Icon size={24}/></div><div className="eyebrow">CHESSFORGE / {page.toUpperCase()}</div><h1>{c.title}</h1><p>{c.desc}</p><div className="placeholder-actions"><button className="button button-primary" onClick={page==="Train"||page==="Endgames"?()=>onNavigate("Analysis"):onImport}>{page==="Train"||page==="Endgames"?<Play size={14}/>:<Upload size={14}/>} {c.action}</button><button className="button button-secondary" onClick={()=>onNavigate("Dashboard")}>Back to dashboard</button></div></div><div className="placeholder-note"><ShieldCheck size={16}/><div><strong>Built around your own games</strong><p>We won't label a weakness until there is enough evidence from your imported games and training attempts.</p></div></div></div>;
}

export default App;
