# 0005. Enforced Package Boundaries and Pure Domain Logic

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
Coupling domain chess logic (FEN parsing, PGN import, move classification, spaced repetition calculations) to React UI components or database clients makes automated testing difficult and hinders portability between Web and Desktop environments.

## Decision
1. `chess-core`, `analysis`, and `training` domain modules must remain pure TypeScript:
   - No React dependencies.
   - No browser DOM APIs.
   - No Supabase client or network calls.
   - Inputs in, outputs out.
2. Only `engine` communicates with Web Workers or engine child processes.
3. Only application layer (`apps/web` or `src/`) interacts with React and Supabase.
4. Dependency direction flows strictly inward: UI -> Domain -> Shared. Never the reverse.

## Consequences
- **Positive:** Domain logic is 100% testable via fast in-memory unit tests; core packages can be reused across Web, CLI, and native desktop runtimes.

