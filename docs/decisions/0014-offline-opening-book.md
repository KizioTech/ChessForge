# ADR-0014: Offline Opening Book (Lichess chess-openings)

## Status

Accepted — 2026-11-12

## Context

The `@chess-openings/eco.json` package was used for opening recognition. It
fetched opening data at runtime from
`https://raw.githubusercontent.com/JeffML/eco.json/master/` on every launch.

The app's Content Security Policy (`index.html` → `connect-src`) permits only
Supabase, `api.chess.com`, and `lichess.org`. It does **not** include
`raw.githubusercontent.com`, so the browser silently blocked the download. The
`try/catch` in `src/lib/openings/eco-book.ts` swallowed the network error and
returned an empty book; every downstream call returned `null` or `[]`. The
Openings tab, the Library opening column, and the Analytics opening stats were
all non-functional without any visible error or failing test, because the test
suite tolerated empty results.

Additional concerns with the old approach:

- Requires internet on every launch; opening data could change between runs
  (unpinned `master` branch).
- Mixed licence provenance (SCID, Wikipedia, ChessTempo, plus Lichess
  contributions); attribution obligations were unclear.

## Decision

Replace `@chess-openings/eco.json` with the
[Lichess chess-openings](https://github.com/lichess-org/chess-openings) dataset
(CC0 1.0, public domain), bundled as five TSV files in
`src/data/openings/{a,b,c,d,e}.tsv`.

A new pure-TypeScript module (`src/lib/openings/opening-book.ts`) loads the
files lazily via Vite `?raw` imports, builds a position-keyed index, and
exposes the following API:

| Export | Purpose |
|---|---|
| `loadOpeningBook()` | Lazy-load, cached singleton |
| `identifyOpening(book, sanMoves[])` | Current opening + ply left theory |
| `identifyOpeningFromPgn(book, pgn)` | Skips games with custom start positions |
| `listOpenings(book, opts)` | Synchronous, paginated, filterable catalogue |
| `nextBookMoves(book, sanMoves, limit)` | Theory continuations |
| `openingFamily(name)` | Strips variation suffix after `:` |
| `positionKey(chess)` | Board + turn + castling + legal-EP key |

A companion module (`src/lib/openings/opening-stats.ts`) computes W/D/L
results grouped by opening family for the Analytics view.

The CSP is **not modified**; no new network origins are added.

## Consequences

**Positive**

- 3,865 openings available offline, version-pinned, CC0 licence (no
  attribution required beyond the `docs/licences.md` row).
- No runtime network fetches; CSP remains strict.
- Transpositions resolve correctly because positions are keyed by board state
  (not move order); en-passant square is only included when a legal EP capture
  exists, preventing spurious mismatches.
- Opening recognition is now available in the Library (column per game row),
  the Analytics page (Results by Opening table, min 3 games), and the Openings
  tab.
- Vite code-splits each TSV into a separate async chunk (`a-*.js` … `e-*.js`)
  for lazy loading; no impact on initial bundle size.
- 14 dedicated unit tests assert real opening names, minimum book size,
  transpositions, left-theory detection, and opening stats W/D/L correctness.

**Negative / Trade-offs**

- Dataset is smaller than the old package (3,865 vs ~16,000 entries). Lines
  beyond move 10–12 are rarely reached at club-player level, so coverage is
  sufficient.
- Future Lichess dataset updates require a manual download of the TSV files and
  a new commit; there is no automatic update mechanism.

## Alternatives Considered

**Option A — Relax the CSP** (`connect-src` += `raw.githubusercontent.com`):
Rejected. Keeping a strict CSP is a project principle. The data would still
depend on an unpinned remote branch and require internet access.
