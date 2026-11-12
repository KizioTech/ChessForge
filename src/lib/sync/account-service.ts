/**
 * Platform Account Service
 *
 * CRUD for the `platform_accounts` table (Supabase + LocalStorage fallback).
 * Also manages `import_logs` entries for sync run provenance.
 */

import { supabase, isSupabaseConfigured } from "../supabase";
import type {
  PlatformAccount,
  ImportLog,
  ImportLogStatus,
  SyncCursor,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage fallback keys
// ─────────────────────────────────────────────────────────────────────────────

const LS_ACCOUNTS_KEY = "chessforge:platform_accounts_v1";
const LS_LOGS_KEY = "chessforge:import_logs_v1";

function lsGetAccounts(): PlatformAccount[] {
  try {
    const raw = localStorage.getItem(LS_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveAccounts(accounts: PlatformAccount[]): void {
  try {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* ignore storage errors */
  }
}

function lsGetLogs(): ImportLog[] {
  try {
    const raw = localStorage.getItem(LS_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveLogs(logs: ImportLog[]): void {
  try {
    localStorage.setItem(LS_LOGS_KEY, JSON.stringify(logs.slice(0, 100))); // cap at 100
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform account operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all platform accounts for the current user.
 */
export async function getPlatformAccounts(
  userId?: string | null
): Promise<PlatformAccount[]> {
  if (isSupabaseConfigured && userId) {
    const { data, error } = await supabase
      .from("platform_accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) return data as PlatformAccount[];
    if (error) console.warn("platform_accounts fetch error:", error.message);
  }
  return lsGetAccounts().filter(a => !userId || a.user_id === userId);
}

/**
 * Add or update a platform account (upsert by user_id + platform + username).
 */
export async function upsertPlatformAccount(
  account: Omit<PlatformAccount, "id" | "created_at" | "updated_at">,
  userId: string
): Promise<PlatformAccount | null> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("platform_accounts")
      .upsert(
        {
          user_id: userId,
          platform: account.platform,
          username: account.username,
          last_synced_at: account.last_synced_at,
          sync_cursor: account.sync_cursor,
          updated_at: now,
        },
        { onConflict: "user_id,platform,username" }
      )
      .select()
      .single();
    if (!error && data) return data as PlatformAccount;
    if (error) console.error("upsertPlatformAccount error:", error.message);
    return null;
  }

  // LocalStorage fallback
  const existing = lsGetAccounts();
  const idx = existing.findIndex(
    a =>
      a.user_id === userId &&
      a.platform === account.platform &&
      a.username === account.username
  );
  const record: PlatformAccount =
    idx >= 0
      ? { ...existing[idx], ...account, updated_at: now }
      : {
          id: crypto.randomUUID(),
          ...account,
          user_id: userId,
          created_at: now,
          updated_at: now,
        };
  if (idx >= 0) existing[idx] = record;
  else existing.push(record);
  lsSaveAccounts(existing);
  return record;
}

/**
 * Update only the sync cursor + last_synced_at for an account.
 */
export async function updateSyncCursor(
  accountId: string,
  cursor: SyncCursor,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    await supabase
      .from("platform_accounts")
      .update({ sync_cursor: cursor, last_synced_at: now, updated_at: now })
      .eq("id", accountId)
      .eq("user_id", userId);
    return;
  }
  const accounts = lsGetAccounts();
  const idx = accounts.findIndex(a => a.id === accountId);
  if (idx >= 0) {
    accounts[idx] = {
      ...accounts[idx],
      sync_cursor: cursor,
      last_synced_at: now,
      updated_at: now,
    };
    lsSaveAccounts(accounts);
  }
}

/**
 * Delete a platform account (and prevent future syncs for it).
 */
export async function deletePlatformAccount(
  accountId: string,
  userId: string
): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from("platform_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", userId);
    if (!error) return true;
  }
  const accounts = lsGetAccounts().filter(a => a.id !== accountId);
  lsSaveAccounts(accounts);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Import log operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an import log entry at the start of a sync run.
 */
export async function createImportLog(
  userId: string,
  platform: "chesscom" | "lichess",
  username: string
): Promise<ImportLog> {
  const now = new Date().toISOString();
  const record: ImportLog = {
    id: crypto.randomUUID(),
    user_id: userId,
    platform,
    username,
    status: "running",
    games_imported: 0,
    games_skipped: 0,
    error_message: null,
    started_at: now,
    finished_at: null,
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("import_logs")
      .insert(record)
      .select()
      .single();
    if (!error && data) return data as ImportLog;
  }

  // Fallback
  const logs = lsGetLogs();
  logs.unshift(record);
  lsSaveLogs(logs);
  return record;
}

/**
 * Update an import log at the end of a run.
 */
export async function finaliseImportLog(
  logId: string,
  userId: string,
  patch: Partial<
    Pick<
      ImportLog,
      "status" | "games_imported" | "games_skipped" | "error_message" | "finished_at"
    >
  >
): Promise<void> {
  const update = { ...patch, finished_at: patch.finished_at ?? new Date().toISOString() };
  if (isSupabaseConfigured) {
    await supabase
      .from("import_logs")
      .update(update)
      .eq("id", logId)
      .eq("user_id", userId);
    return;
  }
  const logs = lsGetLogs();
  const idx = logs.findIndex(l => l.id === logId);
  if (idx >= 0) {
    logs[idx] = { ...logs[idx], ...update };
    lsSaveLogs(logs);
  }
}

/**
 * Fetch recent import logs for the current user (most recent first).
 */
export async function getImportLogs(
  userId?: string | null,
  limit = 20
): Promise<ImportLog[]> {
  if (isSupabaseConfigured && userId) {
    const { data, error } = await supabase
      .from("import_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (!error && data) return data as ImportLog[];
  }
  return lsGetLogs()
    .filter(l => !userId || l.user_id === userId)
    .slice(0, limit);
}
