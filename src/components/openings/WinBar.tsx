import React from "react";

export function WinBar({ white, draws, black }: { white: number; draws: number; black: number }) {
  const total = white + draws + black;
  if (total === 0) return null;
  const wp = Math.round((white / total) * 100);
  const dp = Math.round((draws / total) * 100);
  const bp = 100 - wp - dp;
  return (
    <div
      style={{
        display: "flex",
        height: "6px",
        borderRadius: "3px",
        overflow: "hidden",
        width: "100%",
        minWidth: "80px"
      }}
    >
      <div style={{ width: `${wp}%`, background: "#e8e8e8", transition: "width 0.3s" }} title={`White: ${wp}%`} />
      <div style={{ width: `${dp}%`, background: "#888", transition: "width 0.3s" }} title={`Draw: ${dp}%`} />
      <div style={{ width: `${bp}%`, background: "#222", transition: "width 0.3s" }} title={`Black: ${bp}%`} />
    </div>
  );
}

export function WinBarLabels({ white, draws, black }: { white: number; draws: number; black: number }) {
  const total = white + draws + black;
  if (total === 0) return null;
  const wp = Math.round((white / total) * 100);
  const dp = Math.round((draws / total) * 100);
  const bp = 100 - wp - dp;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "10px",
        color: "var(--muted)",
        marginTop: "2px"
      }}
    >
      <span style={{ color: "#ccc" }}>{wp}%</span>
      <span>{dp}%</span>
      <span style={{ color: "var(--muted)" }}>{bp}%</span>
    </div>
  );
}
