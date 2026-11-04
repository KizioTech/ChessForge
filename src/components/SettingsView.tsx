import { useState, useEffect } from "react";
import {
  Palette,
  Cpu,
  Brain,
  Database,
  Info,
  ExternalLink,
  Github,
  Check,
  RefreshCw,
  Download,
  Trash2,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import {
  getSettings,
  saveSettings,
  applyTheme,
  type AppSettings
} from "../lib/settings";
import logoUrl from "../assets/logo.png";
import { exportGamesToPgn, exportAllDataAsJson, triggerDownload } from "../lib/export";
import type { GameRecord } from "../lib/games";

interface SettingsViewProps {
  games: GameRecord[];
  onRefreshData?: () => void;
}

export function SettingsView({ games, onRefreshData }: SettingsViewProps) {
  const [settings, setSettingsState] = useState<AppSettings>(getSettings());
  const [activeTab, setActiveTab] = useState<"appearance" | "engine" | "training" | "data" | "about">("appearance");
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = saveSettings({ [key]: value });
    setSettingsState(updated);
    showNotice("Settings saved");
  };

  const showNotice = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleExportPgn = () => {
    exportGamesToPgn(games);
    showNotice("Exported PGN file");
  };

  const handleExportJson = () => {
    const jsonStr = exportAllDataAsJson(games);
    triggerDownload("chessforge-backup.json", jsonStr, "application/json");
    showNotice("Exported full JSON archive");
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem("chessforge:mistakes");
      localStorage.removeItem("chessforge:exercises");
      localStorage.removeItem("chessforge:schedule");
      localStorage.removeItem("chessforge:attempts");
      localStorage.removeItem("chessforge_games");
      setShowClearConfirm(false);
      showNotice("Local cache cleared");
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const THEMES = [
    {
      id: "forge-dark" as const,
      name: "Forge Dark",
      desc: "Deep obsidian workspace with signature lime accents",
      bg: "#101820",
      accent: "#b7e36a"
    },
    {
      id: "midnight-blue" as const,
      name: "Midnight Blue",
      desc: "Cosmic navy blue with electric cyan highlights",
      bg: "#0b1326",
      accent: "#38bdf8"
    },
    {
      id: "forest-green" as const,
      name: "Forest Green",
      desc: "Deep botanical emerald with mint accents",
      bg: "#0b1812",
      accent: "#4ade80"
    },
    {
      id: "classic-slate" as const,
      name: "Classic Slate",
      desc: "Graphite and silver with warm amber details",
      bg: "#14171d",
      accent: "#f59e0b"
    }
  ];

  return (
    <div className="content settings-content" style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 20px" }}>
      <div className="analysis-heading" style={{ marginBottom: "20px" }}>
        <div>
          <div className="eyebrow">PREFERENCES & CONFIGURATION</div>
          <h1 style={{ fontSize: "24px", margin: "4px 0 6px" }}>Settings</h1>
          <p style={{ color: "var(--muted)", fontSize: "12px", margin: 0 }}>
            Configure themes, Stockfish engine analysis, spaced repetition, and manage your local data.
          </p>
        </div>
        {savedBanner && (
          <div className="badge-best" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}>
            <Check size={14} /> {savedBanner}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Settings Navigation */}
        <nav style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", padding: "8px" }}>
          <button
            className={`nav-item ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
            style={{ width: "100%", textAlign: "left", marginBottom: "4px" }}
          >
            <Palette size={16} /> Appearance & Themes
          </button>
          <button
            className={`nav-item ${activeTab === "engine" ? "active" : ""}`}
            onClick={() => setActiveTab("engine")}
            style={{ width: "100%", textAlign: "left", marginBottom: "4px" }}
          >
            <Cpu size={16} /> Engine & Analysis
          </button>
          <button
            className={`nav-item ${activeTab === "training" ? "active" : ""}`}
            onClick={() => setActiveTab("training")}
            style={{ width: "100%", textAlign: "left", marginBottom: "4px" }}
          >
            <Brain size={16} /> Training & SM-2
          </button>
          <button
            className={`nav-item ${activeTab === "data" ? "active" : ""}`}
            onClick={() => setActiveTab("data")}
            style={{ width: "100%", textAlign: "left", marginBottom: "4px" }}
          >
            <Database size={16} /> Data & Sovereignty
          </button>
          <button
            className={`nav-item ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
            style={{ width: "100%", textAlign: "left" }}
          >
            <Info size={16} /> About & Credits
          </button>
        </nav>

        {/* Tab Panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* 1. Appearance */}
          {activeTab === "appearance" && (
            <div className="panel" style={{ padding: "20px" }}>
              <div className="panel-head" style={{ marginBottom: "16px" }}>
                <div>
                  <div className="eyebrow">VISUAL STYLING</div>
                  <h2 style={{ fontSize: "16px", margin: "4px 0" }}>App Theme</h2>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                {THEMES.map(t => {
                  const isSelected = settings.theme === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => updateSetting("theme", t.id)}
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid var(--lime)" : "1px solid var(--line)",
                        background: isSelected ? "var(--raised)" : "var(--panel2)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: t.bg,
                          border: `3px solid ${t.accent}`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0
                        }}
                      >
                        {isSelected && <Check size={16} style={{ color: t.accent }} />}
                      </div>
                      <div>
                        <strong style={{ fontSize: "13px", display: "block", color: "var(--text)" }}>{t.name}</strong>
                        <span style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.3, display: "block" }}>{t.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="panel-head" style={{ marginBottom: "16px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                <div>
                  <div className="eyebrow">CHESSBOARD</div>
                  <h2 style={{ fontSize: "16px", margin: "4px 0" }}>Board Preferences</h2>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "12px", display: "block" }}>Show Board Coordinates</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Display algebraic rank and file labels (a-h, 1-8) around the board edge</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showCoordinates}
                    onChange={e => updateSetting("showCoordinates", e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--lime)", cursor: "pointer" }}
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "12px", display: "block" }}>Move Sound Effects</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Play audio confirmation on move placement, checks, and exercise solves</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={e => updateSetting("soundEnabled", e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--lime)", cursor: "pointer" }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* 2. Engine & Analysis */}
          {activeTab === "engine" && (
            <div className="panel" style={{ padding: "20px" }}>
              <div className="panel-head" style={{ marginBottom: "16px" }}>
                <div>
                  <div className="eyebrow">ENGINE ORCHESTRATION</div>
                  <h2 style={{ fontSize: "16px", margin: "4px 0" }}>Stockfish 19 Lite WASM</h2>
                </div>
                <span className="engine-badge">
                  <span className="status-live" /> Engine Ready
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "12px", display: "block" }}>Default Analysis Depth</strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Search depth per ply during game review</span>
                    </div>
                    <select
                      value={settings.defaultDepth}
                      onChange={e => updateSetting("defaultDepth", Number(e.target.value))}
                      style={{ background: "var(--raised)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "4px", padding: "6px 10px", fontSize: "12px" }}
                    >
                      <option value={12}>Depth 12 (Fast ~400ms/ply)</option>
                      <option value={14}>Depth 14 (Balanced)</option>
                      <option value={16}>Depth 16 (Deep Standard)</option>
                      <option value={18}>Depth 18 (Exhaustive)</option>
                    </select>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "12px", display: "block" }}>MultiPV Candidate Lines</strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Number of alternative moves evaluated concurrently</span>
                    </div>
                    <select
                      value={settings.defaultMultiPv}
                      onChange={e => updateSetting("defaultMultiPv", Number(e.target.value))}
                      style={{ background: "var(--raised)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "4px", padding: "6px 10px", fontSize: "12px" }}
                    >
                      <option value={1}>1 line (Best move only)</option>
                      <option value={2}>2 lines</option>
                      <option value={3}>3 lines (Standard recommended)</option>
                    </select>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "12px", display: "block" }}>Hash Memory Table</strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Transposition table memory allocated to WebAssembly engine</span>
                    </div>
                    <select
                      value={settings.hashMb}
                      onChange={e => updateSetting("hashMb", Number(e.target.value))}
                      style={{ background: "var(--raised)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "4px", padding: "6px 10px", fontSize: "12px" }}
                    >
                      <option value={16}>16 MB</option>
                      <option value={32}>32 MB (Standard)</option>
                      <option value={64}>64 MB</option>
                      <option value={128}>128 MB</option>
                    </select>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "12px", display: "block" }}>Automatic Live Evaluation</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Compute MultiPV 3 evaluation immediately whenever you step through moves in Analysis</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoLiveEval}
                    onChange={e => updateSetting("autoLiveEval", e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--lime)", cursor: "pointer" }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* 3. Training & SM-2 */}
          {activeTab === "training" && (
            <div className="panel" style={{ padding: "20px" }}>
              <div className="panel-head" style={{ marginBottom: "16px" }}>
                <div>
                  <div className="eyebrow">SPACED REPETITION</div>
                  <h2 style={{ fontSize: "16px", margin: "4px 0" }}>Review Queue & Generation Rules</h2>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "12px", display: "block" }}>Daily Review Target</strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Target number of practice exercises per daily session</span>
                    </div>
                    <select
                      value={settings.dailyGoal}
                      onChange={e => updateSetting("dailyGoal", Number(e.target.value))}
                      style={{ background: "var(--raised)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "4px", padding: "6px 10px", fontSize: "12px" }}
                    >
                      <option value={5}>5 exercises / day</option>
                      <option value={10}>10 exercises / day (Recommended)</option>
                      <option value={15}>15 exercises / day</option>
                      <option value={20}>20 exercises / day (Intensive)</option>
                    </select>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "12px", display: "block" }}>Auto-Generate Exercises from Analysis</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Automatically extract eligible tactical and blunder-avoidance puzzles when analysing games</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoGenerateExercises}
                    onChange={e => updateSetting("autoGenerateExercises", e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--lime)", cursor: "pointer" }}
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "12px", display: "block" }}>Auto-Advance on Correct Move</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Transition smoothly to the next review exercise after successfully playing the solution</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoAdvanceOnCorrect}
                    onChange={e => updateSetting("autoAdvanceOnCorrect", e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--lime)", cursor: "pointer" }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* 4. Data & Sovereignty */}
          {activeTab === "data" && (
            <div className="panel" style={{ padding: "20px" }}>
              <div className="panel-head" style={{ marginBottom: "16px" }}>
                <div>
                  <div className="eyebrow">DATA SOVEREIGNTY</div>
                  <h2 style={{ fontSize: "16px", margin: "4px 0" }}>Export & Local Storage</h2>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "14px", background: "var(--panel2)", borderRadius: "6px" }}>
                  <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>Data Portability</strong>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    You own all your games, engine evaluations, mistake history, and SM-2 schedules. Export your full library at any time without platform lock-in.
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="button button-secondary button-small" onClick={handleExportPgn}>
                      <Download size={13} /> Export PGN Library ({games.length} games)
                    </button>
                    <button className="button button-secondary button-small" onClick={handleExportJson}>
                      <Download size={13} /> Export Complete Archive (JSON)
                    </button>
                  </div>
                </div>

                <div style={{ padding: "14px", background: "rgba(216, 117, 112, 0.08)", border: "1px solid rgba(216, 117, 112, 0.25)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <ShieldAlert size={18} style={{ color: "var(--red)", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: "13px", color: "var(--text)", display: "block" }}>Reset Local Offline Cache</strong>
                      <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 10px", lineHeight: 1.4 }}>
                        Clears locally cached games, exercises, and practice schedules. Remote Supabase records for authenticated accounts remain untouched.
                      </p>
                      {showClearConfirm ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="button button-small"
                            onClick={handleClearCache}
                            style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff" }}
                          >
                            <Trash2 size={13} /> Confirm Clear
                          </button>
                          <button className="button button-secondary button-small" onClick={() => setShowClearConfirm(false)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button button-secondary button-small"
                          onClick={() => setShowClearConfirm(true)}
                          style={{ color: "var(--red)", borderColor: "rgba(216, 117, 112, 0.4)" }}
                        >
                          <Trash2 size={13} /> Clear Cache…
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. About & Credits */}
          {activeTab === "about" && (
            <div className="panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                <img
                  src={logoUrl}
                  alt="ChessForge Logo"
                  style={{ width: "54px", height: "54px", borderRadius: "10px", objectFit: "contain", background: "var(--raised)", padding: "4px" }}
                  onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ fontSize: "20px", margin: 0, letterSpacing: "-0.5px" }}>ChessForge</h2>
                    <span className="version-pill" style={{
                      fontSize: "10px",
                      background: "rgba(183, 227, 106, 0.12)",
                      color: "var(--lime)",
                      border: "1px solid rgba(183, 227, 106, 0.25)",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontWeight: 600
                    }}>
                      v0.4.0
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Personal chess improvement studio & deliberate training loop
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)" }}>Author & Development</span>
                  <strong style={{ color: "var(--text)" }}>KizioTech</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)" }}>Source Code Repository</span>
                  <a
                    href="https://github.com/KizioTech/ChessForge"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--lime)",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      textDecoration: "none",
                      fontWeight: 500
                    }}
                  >
                    <Github size={14} /> github.com/KizioTech/ChessForge <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)" }}>Engine Integration</span>
                  <span style={{ color: "var(--text)" }}>Stockfish 19 Lite WASM (GPLv3)</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)" }}>Runtime Environment</span>
                  <span style={{ color: "var(--text)" }}>Electron Desktop Shell + React 19 + TypeScript</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span style={{ color: "var(--muted)" }}>Licensing</span>
                  <span style={{ color: "var(--text)" }}>MIT (Application) / GPLv3 (Stockfish Engine)</span>
                </div>
              </div>

              <div style={{ marginTop: "20px", padding: "14px", background: "var(--panel2)", borderRadius: "6px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <Sparkles size={16} style={{ color: "var(--lime)", flexShrink: 0, marginTop: "2px" }} />
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
                  ChessForge is designed to bridge the gap between playing games and deliberate practice. By analysing your actual games with Stockfish and scheduling your critical mistake positions using the SM-2 algorithm, every training session targets your specific blind spots.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
