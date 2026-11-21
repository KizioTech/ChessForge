import React, { useEffect, useState } from "react";
import {
  Sparkles,
  CalendarClock,
  Gauge,
  Activity,
  Target,
  Flame,
  Play,
  ArrowRight,
  Brain,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  Database,
  Plus
} from "lucide-react";
import type { Page } from "../types";
import type { GameRecord } from "../lib/games";
import type { TrainingStats } from "../lib/training/training-service";
import { getWeaknessAnalysis, type WeaknessAnalysisReport } from "../lib/insight/trend-service";

interface DashboardViewProps {
  games: GameRecord[];
  trainingStats: TrainingStats;
  onNavigate: (p: Page) => void;
  onImport: () => void;
  onOpenAnalysis: (g: GameRecord) => void;
  userId?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  tone
}: {
  label: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone || ""}`}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-change">{change}</div>
    </div>
  );
}

export function DashboardView({
  games,
  trainingStats,
  onNavigate,
  onImport,
  onOpenAnalysis,
  userId
}: DashboardViewProps) {
  const recentGames = games.slice(0, 3);
  const [weakness, setWeakness] = useState<WeaknessAnalysisReport | null>(null);

  useEffect(() => {
    const totalMoves = games.reduce((sum, g) => sum + (g.moves_count || 0), 0);
    getWeaknessAnalysis(userId, games.length, totalMoves).then(setWeakness);
  }, [userId, games.length]);

  return (
    <div className="content dashboard-content">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <Sparkles size={13} /> YOUR TRAINING DESK
          </div>
          <h1>Good afternoon.</h1>
          <p className="subheading">
            A clearer picture of your chess. One decision at a time.
          </p>
        </div>
        <div className="date-chip">
          <CalendarClock size={14} /> Tuesday, 3 November 2026
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="BLUNDERS / 100 MOVES"
          value={
            weakness
              ? `${weakness.blundersPer100Moves}`
              : `${trainingStats.blundersPer100Moves || "—"}`
          }
          change={
            weakness && weakness.totalMistakes > 0
              ? `${weakness.totalMistakes} logged mistakes`
              : "Evaluate games to track"
          }
          icon={<Gauge size={16} />}
          tone={weakness && weakness.blundersPer100Moves > 3 ? undefined : "lime"}
        />
        <StatCard
          label="GAMES IN LIBRARY"
          value={games.length > 0 ? `${games.length}` : "—"}
          change={
            games.length >= 20
              ? "Baseline sample met"
              : `${games.length}/20 baseline games`
          }
          icon={<Activity size={16} />}
          tone={games.length >= 20 ? "lime" : undefined}
        />
        <StatCard
          label="REVIEW POSITIONS"
          value={
            trainingStats.dueCount > 0
              ? `${trainingStats.dueCount} due`
              : trainingStats.totalActive > 0
              ? `${trainingStats.totalActive} active`
              : "0"
          }
          change={
            trainingStats.dueCount > 0
              ? "Ready for spaced repetition"
              : trainingStats.totalActive > 0
              ? "All caught up"
              : "Analyse games to generate"
          }
          icon={<Target size={16} />}
          tone={trainingStats.dueCount > 0 ? "lime" : undefined}
        />
        <StatCard
          label="TRAINING STREAK"
          value={`${trainingStats.streakDays} days`}
          change={
            trainingStats.streakDays > 0
              ? "Habit active"
              : "Your first session awaits"
          }
          icon={<Flame size={16} />}
          tone={trainingStats.streakDays > 0 ? "lime" : undefined}
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel training-feature">
          <div className="panel-head">
            <div>
              <div className="eyebrow">NEXT BEST ACTION</div>
              <h2>Build your tactical eye</h2>
            </div>
            <span className="recommend-tag">
              <Sparkles size={12} /> Suggested start
            </span>
          </div>
          <div className="feature-body">
            <div className="mini-board">
              {[
                "♜", "", "♝", "♛", "", "♚", "", "",
                "♟", "♟", "", "", "", "♟", "♟", "",
                "", "", "♞", "", "", "", "", "",
                "", "", "♙", "", "♙", "", "", "",
                "", "", "♘", "", "", "", "", "",
                "", "♙", "", "", "", "♙", "", "♙",
                "♙", "", "", "", "♕", "", "♔", "", ""
              ]
                .slice(0, 64)
                .map((p, i) => (
                  <div
                    key={i}
                    className={(Math.floor(i / 8) + (i % 8)) % 2 === 0 ? "mini-light" : "mini-dark"}
                  >
                    {p}
                  </div>
                ))}
            </div>
            <div className="feature-copy">
              <div className="feature-kicker">
                TACTICAL CALCULATION <span>·</span> 15 MIN
              </div>
              <h3>See the forcing move.</h3>
              <p>
                Train yourself to look for checks, captures and threats before
                committing to a move.
              </p>
              <div className="feature-meta">
                <span>
                  <Target size={13} /> Pattern recognition
                </span>
                <span>
                  <Brain size={13} /> Adaptive difficulty later
                </span>
              </div>
              <button
                className="button button-primary"
                onClick={() => onNavigate("Train")}
              >
                <Play size={14} fill="currentColor" /> Start a session{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="panel focus-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">YOUR FOCUS</div>
              <h2>Weakness Diagnosis</h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => onNavigate("Analytics")}
              title="Open full analytics view"
            >
              <BarChart3 size={17} />
            </button>
          </div>
          {weakness && weakness.totalMistakes > 0 ? (
            <div className="empty-insight" style={{ textAlign: "left", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div className="insight-icon" style={{ margin: 0 }}>
                  <Brain size={19} />
                </div>
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
                {weakness.tagFrequencies
                  .filter(t => t.count > 0)
                  .slice(0, 3)
                  .map(tf => (
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
              <button
                className="button button-primary button-small"
                onClick={() => onNavigate("Analytics")}
              >
                View Weakness Breakdown <ArrowRight size={13} />
              </button>
            </div>
          ) : games.length >= 20 ? (
            <div className="empty-insight">
              <div className="insight-icon">
                <Brain size={19} />
              </div>
              <strong>{games.length} games imported!</strong>
              <p>
                Baseline sample met. Analyse your games in the Analysis tab to
                automatically identify tactical blindspots.
              </p>
              <button className="text-button" onClick={() => onNavigate("My Games")}>
                Explore your games <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            <div className="empty-insight">
              <div className="insight-icon">
                <Brain size={19} />
              </div>
              <strong>
                {games.length > 0
                  ? `${games.length} of 20 baseline games loaded`
                  : "Your chess profile is waiting."}
              </strong>
              <p>
                Import 15–20 recent rapid games. ChessForge will look for recurring
                patterns before recommending what to study.
              </p>
              <button className="text-button" onClick={onImport}>
                {games.length > 0 ? "Import more games" : "Import your first games"}{" "}
                <ArrowRight size={13} />
              </button>
            </div>
          )}
          <div className="focus-footer">
            <ShieldCheck size={14} /> Evidence over assumptions: Requires N &ge; 20 games for verified diagnosis.
          </div>
        </section>

        <section className="panel performance-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">PERFORMANCE</div>
              <h2>Rating & consistency</h2>
            </div>
            <button className="select-button">
              Last 30 days <ChevronDown size={13} />
            </button>
          </div>
          <div className="chart-placeholder">
            <div className="chart-y">
              <span>1,300</span>
              <span>1,250</span>
              <span>1,200</span>
              <span>1,150</span>
            </div>
            <svg
              viewBox="0 0 620 150"
              preserveAspectRatio="none"
              className="line-chart"
              role="img"
              aria-label="No rating history imported yet"
            >
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#b7e36a" stopOpacity=".18" />
                  <stop offset="100%" stopColor="#b7e36a" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[15, 55, 95, 135].map(y => (
                <line
                  key={y}
                  x1="0"
                  x2="620"
                  y1={y}
                  y2={y}
                  stroke="#2a3941"
                  strokeDasharray="3 5"
                />
              ))}
              <path
                d="M0 130 L620 130"
                stroke="#718087"
                strokeDasharray="4 5"
                fill="none"
              />
              <text x="310" y="78" fill="#829197" fontSize="12" textAnchor="middle">
                {games.length > 0
                  ? `${games.length} games recorded in library`
                  : "Import games to build your rating history"}
              </text>
            </svg>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot lime" /> Chess.com Rapid
            </span>
            <span>
              <i className="legend-dot copper" /> Lichess Rapid
            </span>
            <span className="chart-note">Platforms tracked separately</span>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">RECENT ACTIVITY</div>
              <h2>Pick up where you left off</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("My Games")}>
              View games <ArrowRight size={13} />
            </button>
          </div>
          {recentGames.length === 0 ? (
            <div className="empty-activity">
              <div className="empty-icon">
                <Database size={19} />
              </div>
              <div>
                <strong>No games in your library</strong>
                <p>Your imported games and analysis reports will appear here.</p>
              </div>
              <button
                className="button button-secondary button-small"
                onClick={onImport}
              >
                <Plus size={13} /> Add games
              </button>
            </div>
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
                    <strong>
                      {g.white} vs {g.black}
                    </strong>
                    <div style={{ color: "var(--muted)", fontSize: "10px" }}>
                      {g.result} · {g.time_class || g.platform} · {g.moves_count} moves
                    </div>
                  </div>
                  <button
                    className="button button-secondary button-small"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenAnalysis(g);
                    }}
                  >
                    Analyse
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-bottom">
        <span>
          <span className="status-dot" /> All systems ready
        </span>
        <span>
          {games.length > 0
            ? `${games.length} games loaded in repository`
            : "Sample workspace · No personal game data loaded"}
        </span>
        <button
          onClick={() => onNavigate(games.length > 0 ? "My Games" : "Analysis")}
        >
          Explore library <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
