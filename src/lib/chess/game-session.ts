import { Chess, type Square } from "chess.js";

export interface GameOutcome {
  result: "1-0" | "0-1" | "1/2-1/2";
  termination: string;
}

export function cloneGame(game: Chess): Chess {
  const copy = new Chess();
  const pgn = game.pgn();
  if (pgn.trim()) copy.loadPgn(pgn, { strict: false });
  return copy;
}

export function playLegalMove(
  game: Chess,
  from: Square,
  to: Square,
  promotion?: "q" | "r" | "b" | "n"
): Chess {
  const next = cloneGame(game);
  next.move({ from, to, promotion });
  return next;
}

export function getGameOutcome(game: Chess): GameOutcome | null {
  if (game.isCheckmate()) {
    return { result: game.turn() === "w" ? "0-1" : "1-0", termination: "checkmate" };
  }
  if (game.isStalemate()) return { result: "1/2-1/2", termination: "stalemate" };
  if (game.isDraw()) return { result: "1/2-1/2", termination: "draw" };
  return null;
}

export function getFlagFallOutcome(game: Chess, flaggedSide: "white" | "black"): GameOutcome {
  if (game.isInsufficientMaterial()) {
    return { result: "1/2-1/2", termination: "time forfeit — insufficient mating material" };
  }
  return {
    result: flaggedSide === "white" ? "0-1" : "1-0",
    termination: "time forfeit"
  };
}

export function createGamePgn(
  game: Chess,
  options: {
    white: string;
    black: string;
    result: GameOutcome["result"];
    termination: string;
    timeControl: string;
    date?: Date;
  }
): string {
  const copy = cloneGame(game);
  const safeName = (name: string) => name.replace(/[\r\n\[\]"]/g, "").trim().slice(0, 40) || "Player";
  const date = options.date ?? new Date();
  const pgnDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  const headers: Array<[string, string]> = [
    ["Event", "Casual Local Game"],
    ["Site", "ChessForge"],
    ["Date", pgnDate],
    ["Round", "-"],
    ["White", safeName(options.white)],
    ["Black", safeName(options.black)],
    ["Result", options.result],
    ["TimeControl", options.timeControl],
    ["Termination", options.termination]
  ];
  headers.forEach(([key, value]) => copy.setHeader(key, value));
  return copy.pgn({ maxWidth: 80 });
}

export function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  if (minutes < 60) return `${String(minutes).padStart(2, "0")}:${remainder}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`;
}
