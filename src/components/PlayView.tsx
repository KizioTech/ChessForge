import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowDownRight, Check, Clock3, Flag, Handshake, RotateCcw, Save, Swords } from "lucide-react";
import { BoardView } from "./BoardView";
import type { GameRecord } from "../lib/games";
import { parsePgn } from "../lib/pgn-parser";
import { saveParsedGames } from "../lib/games";
import { createGamePgn, formatClock, getFlagFallOutcome, getGameOutcome, playLegalMove, type GameOutcome } from "../lib/chess/game-session";

const TIME_CONTROLS = [
  { label: "Untimed", initialMs: 0, incrementSeconds: 0 },
  { label: "3 + 2", initialMs: 180_000, incrementSeconds: 2 },
  { label: "5 + 3", initialMs: 300_000, incrementSeconds: 3 },
  { label: "10 + 0", initialMs: 600_000, incrementSeconds: 0 }
] as const;

type TimeControl = (typeof TIME_CONTROLS)[number];

interface PlayViewProps {
  userId?: string | null;
  playerName: string;
  onOpenAnalysis: (game: GameRecord) => void;
}

const initialClocks = (milliseconds: number) => ({ white: milliseconds, black: milliseconds });

export function PlayView({ userId, playerName, onOpenAnalysis }: PlayViewProps) {
  const [game, setGame] = useState(() => new Chess());
  const gameRef = useRef(game);
  const [timeControl, setTimeControl] = useState<TimeControl>(TIME_CONTROLS[2]);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [whiteName, setWhiteName] = useState("Player 1");
  const [blackName, setBlackName] = useState("Player 2");
  const [flipped, setFlipped] = useState(false);
  const [clocks, setClocks] = useState(() => initialClocks(TIME_CONTROLS[2].initialMs));
  const clocksRef = useRef(clocks);
  const lastTickRef = useRef(Date.now());
  const [gameStarted, setGameStarted] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [saveMessage, setSaveMessage] = useState("Waiting for a result");
  const [savedGame, setSavedGame] = useState<GameRecord | null>(null);
  const finalizedRef = useRef(false);

  const finishGame = useCallback(async (finalOutcome: GameOutcome) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setOutcome(finalOutcome);
    setGameActive(false);
    setGameStarted(true);
    setSaveMessage("Saving game to your library…");

    try {
      const pgn = createGamePgn(gameRef.current, {
        white: whiteName,
        black: blackName,
        result: finalOutcome.result,
        termination: finalOutcome.termination,
        timeControl: timeControl.initialMs
          ? `${timeControl.initialMs / 1000}+${timeControl.incrementSeconds}`
          : "-"
      });
      const parsed = await parsePgn(pgn, playerName);
      if (parsed.errors.length || parsed.games.length !== 1) {
        throw new Error(parsed.errors[0]?.error || "The finished game could not be validated as PGN.");
      }
      const saved = await saveParsedGames(parsed.games, "upload", userId);
      const record = saved.saved[0];
      if (!record) {
        setSaveMessage(saved.duplicates.length ? "This exact game is already in your library." : "Game could not be saved.");
        return;
      }
      setSavedGame(record);
      setSaveMessage("Game saved to My Games");
    } catch (error) {
      setSaveMessage(`Could not save this game: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [blackName, playerName, timeControl, userId, whiteName]);

  useEffect(() => {
    if (!gameActive || outcome || !timeControl.initialMs) return;
    lastTickRef.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const side = gameRef.current.turn() === "w" ? "white" : "black";
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;
      const next = { ...clocksRef.current, [side]: Math.max(0, clocksRef.current[side] - elapsed) };
      clocksRef.current = next;
      setClocks(next);
      if (next[side] <= 0) {
        void finishGame(getFlagFallOutcome(gameRef.current, side));
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [finishGame, gameActive, outcome, timeControl]);

  const resetGame = () => {
    const freshGame = new Chess();
    gameRef.current = freshGame;
    setGame(freshGame);
    const freshClocks = initialClocks(timeControl.initialMs);
    clocksRef.current = freshClocks;
    setClocks(freshClocks);
    setOutcome(null);
    setGameStarted(false);
    setGameActive(false);
    setSavedGame(null);
    setSaveMessage("Waiting for a result");
    finalizedRef.current = false;
    lastTickRef.current = Date.now();
  };

  const handleMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    if (!gameActive || outcome) return;
    const movingSide = gameRef.current.turn() === "w" ? "white" : "black";
    const now = Date.now();
    if (timeControl.initialMs) {
      const elapsed = now - lastTickRef.current;
      const remaining = Math.max(0, clocksRef.current[movingSide] - elapsed);
      if (remaining <= 0) {
        const flaggedClocks = { ...clocksRef.current, [movingSide]: 0 };
        clocksRef.current = flaggedClocks;
        setClocks(flaggedClocks);
        void finishGame(getFlagFallOutcome(gameRef.current, movingSide));
        return;
      }
      const nextClocks = {
        ...clocksRef.current,
        [movingSide]: remaining + timeControl.incrementSeconds * 1000
      };
      clocksRef.current = nextClocks;
      setClocks(nextClocks);
    }
    lastTickRef.current = now;

    try {
      const next = playLegalMove(gameRef.current, from, to, promotion);
      gameRef.current = next;
      setGame(next);
      const terminal = getGameOutcome(next);
      if (terminal) void finishGame(terminal);
    } catch {
      // Chessground only dispatches legal moves; an invalid move is ignored defensively.
    }
  };

  const startOrResume = () => {
    if (outcome) return;
    setGameStarted(true);
    lastTickRef.current = Date.now();
    setGameActive(true);
  };

  const history = game.history({ verbose: true });
  const movePairs = Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => ({
    number: index + 1,
    white: history[index * 2],
    black: history[index * 2 + 1]
  }));
  const orientation = flipped ? (playerSide === "white" ? "black" : "white") : playerSide;
  const visibleName = game.turn() === "w" ? whiteName : blackName;

  return (
    <div className="content play-content">
      <header className="play-heading">
        <div>
          <div className="eyebrow"><Swords size={13} /> CASUAL PLAY</div>
          <h1>Play a game</h1>
          <p className="subheading">A private, local two-player board. Games save to your library when they finish.</p>
        </div>
        <button className="button button-secondary" onClick={resetGame}><RotateCcw size={14} /> New game</button>
      </header>

      <div className="play-layout">
        <section className="panel play-board-panel">
          <div className={`play-player-card ${game.turn() === "b" && gameActive ? "is-turn" : ""}`}>
            <span className="play-piece black-piece" aria-hidden="true">♚</span>
            <div className="play-player-name"><strong>{blackName}</strong><span>Black</span></div>
            <div className={`play-clock ${game.turn() === "b" && gameActive ? "clock-active" : ""}`} aria-label={`Black clock ${formatClock(clocks.black)}`}>
              {timeControl.initialMs ? formatClock(clocks.black) : "— —"}
            </div>
          </div>
          <div className="play-board-stage">
            <BoardView
              game={game}
              orientation={orientation}
              onMove={handleMove}
              interactive={gameActive && !outcome}
              lastMove={history.length ? [history[history.length - 1].from, history[history.length - 1].to] : null}
            />
          </div>
          <div className={`play-player-card ${game.turn() === "w" && gameActive ? "is-turn" : ""}`}>
            <span className="play-piece white-piece" aria-hidden="true">♔</span>
            <div className="play-player-name"><strong>{whiteName}</strong><span>White</span></div>
            <div className={`play-clock ${game.turn() === "w" && gameActive ? "clock-active" : ""}`} aria-label={`White clock ${formatClock(clocks.white)}`}>
              {timeControl.initialMs ? formatClock(clocks.white) : "— —"}
            </div>
          </div>
          <div className="play-controls">
            <button className="icon-btn" onClick={() => setFlipped(value => !value)} title="Flip board"><ArrowDownRight size={15} /></button>
            <span className="play-status" role="status" aria-live="polite">
              {outcome ? `${outcome.result} · ${outcome.termination}` : gameActive ? `${visibleName} to move` : gameStarted ? "Game paused" : "Ready when you are"}
            </span>
            {gameActive ? (
              <button className="button button-secondary button-small" onClick={() => setGameActive(false)}>Pause</button>
            ) : !outcome ? (
              <button className="button button-primary button-small" onClick={startOrResume}>{gameStarted ? "Resume" : "Start game"}</button>
            ) : null}
          </div>
          {outcome && (
            <div className="play-result" role="status">
              <div><Check size={15} /><strong>{outcome.result === "1/2-1/2" ? "Game drawn" : `${outcome.result === "1-0" ? whiteName : blackName} wins`}</strong></div>
              <span>{saveMessage}</span>
              {savedGame && <button className="button button-primary button-small" onClick={() => onOpenAnalysis(savedGame)}><Save size={13} /> Review game</button>}
            </div>
          )}
        </section>

        <aside className="play-side-panel">
          <section className="panel play-setup-panel">
            <div className="eyebrow"><Clock3 size={13} /> GAME SETUP</div>
            <label className="play-field">Time control
              <select value={timeControl.label} disabled={gameStarted && !outcome} onChange={event => {
                const next = TIME_CONTROLS.find(control => control.label === event.target.value) ?? TIME_CONTROLS[2];
                setTimeControl(next);
                const nextClocks = initialClocks(next.initialMs);
                clocksRef.current = nextClocks;
                setClocks(nextClocks);
              }}>
                {TIME_CONTROLS.map(control => <option key={control.label} value={control.label}>{control.label}</option>)}
              </select>
            </label>
            <label className="play-field">Your side of the board
              <select value={playerSide} disabled={gameStarted && !outcome} onChange={event => setPlayerSide(event.target.value as "white" | "black")}>
                <option value="white">White at bottom</option><option value="black">Black at bottom</option>
              </select>
            </label>
            <label className="play-field">White player
              <input value={whiteName} maxLength={40} disabled={gameStarted && !outcome} onChange={event => setWhiteName(event.target.value)} />
            </label>
            <label className="play-field">Black player
              <input value={blackName} maxLength={40} disabled={gameStarted && !outcome} onChange={event => setBlackName(event.target.value)} />
            </label>
            <div className="play-seat-note">Moves are made locally by the player whose turn it is. No engine hints are shown during play.</div>
          </section>

          <section className="panel play-moves-panel">
            <div className="play-panel-heading"><div><div className="eyebrow">SCORE SHEET</div><h2>Moves</h2></div><span>{history.length} plies</span></div>
            {movePairs.length === 0 ? <p className="play-empty-moves">Your move list will appear here.</p> : (
              <div className="play-move-list" aria-label="Game moves">
                {movePairs.map(pair => <div className="play-move-row" key={pair.number}>
                  <span>{pair.number}.</span><strong>{pair.white?.san ?? "…"}</strong><strong>{pair.black?.san ?? ""}</strong>
                </div>)}
              </div>
            )}
            {gameActive && (
              <div className="play-end-actions">
                <button className="button button-secondary button-small" onClick={() => void finishGame({ result: "1/2-1/2", termination: "draw agreed" })}><Handshake size={13} /> Agree draw</button>
                <button className="button button-secondary button-small" onClick={() => void finishGame({ result: playerSide === "white" ? "0-1" : "1-0", termination: "resignation" })}><Flag size={13} /> Resign</button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
