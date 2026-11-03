# ChessForge

ChessForge is a personal chess-improvement desktop application. This is the initial Electron + React interface foundation.

## Requirements

- Windows 10/11 (also works on macOS/Linux with platform-specific packaging later)
- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

The Vite renderer runs at `http://localhost:5173`; Electron opens the desktop window after the dev server is ready.

## Build

```bash
npm run build
npm start
```

## Current functionality

- Electron desktop shell with isolated renderer and a minimal preload bridge.
- Dashboard and navigation between planned product areas.
- Interactive legal-move chessboard in the Analysis workspace (powered by `chess.js`).
- Move navigation and notation for moves made during the current session.
- Import dialog UI for PGN, Chess.com and Lichess workflows (import persistence and API sync are not wired yet).
- Responsive desktop layout and reusable visual styles.

## Not implemented yet

- Stockfish engine integration.
- PGN parsing and persistence.
- Chess.com / Lichess account synchronisation.
- Supabase authentication and cloud database.
- Real analytics, training exercises and spaced repetition.
- Native file import through Electron IPC.

All rating/game metrics shown before importing data are placeholders or the user's supplied baseline. The dashboard does not claim to have analysed any games.

## Security notes

The renderer does not receive Node.js access. `contextIsolation` is enabled and `nodeIntegration` is disabled. Add future desktop functionality through narrow, validated IPC methods exposed by `preload.ts`; never expose unrestricted `ipcRenderer` or filesystem APIs.

## Licensing

ChessForge's application code is separate from Stockfish. When Stockfish is distributed with the app, comply with its GPLv3 licensing and source-distribution requirements. Review the licences of all bundled dependencies before public distribution.
