/**
 * outbox.test.ts — Unit tests for the offline outbox write-queue (Item 11).
 *
 * Verifies:
 * 1. enqueueOutbox adds records into Dexie outbox table.
 * 2. flushOutbox executes upsert/delete calls via Supabase and deletes successful items.
 * 3. flushOutbox isolates records by userId (cross-account boundary).
 * 4. flushOutbox increments attempt counts on failure and drops after MAX_ATTEMPTS.
 * 5. outboxPendingCount returns count of pending items for a user.
 */

import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChessForgeDb, _setDbForTest } from "../../src/lib/db";
import { enqueueOutbox, flushOutbox, outboxPendingCount } from "../../src/lib/outbox";

let db: ChessForgeDb;
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

let mockSupabaseError: Error | null = null;
let mockUpsertCalls: any[] = [];
let mockDeleteCalls: any[] = [];

vi.mock("../../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      upsert: (payload: any) => {
        if (mockSupabaseError) return Promise.resolve({ error: { message: mockSupabaseError.message } });
        mockUpsertCalls.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: (col: string, val: string) => {
          if (mockSupabaseError) return Promise.resolve({ error: { message: mockSupabaseError.message } });
          mockDeleteCalls.push({ table, col, val });
          return Promise.resolve({ error: null });
        }
      })
    })
  }
}));

beforeEach(async () => {
  db = new ChessForgeDb();
  await db.open();
  await db.outbox.clear();
  _setDbForTest(db);

  mockSupabaseError = null;
  mockUpsertCalls = [];
  mockDeleteCalls = [];
});

describe("Outbox Queue (Item 11)", () => {
  it("enqueues an item into Dexie outbox table", async () => {
    await enqueueOutbox({
      table: "review_schedule",
      operation: "upsert",
      userId: USER_A,
      payload: { exercise_id: "ex-1", ease_factor: 2.5 }
    });

    const count = await outboxPendingCount(USER_A);
    expect(count).toBe(1);

    const items = await db.outbox.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].userId).toBe(USER_A);
    expect(items[0].table).toBe("review_schedule");
    expect(items[0].attempts).toBe(0);
  });

  it("flushes queued items and deletes them on success", async () => {
    await enqueueOutbox({
      table: "review_schedule",
      operation: "upsert",
      userId: USER_A,
      payload: { exercise_id: "ex-1", ease_factor: 2.5 }
    });

    const flushed = await flushOutbox(USER_A);
    expect(flushed).toBe(true);

    expect(mockUpsertCalls).toHaveLength(1);
    expect(mockUpsertCalls[0].table).toBe("review_schedule");

    const count = await outboxPendingCount(USER_A);
    expect(count).toBe(0);
  });

  it("isolates items by userId during flush", async () => {
    await enqueueOutbox({
      table: "review_schedule",
      operation: "upsert",
      userId: USER_A,
      payload: { id: "a-1" }
    });
    await enqueueOutbox({
      table: "review_schedule",
      operation: "upsert",
      userId: USER_B,
      payload: { id: "b-1" }
    });

    // Flush User A only
    await flushOutbox(USER_A);

    expect(await outboxPendingCount(USER_A)).toBe(0);
    expect(await outboxPendingCount(USER_B)).toBe(1);

    const remaining = await db.outbox.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(USER_B);
  });

  it("increments attempt counter on failure and drops item after 5 attempts", async () => {
    mockSupabaseError = new Error("Network unreachable");

    await enqueueOutbox({
      table: "exercise_attempts",
      operation: "upsert",
      userId: USER_A,
      payload: { exercise_id: "ex-fail" }
    });

    // First flush fails
    await flushOutbox(USER_A);
    let items = await db.outbox.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].attempts).toBe(1);

    // Run 4 more failed flushes
    await flushOutbox(USER_A);
    await flushOutbox(USER_A);
    await flushOutbox(USER_A);
    await flushOutbox(USER_A); // 5th attempt: should drop it

    items = await db.outbox.toArray();
    expect(items).toHaveLength(0);
  });
});
