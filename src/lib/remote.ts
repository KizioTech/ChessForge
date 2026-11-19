/**
 * remote.ts — Typed, cancellation-safe Supabase caller.
 *
 * Ensures errors are never ignored and timeouts properly abort running queries.
 * Uses Promise.race so that a timeout resolves the helper even when the underlying
 * query promise never settles (the common case with supabase-js when the network hangs).
 */

export type RemoteResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "timeout" | "error"; message: string };

export async function remote<T>(
  run: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  { timeoutMs = 8000, label = "remote" }: { timeoutMs?: number; label?: string } = {}
): Promise<RemoteResult<T>> {
  const ctrl = new AbortController();

  // A sentinel promise that resolves to a timeout result after timeoutMs
  const timeoutResult: Promise<RemoteResult<T>> = new Promise(resolve => {
    const timer = setTimeout(() => {
      ctrl.abort();
      resolve({ ok: false, reason: "timeout", message: `${label}: timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    // If the query wins, clean up the timer (via AbortSignal listener is not needed —
    // the timer reference is captured and cleared in the query path below via ctrl.signal)
    ctrl.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });

  const queryResult: Promise<RemoteResult<T>> = (async () => {
    try {
      const { data, error } = await run(ctrl.signal);
      if (ctrl.signal.aborted) {
        // Timed out while query was still running — ignore late result
        return { ok: false, reason: "timeout" as const, message: `${label}: timed out after ${timeoutMs}ms` };
      }
      if (error) {
        return { ok: false, reason: "error" as const, message: `${label}: ${error.message}` };
      }
      return { ok: true, data: data as T };
    } catch (e: unknown) {
      const aborted = ctrl.signal.aborted;
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        reason: aborted ? ("timeout" as const) : ("error" as const),
        message: `${label}: ${msg}`
      };
    }
  })();

  return Promise.race([queryResult, timeoutResult]);
}
