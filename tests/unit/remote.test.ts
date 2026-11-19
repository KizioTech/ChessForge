/**
 * remote.test.ts — Unit tests for the typed Supabase remote() helper.
 *
 * Verifies:
 * 1. Success path returns { ok: true, data }.
 * 2. Supabase error (error field set) returns { ok: false, reason: "error" }.
 * 3. AbortSignal timeout returns { ok: false, reason: "timeout" }.
 * 4. The timer is cleared on success (no spurious rejections after resolution).
 * 5. AbortSignal is passed through to the caller.
 */

import { describe, it, expect, vi } from "vitest";
import { remote } from "../../src/lib/remote";

describe("remote()", () => {
  it("returns ok:true with data on success", async () => {
    const run = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
    const result = await remote(run, { label: "test", timeoutMs: 5000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ id: 1 }]);
    }
  });

  it("returns ok:false reason:error when supabase returns an error field", async () => {
    const run = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "duplicate key value" }
    });

    const result = await remote(run, { label: "test.error", timeoutMs: 5000 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      expect(result.message).toContain("duplicate key value");
      expect(result.message).toContain("test.error");
    }
  });

  it(
    "returns ok:false reason:timeout when the query exceeds timeoutMs",
    async () => {
      // Promise that never resolves within the 20 ms window
      let resolveExternal: (v: unknown) => void = () => {};
      const run = vi.fn().mockReturnValue(
        new Promise(res => { resolveExternal = res; })
      );

      // 20 ms real timeout — fast enough not to slow the suite
      const result = await remote(run, { label: "test.timeout", timeoutMs: 20 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("timeout");
        expect(result.message).toContain("test.timeout");
      }

      // Clean up — resolve the stalled promise to avoid unhandled-rejection noise
      resolveExternal({ data: null, error: null });
    },
    3000
  );

  it(
    "does not reject twice when the query resolves after the timeout",
    async () => {
      let resolveExternal: (v: unknown) => void = () => {};
      const run = vi.fn().mockReturnValue(
        new Promise(res => { resolveExternal = res; })
      );

      // Let it time out first
      const result = await remote(run, { label: "test.double", timeoutMs: 20 });
      expect(result.ok).toBe(false);

      // Resolving after the fact must not throw or cause an unhandled rejection
      resolveExternal({ data: [{ id: "late" }], error: null });
    },
    3000
  );

  it("passes an AbortSignal to the run function", async () => {
    let capturedSignal: AbortSignal | null = null;
    const run = vi.fn().mockImplementation((signal: AbortSignal) => {
      capturedSignal = signal;
      return Promise.resolve({ data: "ok", error: null });
    });

    await remote(run, { timeoutMs: 5000 });

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });
});
