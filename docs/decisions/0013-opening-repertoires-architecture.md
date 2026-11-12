# ADR 0013: Opening Repertoires Tree Architecture & Deviation Detection

## Context
Phase 7 introduces structured Opening Repertoires for White and Black. A player needs to:
1. Build and browse branching opening trees with explanations and commentary.
2. Import PGN studies/lines and export their repertoire to PGN.
3. Drill their lines interactively (active recall).
4. Detect when real games played on Chess.com or Lichess deviated from their prepared preparation.

## Decision

### 1. Tree Representation & Data Modeling
- Repertoires are partitioned by side (`white` and `black`).
- Repertoire moves are stored in `opening_lines` as a tree with `parent_id` foreign key pointers.
- Each node stores normalized FEN (EPD format: piece placement, active colour, castling rights, and en passant square, without halfmove clock / fullmove number) for reliable transposition and position matching.
- Every node stores both SAN (for human readability/export) and UCI (for engine and chess.js execution).

### 2. Dual-Layer Storage Pattern
Consistent with ADR 0009 and ADR 0012:
- When authenticated with Supabase, repertoires and lines are persisted to `opening_repertoires` and `opening_lines` with RLS.
- When unauthenticated or working offline, the service falls back to localStorage keys (`chessforge:repertoires_v1`, `chessforge:repertoire_lines_v1`).

### 3. Practice / Drilling Engine
- Drilling operates by walking the repertoire tree from root (ply 0).
- For opponent plies: the system automatically selects an opponent response (randomly picking from available repertoire branches).
- For user plies: the user plays a move on the board.
  - If the move matches the repertoire choice: success feedback is displayed, and the drill continues down that variation.
  - If the move is illegal or not in the repertoire: the system flags the expected move and offers a retry or continuation.
- Progress metrics (accuracy %, lines completed) are calculated per session.

### 4. Game Deviation Detection
- For any user game with a detected player colour (`"white"` or `"black"`), the engine matches moves ply-by-ply against the active repertoire tree for that colour.
- When the player plays a move that differs from their repertoire move at a given position, a deviation is logged:
  - Exact ply and move number
  - Played move vs. Repertoire intended move
  - FEN of the deviation position
- Deviations can be reviewed directly in the Analysis and Openings views.

## Consequences
- Fast client-side tree queries with $O(1)$ FEN map lookups.
- Full offline support without losing opening repertoire trees.
- Zero server computation required for drilling or deviation scanning.
