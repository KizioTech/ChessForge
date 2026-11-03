import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight,
  ArrowUpRight, BarChart3, BookOpen, Brain, CalendarClock, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, CloudDownload,
  Command, Crosshair, Crown, Database, FileUp, Filter, Flame, FolderOpen,
  Gauge, LayoutDashboard, Menu, MoreHorizontal, PanelLeftClose, Play,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Target, Trophy, Upload,
  X, Zap, LogIn, LogOut, User as UserIcon, Undo2
} from "lucide-react";
import type { Page } from "./types";
import { BoardView } from "./components/BoardView";
import { AuthModal } from "./components/AuthModal";
import { ImportDialog } from "./components/ImportDialog";
import { GameLibrary } from "./components/GameLibrary";
import { Sidebar } from "./components/Sidebar";
import { useAuth } from "./lib/auth";
import { getGames, deleteGame, type GameRecord } from "./lib/games";

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
  const [showAuthModal, setShowAuthModal] = useState(false);
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

  const refreshGames = useCallback(() => {
    getGames(user?.id).then(setGames);
  }, [user?.id]);

  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  function openAnalysisForGame(gameRecord: GameRecord) {
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
  }

  function handleClearActiveGame() {
    setActiveGame(null);
    setMoves([]);
    setHistoryIndex(0);
    setSelected(null);
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

  // Keyboard shortcuts: ← / → navigate, Ctrl+Z undo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in an input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowLeft")  { e.preventDefault(); goToMove(historyIndex - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); goToMove(historyIndex + 1); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undoMove(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex, moves]);

  const movePairs = [];
  for (let i=0; i<history.length; i+=2) movePairs.push({ n: i/2+1, white: history[i], black: history[i+1] });

  const userInitials = (profile?.display_name || user?.email || "JM")
    .slice(0, 2)
    .toUpperCase();
  const userDisplayName = profile?.display_name || user?.email?.split("@")[0] || "My ChessForge";

  return <div className="app-shell">
    <header className="titlebar">
      <div className="titlebar-brand"><div className="brand-mark"><ChessKnight size={18}/></div><span>CHESSFORGE</span><span className="brand-divider">/</span><span className="titlebar-context">{page}</span></div>
      <div className="titlebar-center"><span className="status-dot"/> Personal workspace <span className="titlebar-sep">·</span> {user ? user.email : "Local session"}</div>
      <div className="titlebar-actions">
        {user ? (
          <button className="button button-secondary button-small" onClick={() => signOut()} title="Sign out">
            <LogOut size={13} /> Sign out
          </button>
        ) : (
          <button className="button button-primary button-small" onClick={() => setShowAuthModal(true)} title="Sign in">
            <LogIn size={13} /> Sign in
          </button>
        )}
        <button className="icon-btn" title="Help"><CircleHelp size={15}/></button>
        <button className="icon-btn" title="Settings" onClick={() => setPage("Analytics")}><Settings2 size={15}/></button>
        <div className="avatar" title={user?.email || "Local session"}>{userInitials}</div>
      </div>
    </header>

    <div className="app-body">
      <Sidebar
        page={page}
        onNavigate={setPage}
        user={user}
        profile={profile}
        onOpenAuth={() => setShowAuthModal(true)}
        isOpen={sidebarOpen}
      />

      <main className="main-area">
        <div className="page-toolbar">
          <div className="toolbar-left"><button className="icon-btn collapse-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar"><PanelLeftClose size={16}/></button><span className="breadcrumb">Workspace</span><ChevronRight size={13}/><strong>{page}</strong></div>
          <div className="toolbar-right">
            <div className="search-box"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ChessForge"/><kbd>⌘ K</kbd></div>
            <button className="button button-secondary" onClick={() => setShowImport(true)}><Upload size={14}/> Import games</button>
          </div>
        </div>

        {page === "Dashboard" && <Dashboard games={games} onNavigate={setPage} onImport={() => setShowImport(true)} onOpenAnalysis={openAnalysisForGame}/>}
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
          />
        )}
        {page !== "Dashboard" && page !== "My Games" && page !== "Analysis" && <Placeholder page={page} onImport={() => setShowImport(true)} onNavigate={setPage}/>}
      </main>
    </div>
    <ImportDialog
      isOpen={showImport}
      onClose={() => setShowImport(false)}
      onImportComplete={refreshGames}
      onNavigateToGames={() => setPage("My Games")}
    />
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
  </div>;
}

