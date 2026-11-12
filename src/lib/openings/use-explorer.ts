/**
 * use-explorer.ts: Lichess Opening Explorer client for the Openings screen.
 *
 * Optional enhancement: the app must work without it (names and theory come
 * from the bundled opening book). It is therefore defensive:
 *  - responses are validated, never trusted (an error body must not crash the UI),
 *  - requests are debounced and cached, so stepping through moves does not hammer Lichess,
 *  - after an HTTP 429 we stop calling for a minute, as Lichess asks,
 *  - failures are reported to the UI instead of silently hiding the panel.
 * No API token is stored in the app. If Lichess requires one, route requests
 * through a server-side function instead (see docs/SECURITY.md).
 */
import { useEffect, useState } from "react";

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

export interface ExplorerData {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
}

export const EXPLORER_DEBOUNCE_MS = 400;
export const EXPLORER_COOLDOWN_MS = 60_000;
const CACHE_LIMIT = 500;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Returns validated data, or null if the payload is not an explorer response. */
export function parseExplorerResponse(json: unknown): ExplorerData | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (!isNum(j.white) || !isNum(j.draws) || !isNum(j.black) || !Array.isArray(j.moves)) return null;
  const moves: ExplorerMove[] = [];
  for (const m of j.moves) {
    if (!m || typeof m !== "object") continue;
    const mm = m as Record<string, unknown>;
    if (typeof mm.san !== "string" || typeof mm.uci !== "string") continue;
    if (!isNum(mm.white) || !isNum(mm.draws) || !isNum(mm.black)) continue;
    moves.push({
      san: mm.san, uci: mm.uci, white: mm.white, draws: mm.draws, black: mm.black,
      averageRating: isNum(mm.averageRating) ? mm.averageRating : undefined
    });
  }
  return { white: j.white, draws: j.draws, black: j.black, moves };
}

export function explorerUrl(fen: string): string {
  return `https://explorer.lichess.org/lichess?fen=${encodeURIComponent(fen)}&speeds=blitz,rapid&ratings=1200,1400,1600,1800`;
}

/** Small FIFO-bounded cache so revisiting positions is instant and free. */
export class BoundedCache<V> {
  private map = new Map<string, V>();
  constructor(private limit: number) {}
  get(key: string): V | undefined { return this.map.get(key); }
  set(key: string, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value as string);
  }
  get size() { return this.map.size; }
}

const cache = new BoundedCache<ExplorerData>(CACHE_LIMIT);
let cooldownUntil = 0;

export function explorerErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Lichess rejected the request. The explorer may now require a personal API token.";
  }
  if (status === 429) return "Lichess asked us to slow down. Move stats will resume in about a minute.";
  return `Lichess explorer returned an error (${status}).`;
}

export function useExplorer(fen: string | null): {
  data: ExplorerData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fen) {
      setData(null); setLoading(false); setError(null);
      return;
    }
    const cached = cache.get(fen);
    if (cached) {
      setData(cached); setLoading(false); setError(null);
      return;
    }
    if (Date.now() < cooldownUntil) {
      setData(null); setLoading(false);
      setError(explorerErrorMessage(429));
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(explorerUrl(fen), { signal: controller.signal });
        if (!res.ok) {
          if (res.status === 429) cooldownUntil = Date.now() + EXPLORER_COOLDOWN_MS;
          setData(null); setLoading(false); setError(explorerErrorMessage(res.status));
          return;
        }
        const parsed = parseExplorerResponse(await res.json());
        if (!parsed) {
          setData(null); setLoading(false);
          setError("Lichess returned data in an unexpected format.");
          return;
        }
        cache.set(fen, parsed);
        setData(parsed); setLoading(false);
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        setData(null); setLoading(false);
        setError("Could not reach the Lichess explorer. Check your connection.");
      }
    }, EXPLORER_DEBOUNCE_MS);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [fen]);

  return { data, loading, error };
}
