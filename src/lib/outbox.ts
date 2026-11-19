/**
 * outbox.ts — Offline-first write queue backed by IndexedDB (Dexie).
 *
 * When a Supabase write fails (network error, timeout, or the user is offline),
 * the write is enqueued here instead of being silently dropped.
 *
 * Flush behaviour:
 *   - flushOutbox() is called on app startup, on window focus, and after any
 *     successful remote() call.
 *   - Entries are retried in insertion order.
 *   - After MAX_ATTEMPTS consecutive failures the entry is logged and removed
 *     so it doesn't block the queue forever.
 *   - Only entries belonging to the current userId are flushed (cross-account isolation).
 *
 * Usage:
 *   import { enqueueOutbox, flushOutbox } from "./outbox";
 *
 *   // Queue a failed write:
 *   await enqueueOutbox({ table: "review_schedule", operation: "upsert",
 *     userId, payload: updatedSched });
 *
 *   // Flush on reconnect / focus:
 *   await flushOutbox(userId, supabase);
 */

import { getDb, type OutboxRecord } from "./db";
import { supabase, isSupabaseConfigured } from "./supabase";

const MAX_ATTEMPTS = 5;

// ── Enqueue ───────────────────────────────────────────────────────────────────

export async function enqueueOutbox(
  entry: Omit<OutboxRecord, "id" | "queuedAt" | "attempts">
): Promise<void> {
  try {
    const db = getDb();
    await db.outbox.add({
      ...entry,
      queuedAt: new Date().toISOString(),
      attempts: 0
    });
  } catch (err) {
    // IndexedDB unavailable (e.g. private browsing quota) — log and move on
    console.warn("[Outbox] Failed to enqueue write:", err);
  }
}

// ── Flush ─────────────────────────────────────────────────────────────────────

/** Returns true if at least one entry was successfully flushed. */
export async function flushOutbox(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !userId) return false;

  let flushed = false;
  try {
    const db = getDb();
    // Only flush entries belonging to this user, ordered by insertion
    const entries = await db.outbox
      .where("userId")
      .equals(userId)
      .sortBy("queuedAt");

    for (const entry of entries) {
      if (!entry.id) continue;

      try {
        if (entry.operation === "upsert") {
          const { error } = await supabase
            .from(entry.table)
            .upsert(entry.payload as any);

          if (error) throw new Error(error.message);
        } else if (entry.operation === "delete" && entry.rowId) {
          const { error } = await supabase
            .from(entry.table)
            .delete()
            .eq("id", entry.rowId);

          if (error) throw new Error(error.message);
        }

        // Success — remove from queue
        await db.outbox.delete(entry.id);
        flushed = true;
      } catch (err) {
        const newAttempts = entry.attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          console.error(
            `[Outbox] Dropping entry id=${entry.id} after ${MAX_ATTEMPTS} failed attempts:`,
            entry,
            err
          );
          await db.outbox.delete(entry.id);
        } else {
          await db.outbox.update(entry.id, {
            attempts: newAttempts,
            lastFailedAt: new Date().toISOString()
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Outbox] flushOutbox error:", err);
  }

  return flushed;
}

/** Returns the number of pending outbox entries for a given user. */
export async function outboxPendingCount(userId: string): Promise<number> {
  try {
    const db = getDb();
    return await db.outbox.where("userId").equals(userId).count();
  } catch {
    return 0;
  }
}