function Dashboard({
  games,
  onNavigate,
  onImport,
  onOpenAnalysis
}: {
  games: GameRecord[];
  onNavigate: (p: Page) => void;
  onImport: () => void;
  onOpenAnalysis: (g: GameRecord) => void;
}) {
  const recentGames = games.slice(0, 3);
  return <div className="content dashboard-content">
    <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13}/> YOUR TRAINING DESK</div><h1>Good afternoon.</h1><p className="subheading">A clearer picture of your chess. One decision at a time.</p></div><div className="date-chip"><CalendarClock size={14}/> Tuesday, 3 November 2026</div></div>
    <div className="stat-grid">
      <StatCard label="CHESS.COM RAPID" value="1,205" change="Starting baseline" icon={<Gauge size={16}/>} tone="lime"/>
      <StatCard
        label="GAMES IN LIBRARY"
        value={games.length > 0 ? `${games.length}` : "—"}
        change={games.length > 0 ? "Ready for review" : "Import games to begin"}
        icon={<Activity size={16}/>}
        tone={games.length > 0 ? "lime" : undefined}
      />
      <StatCard label="REVIEW POSITIONS" value="—" change="No review data yet" icon={<Target size={16}/>} />
      <StatCard label="TRAINING STREAK" value="0 days" change="Your first session awaits" icon={<Flame size={16}/>} />
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
        <div className="panel-head"><div><div className="eyebrow">YOUR FOCUS</div><h2>What we know so far</h2></div><button className="icon-btn"><MoreHorizontal size={17}/></button></div>
        {games.length >= 20 ? (
          <div className="empty-insight">
            <div className="insight-icon"><Brain size={19}/></div>
            <strong>{games.length} games imported!</strong>
            <p>Baseline sample met. In Phase 3, Stockfish engine analysis will evaluate these games to diagnose your recurring errors.</p>
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
        <div className="focus-footer"><ShieldCheck size={14}/> Recommendations will be based on your own games.</div>
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
  onClearActiveGame
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
}) {
  return <div className="content analysis-content">
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
        <button className="button button-secondary"><MoreHorizontal size={15}/> Options</button>
        <button className="button button-primary"><Sparkles size={14}/> Analyse game</button>
      </div>
    </div>
    <div className="analysis-meta panel">
      <div className="player">
        <div className="player-avatar white-avatar">W</div>
        <div>
          <strong>{activeGame ? activeGame.white : "White"}</strong>
          <span>{activeGame ? (activeGame.white_elo ? `${activeGame.white_elo} Elo` : "Unrated") : "Free position"}</span>
        </div>
      </div>
      <span className="versus">VS</span>
      <div className="player">
        <div className="player-avatar black-avatar">B</div>
        <div>
          <strong>{activeGame ? activeGame.black : "Black"}</strong>
          <span>{activeGame ? (activeGame.black_elo ? `${activeGame.black_elo} Elo` : "Unrated") : "Free position"}</span>
        </div>
      </div>
      <div className="meta-divider"/>
      <div className="meta-item"><Clock3 size={14}/> {activeGame ? `${activeGame.time_class || "Game"} · ${activeGame.time_control || "No clock"}` : "Untimed"}</div>
      <div className="meta-item"><CalendarClock size={14}/> {activeGame ? (activeGame.played_at ? new Date(activeGame.played_at).toLocaleDateString() : (activeGame.termination || "Finished")) : "Local board"}</div>
      <span className="sample-label" style={{ color: activeGame ? "var(--lime)" : "var(--muted)", fontWeight: activeGame ? 600 : 400 }}>
        {activeGame ? (activeGame.user_colour && activeGame.user_colour !== "unknown" ? `YOU PLAYED ${activeGame.user_colour.toUpperCase()}` : activeGame.result) : "FREE ANALYSIS"}
      </span>
    </div>
    <div className="analysis-layout">
      <section className="board-panel panel">
        <div className="board-topline">
          <span><span className="live-dot"/> BOARD</span>
          <span className="turn-label">
            {game.isCheckmate() ? (
              <span className="status-pill status-checkmate" style={{ color: "#ff5252", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Crown size={13} /> CHECKMATE · {game.turn() === "w" ? "Black" : "White"} wins
              </span>
            ) : game.isStalemate() || (game.isDraw() && !game.isCheckmate()) ? (
              <span className="status-pill status-draw" style={{ color: "#fbbf24", fontWeight: 600 }}>
                DRAW · {game.isStalemate() ? "Stalemate" : "Drawn game"}
              </span>
            ) : game.inCheck() ? (
              <span className="status-pill status-check" style={{ color: "#ff5252", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <AlertTriangle size={13} /> {game.turn() === "w" ? "White" : "Black"} in check
              </span>
            ) : (
              `${game.turn() === "w" ? "White" : "Black"} to move`
            )}
          </span>
        </div>
        <div className="board-stage"><EvaluationRail/><BoardView game={game} orientation={orientation} onMove={onMove}/></div>
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
      </section>
      <aside className="analysis-side">
        <section className="panel evaluation-panel"><div className="panel-head"><div><div className="eyebrow">ENGINE EVALUATION</div><h2>Position assessment</h2></div><span className="engine-badge"><span className="status-muted"/> Offline</span></div><div className="eval-main"><span className="eval-score">—</span><span className="eval-caption">Stockfish not connected</span></div><div className="engine-placeholder"><Zap size={15}/><span>Connect the local engine to calculate evaluations and candidate lines.</span></div><div className="engine-settings"><span>Depth <b>—</b></span><span>MultiPV <b>—</b></span><span>Engine <b>Stockfish</b></span></div></section>
        <section className="panel moves-panel"><div className="panel-head"><div><div className="eyebrow">NOTATION</div><h2>Moves</h2></div><span className="move-count">{history.length} plies</span></div>
          {history.length===0 ? <div className="moves-empty"><div className="moves-empty-board">♟</div><strong>Ready for a game</strong><p>Make legal moves on the board or import a PGN to review a real game.</p></div> :
            <div className="move-list">{movePairs.map((pair:any,i:number)=><div className="move-row" key={pair.n}><span className="move-number">{pair.n}.</span><button className={historyIndex===i*2+1?"move-active":""} onClick={()=>goToMove(i*2+1)}>{pair.white?.san||"—"}</button><button className={historyIndex===i*2+2?"move-active":""} onClick={()=>goToMove(i*2+2)}>{pair.black?.san||""}</button></div>)}</div>}
        </section>
        <section className="panel lesson-panel"><div className="panel-head"><div><div className="eyebrow">LEARNING NOTES</div><h2>What to look for</h2></div><Brain size={16} className="muted"/></div><div className="lesson-empty"><Sparkles size={15}/><span>After engine analysis, ChessForge will explain critical moments and suggest positions worth practising.</span></div></section>
      </aside>
    </div>
    <div className="analysis-footnote"><ShieldCheck size={13}/> This is a local interface preview. No live-game assistance or engine evaluation is active.</div>
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
