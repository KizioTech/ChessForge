# ADR 0009 — Analysis Pipeline Architecture and Dual-Layer Caching

**Status:** Accepted  
**Date:** 2026-11-03  
**Deciders:** ChessForge core team

---

## Context

Phase 3 introduces full Stockfish engine analysis of imported games. The pipeline must:

1. Run depth-16 MultiPV-3 analysis on a 40-move game without blocking the UI thread.
2. Persist results across page reloads, surviving network outages.
3. Allow clean cancellation mid-analysis without corrupting database records.
4. Support both authenticated (Supabase) and unauthenticated (LocalStorage-only) sessions.

---

## Decision

### 1. Web Worker Isolation (ADR 0004 compliance)

`StockfishEngine` loads `/stockfish.js` (Stockfish 19 WASM, lite-single variant) as a Web Worker. The Worker runs in a separate thread, keeping the main UI thread fully responsive during analysis. A lightweight inline blob fallback is provided for Node/Vitest environments where `Worker` is unavailable.

**WASM delivery:** `public/stockfish-19-lite-single.wasm` (1.8 MB) is served statically. The JS loader (`public/stockfish.js`) resolves the `.wasm` path relative to its own URL via `locateFile`.

### 2. Sequential Ply Evaluation

`analyzeGame()` replays the game move-by-move using `chess.js`, producing a `PlySnapshot[]`. Each ply is evaluated sequentially (not in parallel) to avoid memory pressure from multiple concurrent WASM engines. An `AbortSignal` is checked before every ply — if aborted, a `DOMException("AbortError")` is thrown and the engine is disposed without writing partial results.

### 3. Dual-Layer Persistence

```
User triggers analysis
        │
        ▼
 saveAnalysis(analysisInput, positionsInput)
        │
        ├── isRealUuid(game_id) && isRealUuid(user_id)?
        │       ├── YES → Supabase upsert (game_analyses + positions tables)
        │       └── NO  → skip remote (test fixtures, unauthenticated guests)
        │
        └── typeof localStorage !== "undefined"?
                ├── YES → localStorage.setItem(`analysis:${game_id}`, JSON)
                └── NO  → skip (Node/SSR environment)
```

On subsequent loads, `getAnalysisForGame()` tries Supabase first, falls back to LocalStorage if the remote call fails or returns no rows.

### 4. UUID Guard

`isRealUuid()` (regex-based) prevents test fixtures with synthetic IDs (e.g. `"test-game-123"`) from triggering Supabase `400 Bad Request` errors. This keeps the test suite clean without mocking Supabase entirely.

### 5. Progress Reporting

`analyzeGame()` accepts an `onProgress(AnalysisProgress)` callback reporting `currentPly`, `totalPlies`, and `percent` (0–100). The React `App` component threads this into `setAnalysisProgress()` state, rendering a live progress bar in the Analysis workspace header.

### 6. Move Classification (ADR 0003 compliance)

`computeMoveClassifications()` compares win-probability before and after each ply (from the mover's perspective). Loss thresholds:

| Classification | Win-prob loss |
|---|---|
| Best | ≤ 0 (played engine's best move) |
| Good | ≤ 2% |
| Inaccuracy | ≤ 5% |
| Mistake | ≤ 10% |
| Blunder | > 10% |

Classification badges (`??`, `?`, `?!`) are rendered inline in the move notation panel.

---

## Consequences

- **Positive:** Analysis is non-blocking; cancellation is clean; results survive network failure; test isolation is maintained.
- **Positive:** The 1.8 MB lite WASM file loads in < 2s on broadband and performs depth-16 analysis adequately for club-level game review.
- **Negative:** The 94 MB full-NNUE variant is not shipped (too large for web); lite-single runs without NNUE nets, which reduces top-level accuracy but is sufficient for blunder/mistake detection.
- **Trade-off:** Sequential ply evaluation means a 40-move game takes ~20–40 s depending on hardware. A future parallel-ply variant could be explored once SharedArrayBuffer is widely available without COOP/COEP constraints.

