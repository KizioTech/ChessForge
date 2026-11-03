# 0004. Stockfish WASM in a Web Worker Behind an Engine Interface

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
Running engine analysis on the main UI thread causes UI freezes and degrades responsiveness. Furthermore, engine implementations may vary (Stockfish WASM, native binaries via desktop IPC, or pre-computed Lichess cloud evaluations).

## Decision
1. Stockfish WASM runs isolated inside a dedicated Web Worker.
2. All engine operations adhere to a strict `Engine` interface (`init`, `analyse`, `dispose`) receiving `EngineConfig` and `AbortSignal`.
3. Evaluations are normalized to White-relative scores immediately upon UCI string parsing before reaching any application code.

## Consequences
- **Positive:** UI remains completely responsive during heavy background calculations; engine can be aborted cleanly without leaving corrupted states; alternate adapters (e.g. Lichess embedded evaluations) can substitute seamlessly.

