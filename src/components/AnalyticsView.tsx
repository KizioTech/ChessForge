import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  Clock,
  Crosshair,
  Flame,
  HelpCircle,
  Info,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap
} from "lucide-react";
import {
  getWeaknessAnalysis,
  type WeaknessAnalysisReport,
  type TagFrequency
} from "../lib/insight/trend-service";
import type { MistakeTag } from "../lib/insight/mistake-tagger";

interface AnalyticsViewProps {
  userId?: string;
  totalGamesCount: number;
}

const TAG_LABELS: Record<MistakeTag, { label: string; desc: string; color: string }> = {
  hanging_piece: {
    label: "Hanging Piece",
    desc: "Undefended or improperly protected pieces left to capture.",
    color: "#ef4444"
  },
  missed_mate: {
    label: "Missed Mate",
    desc: "Forced checkmate sequence was available but not played.",
    color: "#ec4899"
  },
  missed_fork: {
    label: "Missed Fork",
    desc: "Tactical fork / double attack opportunity missed.",
    color: "#8b5cf6"
  },
  back_rank_weakness: {
    label: "Back-Rank Weakness",
    desc: "Vulnerability or checkmate threat along the 1st/8th rank.",
    color: "#f59e0b"
  },
  time_trouble: {
    label: "Time Trouble",
    desc: "Errors committed with under 30 seconds on the clock.",
    color: "#06b6d4"
  },
  missed_tactic: {
    label: "Tactical Blunder",
    desc: "General tactical error or sudden win-probability collapse.",
    color: "#10b981"
  }
};

export function AnalyticsView({ userId, totalGamesCount }: AnalyticsViewProps) {
  const [report, setReport] = useState<WeaknessAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getWeaknessAnalysis(userId, totalGamesCount).then(data => {
      if (isMounted) {
        setReport(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId, totalGamesCount]);

  if (loading || !report) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Analyzing personal weakness patterns...</p>
      </div>
    );
  }

  const maxTagCount = Math.max(1, ...report.tagFrequencies.map(t => t.count));

  return (
    <div className="analytics-view" style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Brain size={24} style={{ color: "var(--accent, #6366f1)" }} />
            Weakness Diagnosis & Analytics
          </h1>
          <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.875rem" }}>
            Heuristic error categorization and longitudinal blunder trends across your game history.
          </p>
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <div className="stat-pill" style={{ padding: "0.5rem 1rem", background: "var(--surface-raised, #1e293b)", borderRadius: "8px", border: "1px solid var(--border, #334155)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", display: "block" }}>Games Analyzed</span>
            <span style={{ fontSize: "1.25rem", fontWeight: "700" }}>{report.totalGames}</span>
          </div>
          <div className="stat-pill" style={{ padding: "0.5rem 1rem", background: "var(--surface-raised, #1e293b)", borderRadius: "8px", border: "1px solid var(--border, #334155)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", display: "block" }}>Blunders / 100 Moves</span>
            <span style={{ fontSize: "1.25rem", fontWeight: "700", color: report.blundersPer100Moves > 3 ? "#ef4444" : "#10b981" }}>
              {report.blundersPer100Moves}
            </span>
          </div>
        </div>
      </div>

      {/* Core Principle #3 Warning: Evidence Over Assumptions */}
      {report.insufficientData && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "8px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem"
          }}
        >
          <AlertTriangle size={20} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: "600", color: "#f59e0b", fontSize: "0.875rem" }}>
              Preliminary Dataset ({report.totalGames} / 20 games)
            </div>
            <div style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.8125rem" }}>
              Per Core Principle #3, a minimum statistical baseline of 20 games is required before trends achieve diagnostic reliability. Early patterns are shown below.
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Grid: Mistake Categories & Time Trouble Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Card 1: Mistake Frequency Radar */}
        <div style={{ background: "var(--surface-raised, #1e293b)", borderRadius: "12px", border: "1px solid var(--border, #334155)", padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Crosshair size={18} style={{ color: "#8b5cf6" }} />
            Recurring Tactical Blindspots
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {report.tagFrequencies.map(tf => {
              const info = TAG_LABELS[tf.tag] || { label: tf.tag, desc: "", color: "#94a3b8" };
              const barWidth = Math.max(4, Math.round((tf.count / maxTagCount) * 100));

              return (
                <div key={tf.tag}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                    <span style={{ fontWeight: "500", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: info.color }} />
                      {info.label}
                    </span>
                    <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.8125rem" }}>
                      {tf.count} ({tf.percentage}%)
                    </span>
                  </div>

                  <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        background: info.color,
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginTop: "0.25rem" }}>
                    {info.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Longitudinal Trend / Clock Pressure */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Time Trouble Card */}
          <div style={{ background: "var(--surface-raised, #1e293b)", borderRadius: "12px", border: "1px solid var(--border, #334155)", padding: "1.25rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={18} style={{ color: "#06b6d4" }} />
              Time-Trouble Vulnerability
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  border: "4px solid #06b6d4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  fontWeight: "700"
                }}
              >
                {report.timeTroublePercentage}%
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>
                  {report.timeTroubleCount} Mistakes Under 30s
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted, #94a3b8)", lineHeight: "1.4" }}>
                  {report.timeTroublePercentage > 25
                    ? "Severe clock pressure factor. Many tactical blunders correlate with critical time management deficit."
                    : "Stable time management. Most blunders occur in normal positional play rather than scramble."}
                </div>
              </div>
            </div>
          </div>

          {/* Rolling Performance Trend */}
          <div style={{ background: "var(--surface-raised, #1e293b)", borderRadius: "12px", border: "1px solid var(--border, #334155)", padding: "1.25rem", flex: 1 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BarChart3 size={18} style={{ color: "#10b981" }} />
              Rolling Blunder Rate (10-Game Windows)
            </h2>

            <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem", height: "120px", paddingTop: "1rem" }}>
              {report.rollingTrends.map(point => {
                const heightPct = Math.min(100, Math.max(15, point.blundersPer100Moves * 20));
                return (
                  <div key={point.windowIndex} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "600" }}>{point.blundersPer100Moves}</span>
                    <div
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        background: point.blundersPer100Moves <= 2 ? "#10b981" : "#f59e0b",
                        borderRadius: "4px 4px 0 0"
                      }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted, #64748b)" }}>{point.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

