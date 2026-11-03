# 0001. React and TypeScript for Application Core

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
ChessForge requires an information-dense, highly responsive interface comprising chessboards, move lists, notation trees, evaluation graphs, spaced repetition queues, and analytical dashboards. We evaluated whether to write the application in pure Rust (e.g., using a Rust GUI framework) versus React + TypeScript.

## Decision
We chose React 18+ with strict TypeScript for the application layer. Rust is reserved exclusively for native shell packaging (Tauri 2) and potential native Stockfish binary execution if needed in later phases.

## Alternatives Considered
- **Pure Rust GUI (Iced / Slint / Tauri native UI):** Immature chess UI component ecosystem; significantly slower frontend iteration speed; harder integration with existing open-source chess web tooling (Chessground, chess.js, Lichess assets).

## Consequences
- **Positive:** Rapid UI development, rich chess ecosystem (chessground, chess.js), high AI-pair programming efficiency, excellent type safety with TypeScript strict mode.
- **Negative:** Heavy compute tasks (engine evaluation) must run in Web Workers or native backend processes rather than direct in-process native threads.

