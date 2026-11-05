import React, { useState, useEffect } from "react";
import {
  X,
  User as UserIcon,
  LogOut,
  Check,
  Trophy,
  Link2,
  Calendar,
  Mail,
  Shield,
  Save,
  Brain,
  Crosshair,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, type UserProfile } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getWeaknessAnalysis, type WeaknessAnalysisReport } from "../lib/insight/trend-service";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: UserProfile | null;
  onSignOut: () => void;
}

const LOCAL_STORAGE_KEY = "chessforge_custom_profile_ratings";

export function ProfileModal({
  isOpen,
  onClose,
  user,
  profile,
  onSignOut
}: ProfileModalProps) {
  const { refreshProfile } = useAuth();

  // Load existing values from profile.settings or localStorage
  const getInitialRatings = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const settings = (profile?.settings || {}) as Record<string, string>;
    return {
      fideRating: settings.fide_rating || "",
      lichessRating: settings.lichess_rating || "",
      chesscomRating: settings.chesscom_rating || "",
      chesscomUsername: settings.chesscom_username || "",
      lichessUsername: settings.lichess_username || ""
    };
  };

  const [ratings, setRatings] = useState(getInitialRatings());
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [weaknessData, setWeaknessData] = useState<WeaknessAnalysisReport | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRatings(getInitialRatings());
      setDisplayName(profile?.display_name || user?.email?.split("@")[0] || "");
      setSaveStatus("idle");
      getWeaknessAnalysis(user?.id).then(setWeaknessData);
    }
  }, [isOpen, profile, user]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const userInitials = (displayName || user.email || "CF")
    .slice(0, 2)
    .toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving");

    // 1. Save to local storage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ratings));
    } catch {
      // ignore
    }

    // 2. Save to Supabase if configured
    if (isSupabaseConfigured && user) {
      try {
        const mergedSettings = {
          ...((profile?.settings as Record<string, unknown>) || {}),
          fide_rating: ratings.fideRating,
          lichess_rating: ratings.lichessRating,
          chesscom_rating: ratings.chesscomRating,
          chesscom_username: ratings.chesscomUsername,
          lichess_username: ratings.lichessUsername
        };

        await supabase
          .from("profiles")
          .update({
            display_name: displayName.trim(),
            settings: mergedSettings,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);

        await refreshProfile();
      } catch (err) {
        console.error("Failed to update profile in database:", err);
      }
    }

    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="User Profile">
      <div
        className="import-modal"
        style={{ maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "var(--lime)",
                color: "#17211a",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "16px",
                flexShrink: 0
              }}
            >
              {userInitials || <UserIcon size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "17px", color: "var(--text)" }}>
                {displayName || "User Profile"}
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                {user.email}
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close profile (Esc)">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Display Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--muted)", fontWeight: 600 }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name or handle"
              style={{
                background: "var(--panel2)",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                padding: "8px 10px",
                color: "var(--text)",
                fontSize: "12px",
                outline: "none"
              }}
            />
          </div>

          {/* Ratings Section */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <Trophy size={14} style={{ color: "var(--lime)" }} />
              <strong style={{ fontSize: "12px", color: "var(--text)" }}>Elo Ratings</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--muted)" }}>FIDE Elo</label>
                <input
                  type="number"
                  placeholder="e.g. 1650"
                  value={ratings.fideRating}
                  onChange={e => setRatings({ ...ratings, fideRating: e.target.value })}
                  style={{
                    background: "var(--panel2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "7px 9px",
                    color: "var(--text)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--muted)" }}>Lichess</label>
                <input
                  type="number"
                  placeholder="e.g. 1800"
                  value={ratings.lichessRating}
                  onChange={e => setRatings({ ...ratings, lichessRating: e.target.value })}
                  style={{
                    background: "var(--panel2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "7px 9px",
                    color: "var(--text)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--muted)" }}>Chess.com</label>
                <input
                  type="number"
                  placeholder="e.g. 1550"
                  value={ratings.chesscomRating}
                  onChange={e => setRatings({ ...ratings, chesscomRating: e.target.value })}
                  style={{
                    background: "var(--panel2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "7px 9px",
                    color: "var(--text)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Connected Accounts */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <Link2 size={14} style={{ color: "var(--muted)" }} />
              <strong style={{ fontSize: "12px", color: "var(--text)" }}>Connected Accounts</strong>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)", width: "90px" }}>Chess.com:</span>
                <input
                  type="text"
                  placeholder="Username"
                  value={ratings.chesscomUsername}
                  onChange={e => setRatings({ ...ratings, chesscomUsername: e.target.value })}
                  style={{
                    flex: 1,
                    background: "var(--panel2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "6px 9px",
                    color: "var(--text)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)", width: "90px" }}>Lichess:</span>
                <input
                  type="text"
                  placeholder="Username"
                  value={ratings.lichessUsername}
                  onChange={e => setRatings({ ...ratings, lichessUsername: e.target.value })}
                  style={{
                    flex: 1,
                    background: "var(--panel2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "6px 9px",
                    color: "var(--text)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Account Details Info */}
          <div
            style={{
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "11px",
              color: "var(--muted)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Mail size={12} />
              <span>Email: <strong style={{ color: "var(--text)" }}>{user.email}</strong></span>
            </div>
            {user.created_at && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Calendar size={12} />
                <span>Member since: <strong style={{ color: "var(--text)" }}>{new Date(user.created_at).toLocaleDateString()}</strong></span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={12} />
              <span>Auth: <strong style={{ color: "var(--text)" }}>{user.app_metadata?.provider || "Supabase Auth"}</strong></span>
            </div>
          </div>

          {/* Phase 5: Weakness & Diagnostic Profile Summary */}
          {weaknessData && weaknessData.totalMistakes > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Brain size={14} style={{ color: "var(--lime)" }} />
                  <strong style={{ fontSize: "12px", color: "var(--text)" }}>Diagnostic Weakness Profile</strong>
                </div>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                  {weaknessData.totalMistakes} logged mistakes
                </span>
              </div>

              <div style={{
                background: "var(--panel2)",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Blunder Rate:</span>
                  <strong style={{ fontSize: "12px", color: weaknessData.blundersPer100Moves > 3 ? "#ef4444" : "var(--lime)" }}>
                    {weaknessData.blundersPer100Moves} / 100 moves
                  </strong>
                </div>

                {weaknessData.tagFrequencies.length > 0 && (
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                      Top Tactical Blindspots:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {weaknessData.tagFrequencies.filter(t => t.count > 0).slice(0, 3).map(tf => (
                        <span
                          key={tf.tag}
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(183, 227, 106, 0.1)",
                            color: "var(--lime)",
                            border: "1px solid rgba(183, 227, 106, 0.2)"
                          }}
                        >
                          {tf.tag.replace(/_/g, " ")}: {tf.count} ({tf.percentage}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              style={{ color: "#f87171", borderColor: "rgba(248, 113, 113, 0.3)" }}
              title="Sign out of your ChessForge account"
            >
              <LogOut size={13} /> Sign out
            </button>

            <button
              type="submit"
              className="button button-primary"
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saved" ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : saveStatus === "saving" ? (
                "Saving…"
              ) : (
                <>
                  <Save size={14} /> Save Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

