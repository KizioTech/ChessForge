import React, { useMemo } from "react";
import type { PositionRecord, MoveAnalysisReport } from "../lib/engine/types";

interface EvalGraphProps {
  positions: PositionRecord[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  reports?: MoveAnalysisReport[];
}

export function EvalGraph({
  positions,
  currentPly,
  onSelectPly,
  reports = []
}: EvalGraphProps) {
  if (positions.length <= 1) {
    return null;
  }

  const width = 600;
  const height = 80;
  const paddingX = 10;
  const paddingY = 8;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  // Map each position to SVG coordinate (x, y)
  // Win probability 0..100 maps to y: 100 -> top (paddingY), 50 -> center, 0 -> bottom (height - paddingY)
  const points = useMemo(() => {
    const total = positions.length - 1;
    return positions.map((p, i) => {
      const x = paddingX + (i / total) * graphWidth;
      const prob = p.win_probability ?? 50;
      // 100% win prob -> y = paddingY (top)
      // 0% win prob -> y = paddingY + graphHeight (bottom)
      const y = paddingY + ((100 - prob) / 100) * graphHeight;
      return { x, y, ply: p.ply, prob, p };
    });
  }, [positions, graphWidth, graphHeight]);

  const polylineStr = points.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

  // Fill area between 50% line (center) and the curve
  const centerY = paddingY + graphHeight / 2;
  const areaPath = `M ${points[0].x},${centerY} ` +
    points.map(pt => `L ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ") +
    ` L ${points[points.length - 1].x},${centerY} Z`;

  const activePoint = points.find(pt => pt.ply === currentPly) || points[0];

  // Blunders / Mistakes markers
  const blunderMarkers = useMemo(() => {
    return reports
      .filter(r => r.classification === "blunder" || r.classification === "mistake")
      .map(r => {
        const pt = points.find(p => p.ply === r.ply);
        if (!pt) return null;
        return {
          ...r,
          x: pt.x,
          y: pt.y
        };
      })
      .filter(Boolean) as (MoveAnalysisReport & { x: number; y: number })[];
  }, [reports, points]);

  return (
    <div
      className="eval-graph-container"
      style={{
        width: "100%",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "7px",
        padding: "10px 14px",
        marginTop: "12px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
          fontSize: "10px",
          color: "var(--muted)",
          fontFamily: "var(--mono)"
        }}
      >
        <span>EVALUATION MOMENTUM</span>
        <span>
          Ply {currentPly} / {positions.length - 1} ·{" "}
          {activePoint.p.mate_in !== null
            ? `Mate in ${Math.abs(activePoint.p.mate_in)}`
            : `${activePoint.p.score_cp && activePoint.p.score_cp > 0 ? "+" : ""}${(
                (activePoint.p.score_cp ?? 0) / 100
              ).toFixed(2)}`}
        </span>
      </div>

      <div style={{ position: "relative", width: "100%", height: `${height}px`, cursor: "pointer" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const fraction = Math.max(0, Math.min(1, clickX / rect.width));
            const targetPly = Math.round(fraction * (positions.length - 1));
            onSelectPly(targetPly);
          }}
        >
          <defs>
            <linearGradient id="whiteAdvantage" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b7e36a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#b7e36a" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="blackAdvantage" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#d87570" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#d87570" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Equal balance 50% baseline */}
          <line
            x1={paddingX}
            y1={centerY}
            x2={width - paddingX}
            y2={centerY}
            stroke="#34464f"
            strokeDasharray="2 3"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaPath} fill="url(#whiteAdvantage)" />

          {/* Evaluation curve */}
          <polyline
            fill="none"
            stroke="#b7e36a"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylineStr}
          />

          {/* Blunder / Mistake icons */}
          {blunderMarkers.map((b, i) => (
            <circle
              key={i}
              cx={b.x}
              cy={b.y}
              r={b.classification === "blunder" ? 3.5 : 2.5}
              fill={b.classification === "blunder" ? "#ff5252" : "#fbbf24"}
              stroke="#101820"
              strokeWidth="1"
            />
          ))}

          {/* Active move vertical cursor */}
          <line
            x1={activePoint.x}
            y1={paddingY}
            x2={activePoint.x}
            y2={height - paddingY}
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="4"
            fill="#ffffff"
            stroke="var(--lime)"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
}

