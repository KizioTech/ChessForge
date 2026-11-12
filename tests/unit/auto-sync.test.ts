/**
 * Unit tests for Auto-Sync Service (`src/lib/sync/auto-sync.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAutoSyncDue, runAutoSync } from "../../src/lib/sync/auto-sync";
import * as accountService from "../../src/lib/sync/account-service";
import * as syncEngine from "../../src/lib/sync/sync-engine";

// In-memory localStorage mock for node test runner
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = String(val); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("AutoSync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
  });

  it("isAutoSyncDue returns true when no sync has been recorded today", () => {
    expect(isAutoSyncDue()).toBe(true);
  });

  it("isAutoSyncDue returns false when today's date is already recorded", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("chessforge:last_auto_sync_date", today);
    expect(isAutoSyncDue()).toBe(false);
  });

  it("isAutoSyncDue returns true when yesterday's date is recorded", () => {
    localStorage.setItem("chessforge:last_auto_sync_date", "2020-01-01");
    expect(isAutoSyncDue()).toBe(true);
  });

  it("skips sync when dailyGated is true and already synced today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("chessforge:last_auto_sync_date", today);

    const runSyncSpy = vi.spyOn(syncEngine, "runSync");
    const results = await runAutoSync({ userId: "user-123" }, true);

    expect(results).toHaveLength(0);
    expect(runSyncSpy).not.toHaveBeenCalled();
  });

  it("runs sync when dailyGated is false even if already synced today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("chessforge:last_auto_sync_date", today);

    vi.spyOn(accountService, "getPlatformAccounts").mockResolvedValue([
      {
        id: "acc-1",
        user_id: "user-123",
        platform: "chesscom",
        username: "testuser",
        last_synced_at: null,
        sync_cursor: {},
        created_at: today,
        updated_at: today,
      },
    ]);

    const runSyncSpy = vi.spyOn(syncEngine, "runSync").mockResolvedValue({
      platform: "chesscom",
      username: "testuser",
      gamesImported: 5,
      gamesSkipped: 0,
      status: "completed",
    });

    const results = await runAutoSync({ userId: "user-123" }, false);

    expect(results).toHaveLength(1);
    expect(results[0].gamesImported).toBe(5);
    expect(runSyncSpy).toHaveBeenCalledTimes(1);
  });

  it("seeds accounts from profile ratings if no platform accounts exist", async () => {
    localStorage.setItem(
      "chessforge_custom_profile_ratings",
      JSON.stringify({ chesscomUsername: "magnus", lichessUsername: "" })
    );

    const upsertSpy = vi.spyOn(accountService, "upsertPlatformAccount").mockResolvedValue({
      id: "acc-seeded",
      user_id: "user-123",
      platform: "chesscom",
      username: "magnus",
      last_synced_at: null,
      sync_cursor: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // First call returns empty, second returns the seeded account
    vi.spyOn(accountService, "getPlatformAccounts")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "acc-seeded",
          user_id: "user-123",
          platform: "chesscom",
          username: "magnus",
          last_synced_at: null,
          sync_cursor: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

    vi.spyOn(syncEngine, "runSync").mockResolvedValue({
      platform: "chesscom",
      username: "magnus",
      gamesImported: 3,
      gamesSkipped: 0,
      status: "completed",
    });

    const results = await runAutoSync({ userId: "user-123" }, false);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "chesscom", username: "magnus" }),
      "user-123"
    );
    expect(results).toHaveLength(1);
    expect(results[0].gamesImported).toBe(3);
  });
});
