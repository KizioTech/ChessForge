/**
 * PlatformSyncView — Platform account management and sync control.
 *
 * Displays:
 * - Connected Chess.com and Lichess accounts (auto-seeded from profile settings)
 * - Live ELO ratings fetched from each platform's public API
 * - Add / remove account forms
 * - Per-account sync button with real-time progress
 * - Import log history (last 20 runs)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  getPlatformAccounts,
  upsertPlatformAccount,
  deletePlatformAccount,
  getImportLogs,
} from "../lib/sync/account-service";
import { ChesscomAdapter } from "../lib/sync/chesscom-adapter";
import { LichessAdapter } from "../lib/sync/lichess-adapter";
import { runSync } from "../lib/sync/sync-engine";
import type {
  PlatformAccount,
  ImportLog,
  SyncEvent,
} from "../lib/sync/types";
import type { GameRecord } from "../lib/games";

interface PlatformSyncViewProps {
  userId: string;
  /** Player's display name / email for colour detection during PGN parsing. */
  username?: string;
  /** Pre-seeded usernames from profile settings (migration path). */
  profileChesscomUsername?: string;
  profileLichessUsername?: string;
  onGamesImported?: (games: GameRecord[]) => void;
}

const PLATFORMS = [
  {
    id: "chesscom" as const,
    label: "Chess.com",
    icon: "♟",
    placeholder: "e.g. makawa7",
  },
  {
    id: "lichess" as const,
    label: "Lichess",
    icon: "♞",
    placeholder: "e.g. makawa7",
  },
];

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusBadge(status: ImportLog["status"]) {
  const map: Record<string, { label: string; cls: string }> = {
    running: { label: "Running…", cls: "badge-inaccuracy" },
    completed: { label: "Completed", cls: "badge-best" },
    failed: { label: "Failed", cls: "badge-blunder" },
    cancelled: { label: "Cancelled", cls: "badge-mistake" },
  };
  const cfg = map[status] ?? map.failed;
  return <span className={cfg.cls} style={{ fontSize: "10px", padding: "2px 8px" }}>{cfg.label}</span>;
}

// ─── ELO fetching ────────────────────────────────────────────────────────────

interface EloInfo {
  rapid?: number;
  blitz?: number;
  bullet?: number;
}

