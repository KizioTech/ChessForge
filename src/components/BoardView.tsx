import { useEffect, useRef, useState, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

interface BoardViewProps {
  game: Chess;
  orientation?: "white" | "black";
  onMove?: (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => void;
  interactive?: boolean;
}

function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  chess.moves({ verbose: true }).forEach(m => {
    const from = m.from as Key;
    const to = m.to as Key;
    const current = dests.get(from);
    if (current) current.push(to);
    else dests.set(from, [to]);
  });
  return dests;
}

export function BoardView({
  game,
  orientation = "white",
  onMove,
  interactive = true
}: BoardViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const handleMove = useCallback((orig: Key, dest: Key) => {
    const from = orig as Square;
    const to = dest as Square;
    const piece = game.get(from);

    // Check if this move is a pawn promotion
    const isPawn = piece?.type === "p";
    const isPromotingRank = (piece?.color === "w" && to.endsWith("8")) || (piece?.color === "b" && to.endsWith("1"));

    if (isPawn && isPromotingRank) {
      setPendingPromotion({ from, to });
      return;
    }

    if (onMove) {
      onMove(from, to);
    }
  }, [game, onMove]);

  // Initialize or reconfigure Chessground
  useEffect(() => {
    if (!containerRef.current) return;

    const turn = game.turn() === "w" ? "white" : "black";
    const dests = interactive ? toDests(game) : new Map<Key, Key[]>();

    if (!cgRef.current) {
      cgRef.current = Chessground(containerRef.current, {
        fen: game.fen(),
        orientation,
        turnColor: turn,
        check: game.inCheck(),
        movable: {
          free: false,
          color: interactive && !game.isGameOver() ? turn : undefined,
          dests,
          events: {
            after: handleMove
          }
        },
        premovable: { enabled: false },
        highlight: {
          lastMove: true,
          check: true
        },
        animation: {
          enabled: true,
          duration: 180
        },
        drawable: {
          enabled: true,         // allow user drawings
          visible: true,
          defaultSnapToValidMove: true,
          eraseOnClick: true,    // left-click clears all shapes
          brushes: {
            green:  { key: "g", color: "#15781B", opacity: 0.8, lineWidth: 10 },
            red:    { key: "r", color: "#882020", opacity: 0.8, lineWidth: 10 },
            blue:   { key: "b", color: "#003088", opacity: 0.8, lineWidth: 10 },
            yellow: { key: "y", color: "#e68f00", opacity: 0.8, lineWidth: 10 },
          }
        }
      });
    } else {
      cgRef.current.set({
        fen: game.fen(),
        orientation,
        turnColor: turn,
        check: game.inCheck(),
        movable: {
          color: interactive && !game.isGameOver() ? turn : undefined,
          dests,
          events: {
            after: handleMove
          }
        }
      });
    }
  }, [game, orientation, interactive, handleMove]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, []);

  function selectPromotion(piece: "q" | "r" | "b" | "n") {
    if (pendingPromotion && onMove) {
      onMove(pendingPromotion.from, pendingPromotion.to, piece);
    }
    setPendingPromotion(null);
  }

  return (
    <div
      className="board-container"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "560px",
        minWidth: "260px",
        aspectRatio: "1 / 1",
        display: "flex"
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "4px",
          overflow: "hidden"
        }}
      />

      {pendingPromotion && (
        <div
          className="promotion-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(16, 24, 32, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            zIndex: 10
          }}
        >
          <strong style={{ fontSize: "14px", color: "var(--text)" }}>Promote pawn to:</strong>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { piece: "q" as const, label: "Queen", glyph: game.turn() === "w" ? "♕" : "♛" },
              { piece: "r" as const, label: "Rook", glyph: game.turn() === "w" ? "♖" : "♜" },
              { piece: "b" as const, label: "Bishop", glyph: game.turn() === "w" ? "♗" : "♝" },
              { piece: "n" as const, label: "Knight", glyph: game.turn() === "w" ? "♘" : "♞" }
            ].map(p => (
              <button
                key={p.piece}
                className="button button-secondary"
                style={{ width: "56px", height: "56px", fontSize: "28px" }}
                onClick={() => selectPromotion(p.piece)}
                title={p.label}
              >
                {p.glyph}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual Presentation for Checkmate */}
      {game.isCheckmate() && (
        <div className="board-game-over-banner checkmate-banner" role="status" aria-live="polite">
          <span className="game-over-title">CHECKMATE</span>
          <span className="game-over-sub">{game.turn() === "w" ? "Black" : "White"} wins by checkmate</span>
        </div>
      )}

      {/* Visual Presentation for Stalemate / Draw */}
      {(game.isStalemate() || (game.isDraw() && !game.isCheckmate())) && (
        <div className="board-game-over-banner stalemate-banner" role="status" aria-live="polite">
          <span className="game-over-title">{game.isStalemate() ? "STALEMATE" : "DRAW"}</span>
          <span className="game-over-sub">{game.isStalemate() ? "Draw by stalemate" : "Game drawn"}</span>
        </div>
      )}
    </div>
  );
}

