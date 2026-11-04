import React, { useRef, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarClock,
  ChevronDown,
  Crosshair,
  Crown,
  FolderOpen,
  LayoutDashboard,
  Link2,
  LogIn,
  LogOut,
  Settings2,
  User as UserIcon
} from "lucide-react";
import type { Page } from "../types";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "../lib/auth";

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  user: User | null;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  isOpen?: boolean;
}

// ─── Profile popover ────────────────────────────────────────────────────────

interface ProfilePopoverProps {
  user: User;
  profile: UserProfile | null;
  onSignOut: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

function ProfilePopover({ user, profile, onSignOut, onClose, anchorRef }: ProfilePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Pull stored extras from profile.settings (graceful defaults)
  const stored = (profile?.settings ?? {}) as Record<string, string>;
  const [lichessRating, setLichessRating] = useState<string>(stored.lichess_rating ?? "");
  const [chesscomHandle, setChesscomHandle] = useState<string>(stored.chesscom_handle ?? "");

  const userInitials = (profile?.display_name || user.email || "")
    .slice(0, 2)
    .toUpperCase();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "Account";

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const row: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  };
  const label: React.CSSProperties = {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    color: "var(--muted)",
    fontWeight: 600
  };
  const input: React.CSSProperties = {
    background: "var(--raised)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    padding: "5px 8px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box"
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Profile"
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "0",
        right: "0",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "10px",
        padding: "16px",
        zIndex: 200,
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "var(--lime)",
            color: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "14px",
            flexShrink: 0
          }}
        >
          {userInitials || <UserIcon size={16} />}
        </div>
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayName}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.email}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--line)" }} />

      {/* Connected accounts / ratings */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
          <Link2 size={12} style={{ color: "var(--muted)" }} />
          <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)", fontWeight: 600 }}>
            Connected Accounts
          </span>
        </div>

        <div style={row}>
          <span style={label}>Lichess Rating</span>
          <input
            type="number"
            min="400"
            max="3500"
            placeholder="e.g. 1450"
            value={lichessRating}
            onChange={e => setLichessRating(e.target.value)}
            style={input}
          />
        </div>

        <div style={row}>
          <span style={label}>Chess.com Username</span>
          <input
            type="text"
            placeholder="your-handle"
            value={chesscomHandle}
            onChange={e => setChesscomHandle(e.target.value)}
            style={input}
          />
        </div>

        <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
          Saved locally · OAuth sync coming in a future release
        </p>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--line)" }} />

      {/* Sign out */}
      <button
        onClick={onSignOut}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "1px solid var(--line)",
          borderRadius: "7px",
          color: "var(--text)",
          fontSize: "12px",
          cursor: "pointer",
          padding: "7px 10px",
          width: "100%",
          transition: "background 0.15s"
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,80,80,0.08)")}
        onMouseLeave={e => (e.currentTarget.style.background = "none")}
      >
        <LogOut size={13} style={{ color: "var(--muted)" }} />
        Sign out
      </button>
    </div>
  );
}

// ─── Nav groups ─────────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "WORKSPACE",
    items: [
      { name: "Dashboard" as Page, icon: LayoutDashboard },
      { name: "My Games" as Page, icon: FolderOpen },
      { name: "Analysis" as Page, icon: Activity }
    ]
  },
  {
    label: "IMPROVE",
    items: [
      { name: "Train" as Page, icon: Crosshair },
      { name: "Review Queue" as Page, icon: CalendarClock },
      { name: "Openings" as Page, icon: BookOpen },
      { name: "Endgames" as Page, icon: Crown }
    ]
  },
  {
    label: "INSIGHTS",
    items: [
      { name: "Analytics" as Page, icon: BarChart3 }
    ]
  }
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({
  page,
  onNavigate,
  user,
  profile,
  onOpenAuth,
  onSignOut,
  isOpen = true
}: SidebarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const profileAnchorRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const userInitials = (profile?.display_name || user?.email || "")
    .slice(0, 2)
    .toUpperCase();
  const userDisplayName =
    profile?.display_name || user?.email?.split("@")[0] || "";

  return (
    <aside className="sidebar" aria-label="Main Navigation">
      {/* Profile / Sign-In area */}
      {user ? (
        <div style={{ position: "relative" }}>
          <div
            ref={profileAnchorRef}
            className="profile-switcher"
            onClick={() => setShowProfile(v => !v)}
            onKeyDown={e => e.key === "Enter" && setShowProfile(v => !v)}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            aria-expanded={showProfile}
            aria-haspopup="dialog"
            aria-label="Open profile"
          >
            <div className="profile-avatar">{userInitials}</div>
            <div className="profile-copy">
              <strong>{userDisplayName}</strong>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{user.email}</span>
            </div>
            <ChevronDown
              size={14}
              style={{
                marginLeft: "auto",
                color: "var(--muted)",
                transform: showProfile ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s"
              }}
            />
          </div>

          {showProfile && (
            <ProfilePopover
              user={user}
              profile={profile}
              onSignOut={() => { setShowProfile(false); onSignOut(); }}
              onClose={() => setShowProfile(false)}
              anchorRef={profileAnchorRef}
            />
          )}
        </div>
      ) : (
        <div
          className="profile-switcher"
          onClick={onOpenAuth}
          onKeyDown={e => e.key === "Enter" && onOpenAuth()}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          aria-label="Sign in to ChessForge"
        >
          <div
            className="profile-avatar"
            style={{
              background: "rgba(183, 227, 106, 0.08)",
              color: "var(--lime)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <LogIn size={15} />
          </div>
          <div className="profile-copy">
            <strong style={{ color: "var(--lime)" }}>Sign In</strong>
          </div>
        </div>
      )}

      <div className="sidebar-nav-scroll">
        {navGroups.map(group => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = page === item.name;
              return (
                <button
                  key={item.name}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => onNavigate(item.name)}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                  {item.name === "Review Queue" && <span className="nav-count">0</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="engine-status">
          <span className="status-dot" style={{ background: "var(--lime)" }} />
          <div>
            <strong style={{ color: "var(--lime)" }}>Engine connected</strong>
            <small>Stockfish 19 Lite WASM · MultiPV 3</small>
          </div>
          <span className="status-muted" style={{ background: "var(--lime)", boxShadow: "0 0 6px var(--lime)" }} />
        </div>
        <button
          className={`nav-item ${page === "Settings" ? "active" : ""}`}
          onClick={() => onNavigate("Settings")}
        >
          <Settings2 size={16} />
          <span>Settings</span>
        </button>
        <div className="sidebar-foot">
          <span>CHESSFORGE</span>
          <span className="version-pill" style={{
            fontSize: "9px",
            background: "rgba(183, 227, 106, 0.12)",
            color: "var(--lime)",
            border: "1px solid rgba(183, 227, 106, 0.25)",
            padding: "1px 6px",
            borderRadius: "10px",
            fontWeight: 600,
            letterSpacing: "0.5px"
          }}>
            v0.4.0
          </span>
        </div>
      </div>
    </aside>
  );
}
