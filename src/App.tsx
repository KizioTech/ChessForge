import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight,
  ArrowUpRight, BarChart3, BookOpen, Brain, CalendarClock, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CloudDownload,
  Command, Crosshair, Crown, Database, Download, FileUp, Filter, Flame, FolderOpen,
  Gauge, LayoutDashboard, Menu, MoreHorizontal, PanelLeftClose, Play,
  Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Target, Trophy, Upload,
  X, Zap, Undo2
} from "lucide-react";
import type { Page } from "./types";
import { AuthModal } from "./components/AuthModal";
import { ProfileModal } from "./components/ProfileModal";
import { ImportDialog } from "./components/ImportDialog";
import { GameLibrary } from "./components/GameLibrary";
import { Sidebar } from "./components/Sidebar";
import { DashboardView } from "./components/DashboardView";
import { AnalysisView } from "./components/AnalysisView";
import { PlaceholderView } from "./components/PlaceholderView";
import { TrainingDesk } from "./components/TrainingDesk";
import { ReviewQueue } from "./components/ReviewQueue";
import { SettingsView } from "./components/SettingsView";
import { AnalyticsView } from "./components/AnalyticsView";
import { OpeningsHub } from "./components/OpeningsHub";
import { EndgameLab } from "./components/EndgameLab";
import { useAuth } from "./lib/auth";
import { getSettings, applyTheme } from "./lib/settings";
import { getGames, deleteGame, type GameRecord } from "./lib/games";
import { getAnalysisForGame } from "./lib/analyses";
import { analyzeGame, computeMoveClassifications } from "./lib/engine/game-analyzer";
import type { PositionRecord, MoveAnalysisReport } from "./lib/engine/types";
import { generateExercisesFromGame } from "./lib/training/exercise-generator";
import logoUrl from "./assets/logo.png";
import {
  saveGeneratedExercises,
  getTrainingStats,
  pullTrainingState,
  isHydrationDue,
  markHydrationDone,
  type TrainingStats
} from "./lib/training/training-service";
import { flushOutbox } from "./lib/outbox";
import { exportGamesToPgn, exportAllDataAsJson, triggerDownload } from "./lib/export";
import { runAutoSync } from "./lib/sync/auto-sync";

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
  const [openingsTargetFamily, setOpeningsTargetFamily] = useState<string | null>(null);

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

  // ── Platform sync (auto-daily + manual "Sync Games" button) ─────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  const handleSyncGames = useCallback(
    async (dailyGated = false) => {
      if (!user?.id || isSyncing) return;
      setIsSyncing(true);
      setSyncToast(dailyGated ? null : "Syncing games…");

      const ctrl = new AbortController();
      syncAbortRef.current = ctrl;

      try {
        const results = await runAutoSync(
          {
            userId: user.id,
            username: user.email || profile?.display_name || undefined,
            onGamesImported: () => {
              // Refresh the game list as batches arrive.
              getGames(user.id).then(setGames);
            },
            onComplete: (rs) => {
              const total = rs.reduce((s, r) => s + r.gamesImported, 0);
              if (total > 0) {
                setSyncToast(`✓ ${total} new game${total !== 1 ? "s" : ""} imported`);
              } else if (!dailyGated) {
                setSyncToast("✓ Already up to date");
              }
              refreshGames();
              setTimeout(() => setSyncToast(null), 4000);
            },
            signal: ctrl.signal,
          },
          dailyGated
        );
        // If dailyGated returned immediately (no accounts or already done), clear loading
        if (results.length === 0 && dailyGated) {
          setIsSyncing(false);
          return;
        }
      } catch {
        setSyncToast("Sync failed — check Settings → Platform Sync");
        setTimeout(() => setSyncToast(null), 5000);
      } finally {
        setIsSyncing(false);
        syncAbortRef.current = null;
      }
    },
    [user, profile, isSyncing, refreshGames]
  );

  // Run once per day on startup (after user loads, non-blocking)
  const hasTriedDailySync = useRef(false);
  useEffect(() => {
    if (!user?.id || hasTriedDailySync.current) return;
    hasTriedDailySync.current = true;
    // Small delay so the app UI renders first
    const tid = setTimeout(() => {
      handleSyncGames(true);
    }, 3000);
    return () => clearTimeout(tid);
  }, [user?.id, handleSyncGames]);

  // ── Item 1.5: Training cloud hydration ───────────────────────────────────
  // Pull training data from Supabase once per session on login, and whenever
  // the window regains focus (e.g. user switches devices or reopens the app).
  const hydrationRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;

    const hydrate = async (userId: string) => {
      // Flush any queued offline writes from previous sessions
      flushOutbox(userId).catch(() => {});

      if (!isHydrationDue(userId)) return;
      markHydrationDone(userId);
      hydrationRef.current = userId;
      try {
        await pullTrainingState(userId);
        refreshTrainingStats();
      } catch {
        // non-fatal — local data already in place
      }
    };

    // Run immediately when user id becomes available
    hydrate(user.id);

    // Re-run whenever the window/tab becomes visible (focus restore)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && user?.id) {
        // Reset the session gate so the next focus triggers a fresh pull
        hydrationRef.current = null;
        try { sessionStorage.removeItem("chessforge:hydration_session"); } catch {}
        hydrate(user.id);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user?.id, refreshTrainingStats]);

  function openAnalysisForGame(gameRecord: GameRecord, targetPly?: number) {
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
      const targetIndex = (targetPly !== undefined && targetPly >= 0 && targetPly <= sanMoves.length)
        ? targetPly
        : sanMoves.length;
      setHistoryIndex(targetIndex);
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
            {/* Sync Games button — visible only when user has an account connected */}
            {user && (
              <button
                className={`button button-secondary${isSyncing ? " button-loading" : ""}`}
                onClick={() => handleSyncGames(false)}
                disabled={isSyncing}
                title="Check all connected Chess.com and Lichess accounts for new games"
              >
                <RefreshCw size={14} className={isSyncing ? "spin" : ""}/>
                {isSyncing ? "Syncing…" : "Sync Games"}
              </button>
            )}
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

        {/* Sync toast notification */}
        {syncToast && (
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              zIndex: 9999,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 16px",
              fontSize: "13px",
              color: "var(--fg)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <RefreshCw size={13} style={{ color: "var(--lime)" }}/>
            {syncToast}
          </div>
        )}

        {page === "Dashboard" && (
          <DashboardView
            games={games}
            trainingStats={trainingStats}
            onNavigate={setPage}
            onImport={() => setShowImport(true)}
            onOpenAnalysis={openAnalysisForGame}
            userId={user?.id}
          />
        )}
        {page === "My Games" && (
          <GameLibrary
            games={games}
            onImport={() => setShowImport(true)}
            onOpenAnalysis={openAnalysisForGame}
            onDeleteGame={handleDeleteGame}
            onSync={user ? () => handleSyncGames(false) : undefined}
            isSyncing={isSyncing}
          />
        )}
        {page === "Analysis" && (
          <AnalysisView
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
            userId={user?.id}
            username={user?.email || profile?.display_name || undefined}
            onRefreshData={refreshGames}
            onGamesImported={(newGames) => {
              refreshGames();
            }}
          />
        )}
        {page === "Analytics" && (
          <AnalyticsView
            userId={user?.id}
            totalGamesCount={games.length}
            games={games}
            onOpenAnalysis={openAnalysisForGame}
            onNavigateToTrain={() => setPage("Train")}
            onNavigateToOpenings={(family) => {
              setOpeningsTargetFamily(family || null);
              setPage("Openings");
            }}
          />
        )}
        {page === "Openings" && (
          <OpeningsHub
            userId={user?.id}
            games={games}
            onOpenAnalysis={openAnalysisForGame}
            initialFamily={openingsTargetFamily}
          />
        )}
        {page === "Endgames" && (
          <EndgameLab
            games={games}
            onBackToDashboard={() => setPage("Dashboard")}
            onOpenAnalysis={openAnalysisForGame}
          />
        )}
        {page !== "Dashboard" && page !== "My Games" && page !== "Analysis" && page !== "Train" && page !== "Review Queue" && page !== "Settings" && page !== "Analytics" && page !== "Openings" && page !== "Endgames" && (
          <PlaceholderView page={page} onImport={() => setShowImport(true)} onNavigate={setPage}/>
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

export default App;
