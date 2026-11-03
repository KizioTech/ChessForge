# 0006. Manual PGN Before Platform Sync & Lichess Eval Shortcut

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
Platform synchronization (Chess.com PubAPI and Lichess game streaming) introduces third-party network risks, rate limits, and authentication complexities. Developing sync before the training loop is complete would delay proving the core product value.

## Decision
1. In Phase 2, implement robust client-side PGN parsing, validation, and SHA-256 fingerprint deduplication first.
2. In Phase 3, implement an adapter to import existing Lichess embedded evaluations alongside local Stockfish analysis.
3. Automated background platform sync for Chess.com and Lichess is deferred to Phase 6 (Release 2).

## Consequences
- **Positive:** User can immediately import games and begin training in Release 1 without dependency on external third-party API availability or OAuth workflows.

