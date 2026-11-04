import React from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarClock,
  Crosshair,
  Crown,
  FolderOpen,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings2
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

export function Sidebar({
  page,
  onNavigate,
  user,
  profile,
  onOpenAuth,
  onSignOut,
  isOpen = true
}: SidebarProps) {
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
        <div className="profile-switcher" style={{ cursor: "default" }}>
          <div className="profile-avatar">{userInitials}</div>
          <div className="profile-copy">
            <strong>{userDisplayName}</strong>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>{user.email}</span>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              borderRadius: "4px"
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      ) : (
        <div
          className="profile-switcher"
          onClick={onOpenAuth}
          onKeyDown={(e) => e.key === "Enter" && onOpenAuth()}
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

