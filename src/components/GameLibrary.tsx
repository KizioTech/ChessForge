import React, { useState, useMemo, useEffect } from "react";
import {
  FolderOpen,
  Search,
  Filter,
  Upload,
  Calendar,
  Clock,
  ExternalLink,
  Trash2,
  Trophy,
  Activity,
  ArrowUpDown,
  ChevronDown,
  RefreshCw
} from "lucide-react";
import type { GameRecord } from "../lib/games";

const PAGE_SIZE = 10;

interface GameLibraryProps {
  games: GameRecord[];
  onImport: () => void;
  onOpenAnalysis: (game: GameRecord) => void;
  onDeleteGame?: (id: string) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function GameLibrary({
  games,
  onImport,
  onOpenAnalysis,
  onDeleteGame,
  onSync,
  isSyncing
}: GameLibraryProps) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [timeClassFilter, setTimeClassFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when search or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, platformFilter, colorFilter, resultFilter, timeClassFilter, sortOrder]);

  const filteredGames = useMemo(() => {
    return games
      .filter(g => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchWhite = g.white.toLowerCase().includes(q);
          const matchBlack = g.black.toLowerCase().includes(q);
          const matchTermination = g.termination?.toLowerCase().includes(q);
          if (!matchWhite && !matchBlack && !matchTermination) return false;
        }

        // Platform filter
        if (platformFilter !== "all" && g.platform !== platformFilter) {
          return false;
        }

        // Color filter
        if (colorFilter !== "all" && g.user_colour !== colorFilter) {
          return false;
        }

        // Result filter
        if (resultFilter !== "all") {
          const isWin =
            (g.user_colour === "white" && g.result === "1-0") ||
            (g.user_colour === "black" && g.result === "0-1");
          const isLoss =
            (g.user_colour === "white" && g.result === "0-1") ||
            (g.user_colour === "black" && g.result === "1-0");
          const isDraw = g.result === "1/2-1/2";

          if (resultFilter === "win" && !isWin) return false;
          if (resultFilter === "loss" && !isLoss) return false;
          if (resultFilter === "draw" && !isDraw) return false;
        }

        // Time class filter
        if (timeClassFilter !== "all" && g.time_class !== timeClassFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.played_at ? new Date(a.played_at).getTime() : 0;
        const dateB = b.played_at ? new Date(b.played_at).getTime() : 0;
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      });
  }, [games, search, platformFilter, colorFilter, resultFilter, timeClassFilter, sortOrder]);

  function getResultBadge(g: GameRecord) {
    if (g.user_colour === "unknown") {
      return (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            background: "var(--raised)",
            color: "var(--text)",
            fontSize: "11px",
            fontWeight: 600
          }}
        >
          {g.result}
        </span>
      );
    }

    const isWin =
      (g.user_colour === "white" && g.result === "1-0") ||
      (g.user_colour === "black" && g.result === "0-1");
    const isLoss =
      (g.user_colour === "white" && g.result === "0-1") ||
      (g.user_colour === "black" && g.result === "1-0");

    if (isWin) {
      return (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            background: "rgba(183, 227, 106, 0.15)",
            color: "var(--lime)",
            fontSize: "11px",
            fontWeight: 700
          }}
        >
          WIN
        </span>
      );
    }

    if (isLoss) {
      return (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            background: "rgba(216, 117, 112, 0.15)",
            color: "var(--red)",
            fontSize: "11px",
            fontWeight: 700
          }}
        >
          LOSS
        </span>
      );
    }

    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "4px",
          background: "rgba(251, 191, 36, 0.15)",
          color: "#fbbf24",
          fontSize: "11px",
          fontWeight: 700
        }}
      >
        DRAW
      </span>
    );
  }

  function getOpponentText(g: GameRecord) {
    if (g.user_colour === "white") {
      return {
        opponent: g.black,
        opponentElo: g.black_elo,
        userElo: g.white_elo,
        as: "vs"
      };
    }
    if (g.user_colour === "black") {
      return {
        opponent: g.white,
        opponentElo: g.white_elo,
        userElo: g.black_elo,
        as: "vs"
      };
    }
    return {
      opponent: `${g.white} vs ${g.black}`,
      opponentElo: undefined,
      userElo: undefined,
      as: ""
    };
  }

  return (
    <div className="content" style={{ maxWidth: "1200px" }}>
      {/* Heading */}
      <div className="welcome-row" style={{ marginBottom: "20px" }}>
        <div>
          <div className="eyebrow">
            <FolderOpen size={13} /> GAME REPOSITORY
          </div>
          <h1>My Games</h1>
          <p className="subheading">
            {games.length} game{games.length === 1 ? "" : "s"} imported and ready for analysis and training.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {onSync && (
            <button
              className="button button-secondary"
              onClick={onSync}
              disabled={isSyncing}
              title="Check connected Chess.com and Lichess accounts for new games"
            >
              <RefreshCw size={14} className={isSyncing ? "spin" : ""} />
              {isSyncing ? "Syncing…" : "Sync games"}
            </button>
          )}
          <button className="button button-primary" onClick={onImport}>
            <Upload size={14} /> Import games
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{
          padding: "14px 18px",
          marginBottom: "16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
          justifyContent: "space-between"
        }}
      >
        {/* Search */}
        <div className="search-box" style={{ width: "240px" }}>
          <Search size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search opponent..."
          />
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          {/* Platform */}
          <select
            className="select-button"
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            style={{ height: "30px", background: "var(--raised)", border: "1px solid var(--line)" }}
          >
            <option value="all">All platforms</option>
            <option value="chesscom">Chess.com</option>
            <option value="lichess">Lichess</option>
            <option value="upload">Upload</option>
          </select>

          {/* Color */}
          <select
            className="select-button"
            value={colorFilter}
            onChange={e => setColorFilter(e.target.value)}
            style={{ height: "30px", background: "var(--raised)", border: "1px solid var(--line)" }}
          >
            <option value="all">All colors</option>
            <option value="white">As White</option>
            <option value="black">As Black</option>
          </select>

          {/* Result */}
          <select
            className="select-button"
            value={resultFilter}
            onChange={e => setResultFilter(e.target.value)}
            style={{ height: "30px", background: "var(--raised)", border: "1px solid var(--line)" }}
          >
            <option value="all">All results</option>
            <option value="win">Wins only</option>
            <option value="loss">Losses only</option>
            <option value="draw">Draws only</option>
          </select>

          {/* Speed / TimeClass */}
          <select
            className="select-button"
            value={timeClassFilter}
            onChange={e => setTimeClassFilter(e.target.value)}
            style={{ height: "30px", background: "var(--raised)", border: "1px solid var(--line)" }}
          >
            <option value="all">All speeds</option>
            <option value="Bullet">Bullet</option>
            <option value="Blitz">Blitz</option>
            <option value="Rapid">Rapid</option>
            <option value="Classical">Classical</option>
            <option value="Daily">Daily</option>
          </select>

          {/* Sort order toggle */}
          <button
            className="icon-btn"
            onClick={() => setSortOrder(prev => (prev === "newest" ? "oldest" : "newest"))}
            title={sortOrder === "newest" ? "Sorting newest first" : "Sorting oldest first"}
          >
            <ArrowUpDown size={15} />
          </button>
        </div>
      </div>

      {/* Games List or Empty State */}
      {games.length === 0 ? (
        <div className="panel" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div className="insight-icon" style={{ margin: "0 auto 16px" }}>
            <FolderOpen size={24} style={{ color: "var(--lime)" }} />
          </div>
          <strong style={{ fontSize: "16px", display: "block", marginBottom: "8px" }}>
            No games in your library yet
          </strong>
          <p style={{ fontSize: "12px", color: "var(--muted)", maxWidth: "420px", margin: "0 auto 20px" }}>
            Import a PGN file with games from Chess.com, Lichess, or your local archive to begin reviewing your play and diagnosing weaknesses.
          </p>
          <button className="button button-primary" onClick={onImport}>
            <Upload size={14} /> Import your first games
          </button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="panel" style={{ padding: "32px", textAlign: "center" }}>
          <strong style={{ fontSize: "13px", color: "var(--muted)" }}>
            No games match your current search and filters.
          </strong>
          <div style={{ marginTop: "12px" }}>
            <button
              className="button button-secondary button-small"
              onClick={() => {
                setSearch("");
                setPlatformFilter("all");
                setColorFilter("all");
                setResultFilter("all");
                setTimeClassFilter("all");
              }}
            >
              Reset filters
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredGames.slice(0, visibleCount).map(g => {
            const opp = getOpponentText(g);
            return (
              <div
                key={g.id}
                className="panel"
                style={{
                  padding: "12px 18px",
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 140px 100px 140px",
                  alignItems: "center",
                  gap: "14px",
                  transition: "background .15s",
                  cursor: "pointer"
                }}
                onClick={() => onOpenAnalysis(g)}
              >
                {/* Result Pill */}
                <div>{getResultBadge(g)}</div>

                {/* Matchup */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "3px",
                        background: g.user_colour === "black" ? "#101820" : "#ffffff",
                        border: "1px solid var(--line)",
                        display: "inline-block"
                      }}
                      title={g.user_colour === "white" ? "You played White" : "You played Black"}
                    />
                    <strong style={{ fontSize: "13px", color: "var(--text)" }}>
                      {opp.opponent}
                    </strong>
                    {opp.opponentElo && (
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        ({opp.opponentElo})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
                    {g.termination || `${g.white} vs ${g.black}`}
                  </div>
                </div>

                {/* Time Control & Speed */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <Clock size={12} style={{ color: "var(--muted)" }} />
                    <span>{g.time_class || "Standard"}</span>
                    {g.time_control && (
                      <span style={{ color: "var(--muted)", fontSize: "10px" }}>
                        ({g.time_control})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "capitalize" }}>
                    {g.platform}
                  </div>
                </div>

                {/* Moves & Date */}
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text)" }}>
                    {g.moves_count} moves
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>
                    {g.played_at ? new Date(g.played_at).toLocaleDateString() : "—"}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    className="button button-secondary button-small"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenAnalysis(g);
                    }}
                    title="Open game in Analysis workspace"
                  >
                    <Activity size={13} />
                    Analyse
                  </button>
                  {onDeleteGame && (
                    <button
                      className="icon-btn"
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm("Delete this game from your library?")) {
                          onDeleteGame(g.id);
                        }
                      }}
                      title="Delete game"
                      style={{ color: "var(--muted)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* See more pagination controls */}
          {visibleCount < filteredGames.length ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "18px 0 28px" }}>
              <button
                className="button button-secondary"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                style={{ padding: "0 22px", height: "34px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <span>See more games ({filteredGames.length - visibleCount} remaining)</span>
                <ChevronDown size={14} />
              </button>
            </div>
          ) : filteredGames.length > PAGE_SIZE ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)", fontSize: "11px" }}>
              All {filteredGames.length} games displayed
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

