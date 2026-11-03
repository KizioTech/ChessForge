# 0007. Licensing Approach (GPL Obligations of Stockfish & Chessground)

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
ChessForge utilizes Stockfish (licensed under GNU General Public License v3) and Chessground (licensed under GNU General Public License v3). Distributing an application incorporating these components triggers reciprocal GPL requirements (providing corresponding source code under a GPL-compatible license).

## Decision
1. We document all components, versions, and obligations in `docs/licences.md` continuously.
2. For public distribution, ChessForge source code will be published under a GPL-compatible license (GPLv3).
3. If commercial or proprietary distribution is evaluated in the future, architectural separation (e.g. running Stockfish strictly as a separate external subprocess via standard UCI protocol) will be reviewed with legal counsel.

## Consequences
- **Positive:** Full compliance with open source licensing; direct leverage of industry-standard chess engines and UI boards.