async function fetchChesscomElo(username: string): Promise<EloInfo | null> {
  try {
    const r = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
      { headers: { "User-Agent": "ChessForge/0.6.0 (personal-training; github.com/KizioTech/ChessForge)" } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    return {
      rapid: data?.chess_rapid?.last?.rating,
      blitz: data?.chess_blitz?.last?.rating,
      bullet: data?.chess_bullet?.last?.rating,
    };
  } catch {
    return null;
  }
}

async function fetchLichessElo(username: string): Promise<EloInfo | null> {
  try {
    const r = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { headers: { Accept: "application/json", "User-Agent": "ChessForge/0.6.0" } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const perfs = data?.perfs ?? {};
    return {
      rapid: perfs?.rapid?.rating,
      blitz: perfs?.blitz?.rating,
      bullet: perfs?.bullet?.rating,
    };
  } catch {
    return null;
  }
}

function EloDisplay({ elo }: { elo: EloInfo | null | undefined }) {
  if (!elo) return null;
  const entries = [
    { label: "Rapid", val: elo.rapid },
    { label: "Blitz", val: elo.blitz },
    { label: "Bullet", val: elo.bullet },
  ].filter(e => e.val !== undefined);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {entries.map(e => (
        <span key={e.label} style={{ fontSize: "11px", color: "var(--muted)" }}>
          <span style={{ color: "var(--lime)", fontWeight: 600 }}>{e.val}</span>{" "}
          <span>{e.label}</span>
        </span>
      ))}
    </div>
  );
}

export function PlatformSyncView({
  userId,
  username,
  profileChesscomUsername,
  profileLichessUsername,
  onGamesImported,
}: PlatformSyncViewProps) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [eloMap, setEloMap] = useState<Record<string, EloInfo | null>>({});
  const [addingPlatform, setAddingPlatform] = useState<"chesscom" | "lichess" | null>(null);
  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<Record<string, SyncEvent>>({});
  const [logsOpen, setLogsOpen] = useState(false);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  // ── Seed platform accounts from profile settings on first load ──────────────
  const seedFromProfile = useCallback(async () => {
    const toSeed: Array<{ platform: "chesscom" | "lichess"; username: string }> = [];
    if (profileChesscomUsername?.trim()) toSeed.push({ platform: "chesscom", username: profileChesscomUsername.trim() });
    if (profileLichessUsername?.trim()) toSeed.push({ platform: "lichess", username: profileLichessUsername.trim() });
    if (toSeed.length === 0) return;

    await Promise.all(
      toSeed.map(({ platform, username: uname }) =>
        upsertPlatformAccount(
          { user_id: userId, platform, username: uname, last_synced_at: null, sync_cursor: {} },
          userId
        )
      )
    );
  }, [userId, profileChesscomUsername, profileLichessUsername]);

  const reload = useCallback(async () => {
    const [accs, ls] = await Promise.all([
      getPlatformAccounts(userId),
      getImportLogs(userId, 20),
    ]);
    setAccounts(accs);
    setLogs(ls);
    return accs;
  }, [userId]);

  // ── Fetch live ELO for all accounts ────────────────────────────────────────
  const fetchElos = useCallback(async (accs: PlatformAccount[]) => {
    const results: Record<string, EloInfo | null> = {};
    await Promise.all(
      accs.map(async acc => {
        const key = `${acc.platform}:${acc.username}`;
        results[key] = acc.platform === "chesscom"
          ? await fetchChesscomElo(acc.username)
          : await fetchLichessElo(acc.username);
      })
    );
    setEloMap(results);
  }, []);

  useEffect(() => {
    (async () => {
      await seedFromProfile();
      const accs = await reload();
      await fetchElos(accs);
    })();
  }, [seedFromProfile, reload, fetchElos]);

  // ── Add account ─────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addingPlatform) return;
    const trimmed = addUsername.trim();
    if (!trimmed) { setAddError("Username is required"); return; }

    setAddError("");
    setAddLoading(true);
    try {
      const existing = accounts.find(
        a => a.platform === addingPlatform && a.username.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) { setAddError("Account already connected"); return; }

      await upsertPlatformAccount(
        { user_id: userId, platform: addingPlatform, username: trimmed, last_synced_at: null, sync_cursor: {} },
        userId
      );
      setAddingPlatform(null);
      setAddUsername("");
      const accs = await reload();
      await fetchElos(accs);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Remove account ─────────────────────────────────────────────────────────

  const handleDelete = async (account: PlatformAccount) => {
    if (!confirm(`Remove ${account.platform === "chesscom" ? "Chess.com" : "Lichess"} account "${account.username}"?`)) return;
    // Cancel any in-flight sync for this account
    abortRefs.current.get(account.id)?.abort();
    await deletePlatformAccount(account.id, userId);
    const accs = await reload();
    await fetchElos(accs);
  };

  // ── Sync account ───────────────────────────────────────────────────────────

  const handleSync = async (account: PlatformAccount) => {
    if (syncingId) return; // only one at a time

    const ctrl = new AbortController();
    abortRefs.current.set(account.id, ctrl);
    setSyncingId(account.id);
    setSyncProgress(prev => ({ ...prev, [account.id]: { kind: "started", platform: account.platform, username: account.username } }));

    const adapter = account.platform === "chesscom"
      ? new ChesscomAdapter()
      : new LichessAdapter();

    const result = await runSync(
      adapter,
      account,
      userId,
      username || account.username,
      (evt) => {
        setSyncProgress(prev => ({ ...prev, [account.id]: evt }));
        if (evt.kind === "page" && evt.savedGames?.length) {
          onGamesImported?.(evt.savedGames);
        }
      },
      ctrl.signal
    );

    abortRefs.current.delete(account.id);
    setSyncingId(null);

    if (result.status === "completed") {
      setSyncProgress(prev => ({ ...prev, [account.id]: { kind: "completed", platform: account.platform, username: account.username, gamesImported: result.gamesImported, gamesSkipped: result.gamesSkipped } }));
    }

    const accs = await reload();
    await fetchElos(accs);
    setTimeout(() => setSyncProgress(prev => { const n = { ...prev }; delete n[account.id]; return n; }), 5000);
  };

  const handleCancelSync = (accountId: string) => {
    abortRefs.current.get(accountId)?.abort();
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Platform account list */}
      {PLATFORMS.map(plat => {
        const platAccounts = accounts.filter(a => a.platform === plat.id);
        const isAddingThis = addingPlatform === plat.id;

        return (
          <div key={plat.id} className="panel" style={{ padding: "18px" }}>
            {/* Platform header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "24px", lineHeight: 1 }}>{plat.icon}</span>
              <div>
                <div className="eyebrow">{plat.id.toUpperCase()}</div>
                <h3 style={{ fontSize: "14px", margin: 0 }}>{plat.label}</h3>
              </div>
            </div>

            {/* Connected accounts */}
            {platAccounts.length === 0 && !isAddingThis && (
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px" }}>
                No {plat.label} account connected.
              </p>
            )}

            {platAccounts.map(acc => {
              const prog = syncProgress[acc.id];
              const isSyncing = syncingId === acc.id;
              const eloKey = `${acc.platform}:${acc.username}`;
              const elo = eloMap[eloKey];

              return (
                <div
                  key={acc.id}
                  style={{
                    padding: "12px 14px",
                    background: "var(--panel2)",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Username + ELO */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: "13px", display: "block" }}>{acc.username}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "2px" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        Last synced: {formatRelative(acc.last_synced_at)}
                      </span>
                      {elo !== undefined && <EloDisplay elo={elo} />}
                    </div>
                  </div>

                  {/* Progress / status */}
                  {prog && (
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {prog.kind === "rate_limited" && (
                        <span style={{ color: "var(--amber)" }}>
                          <AlertTriangle size={11} style={{ verticalAlign: "middle" }} />{" "}
                          Rate limited — retrying in {Math.round((prog.retryAfterMs ?? 60000) / 1000)}s
                        </span>
                      )}
                      {(prog.kind === "page" || prog.kind === "started") && (
                        <span>
                          <Loader2 size={11} style={{ verticalAlign: "middle", animation: "spin 1s linear infinite" }} />{" "}
                          {prog.gamesImported ?? 0} imported
                        </span>
                      )}
                      {prog.kind === "completed" && (
                        <span style={{ color: "var(--lime)" }}>
                          <Check size={11} style={{ verticalAlign: "middle" }} />{" "}
                          {prog.gamesImported} new, {prog.gamesSkipped} skipped
                        </span>
                      )}
                      {prog.kind === "failed" && (
                        <span style={{ color: "var(--red)" }}>
                          <AlertTriangle size={11} style={{ verticalAlign: "middle" }} />{" "}
                          {prog.error || "Sync failed"}
                        </span>
                      )}
                      {prog.kind === "cancelled" && (
                        <span style={{ color: "var(--muted)" }}>Cancelled</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {isSyncing ? (
                    <button
                      className="button button-secondary button-small"
                      onClick={() => handleCancelSync(acc.id)}
                      style={{ color: "var(--red)", borderColor: "rgba(216,117,112,0.4)" }}
                    >
                      <X size={12} /> Cancel
                    </button>
                  ) : (
                    <button
                      className="button button-secondary button-small"
                      onClick={() => handleSync(acc)}
                      disabled={!!syncingId}
                      title="Sync new games"
                    >
                      <RefreshCw size={12} /> Sync
                    </button>
                  )}

                  <button
                    className="button button-secondary button-small"
                    onClick={() => handleDelete(acc)}
                    disabled={isSyncing}
                    style={{ color: "var(--red)", borderColor: "rgba(216,117,112,0.3)" }}
                    title="Remove account"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}

            {/* Add account form */}
            {isAddingThis ? (
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--raised)",
                  borderRadius: "6px",
                  border: "1px solid var(--lime)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  {plat.label} Username
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={addUsername}
                    onChange={e => { setAddUsername(e.target.value); setAddError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleAdd()}
                    placeholder={plat.placeholder}
                    autoFocus
                    style={{
                      flex: 1,
                      background: "var(--panel2)",
                      color: "var(--text)",
                      border: `1px solid ${addError ? "var(--red)" : "var(--line)"}`,
                      borderRadius: "4px",
                      padding: "6px 10px",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    className="button button-small"
                    onClick={handleAdd}
                    disabled={addLoading}
                  >
                    {addLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
                    {addLoading ? "Adding…" : "Add"}
                  </button>
                  <button
                    className="button button-secondary button-small"
                    onClick={() => { setAddingPlatform(null); setAddUsername(""); setAddError(""); }}
                  >
                    <X size={12} />
                  </button>
                </div>
                {addError && (
                  <span style={{ fontSize: "11px", color: "var(--red)" }}>{addError}</span>
                )}
              </div>
            ) : (
              <button
                className="button button-secondary button-small"
                onClick={() => { setAddingPlatform(plat.id); setAddUsername(""); setAddError(""); }}
                style={{ marginTop: "4px" }}
              >
                <Plus size={13} /> Add {plat.label} account
              </button>
            )}
          </div>
        );
      })}

      {/* Import log history */}
      {logs.length > 0 && (
        <div className="panel" style={{ padding: "18px" }}>
          <button
            onClick={() => setLogsOpen(o => !o)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text)",
              padding: 0,
            }}
          >
            <div>
              <div className="eyebrow">HISTORY</div>
              <h3 style={{ fontSize: "14px", margin: "2px 0 0" }}>Import Log</h3>
            </div>
            {logsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {logsOpen && (
            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {logs.map(log => (
                <div
                  key={log.id}
                  style={{
                    padding: "10px 12px",
                    background: "var(--panel2)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={10} />
                    {new Date(log.started_at).toLocaleString()}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>
                    {log.platform === "chesscom" ? "Chess.com" : "Lichess"} · {log.username}
                  </span>
                  {statusBadge(log.status)}
                  <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "auto" }}>
                    {log.games_imported} imported · {log.games_skipped} skipped
                  </span>
                  {log.error_message && (
                    <span style={{ width: "100%", fontSize: "11px", color: "var(--red)" }}>
                      {log.error_message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
