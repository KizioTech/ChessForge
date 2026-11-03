# ChessForge

ChessForge is a personal chess-improvement desktop application built on Electron, React, and TypeScript. It provides a complete training loop: importing your games, analysing them with Stockfish WebAssembly, detecting your mistakes, generating tailored exercises, and scheduling spaced-repetition reviews.

## Requirements

- Windows 10/11, macOS, or Linux
- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

The Vite dev server starts at `http://localhost:5173`; Electron opens the desktop window once the dev server is ready.

## Build and run packaged app

```bash
npm run build
npm start
```

## Implemented functionality (Release 1 — v1.0.0)

- **Desktop Shell**: Electron desktop container with isolated renderer, native frame overlay, and strict Content Security Policy.
- **Game Library**: PGN file upload, direct text paste, and account synchronization workflows with duplicate fingerprint detection.
- **Stockfish Engine**: Real Stockfish 19 Lite WebAssembly running in dedicated Web Worker threads with MultiPV 3 candidate lines and White-relative score normalisation.
- **Move Classification**: Win-percentage loss calculation distinguishing Inaccuracies, Mistakes, and Blunders according to ADR 0003.
- **Mistake Isolation**: Strict mover-matching ensuring opponent mistakes never pollute the user's mistake database or statistics.
- **Exercise Generation**: Automated extraction of tactical, defensive, and blunder-avoidance puzzles from personal games adhering to Section 3.7 eligibility filters.
- **SM-2 Spaced Repetition**: Modified SM-2 algorithm scheduling review sessions with interval scaling, lapse penalties, and mastery progression.
- **Solving Desk**: Interactive chessboard solving interface with real-time feedback, hint progressive disclosure, and SM-2 grading.
- **Data Sovereignty**: Complete data export into standard PGN collections and structured JSON archives.
- **Persistence**: Dual-layer architecture combining remote Supabase PostgreSQL with local storage caching for offline resilience.

## Architecture & Decisions

All architectural decisions are documented in [`docs/decisions/`](docs/decisions/):
- **ADR 0001**: PGN Storage and Duplicate Detection
- **ADR 0002**: Database Schema and Row-Level Security
- **ADR 0003**: Move Classification Model and Win-Percentage Loss
- **ADR 0004**: Engine Runner and Web Worker Isolation
- **ADR 0005**: Board Component Selection
- **ADR 0006**: Opening Identification and ECO Classification
- **ADR 0007**: State Management Strategy
- **ADR 0008**: Data Ingestion and Import Strategy
- **ADR 0009**: Analysis Pipeline and Caching
- **ADR 0010**: Spaced Repetition and Exercise Eligibility
- **ADR 0011**: Electron Desktop Runtime

## Security & Privacy

- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
- Strict Content Security Policy (`CSP`) prevents unsafe script execution.
- Stockfish is strictly restricted to post-game analysis and practice desks. Live engine assistance is explicitly prohibited.

## Licensing

ChessForge is distributed under the MIT License. Bundled Stockfish components comply with the GNU General Public License v3 (GPLv3).
