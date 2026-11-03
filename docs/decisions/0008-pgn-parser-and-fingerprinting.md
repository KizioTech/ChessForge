# 0008. Client-Side PGN Parser, Validation, and SHA-256 Fingerprinting

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
ChessForge requires importing games from multiple sources (manual file uploads, text pasting, and eventual platform sync). Imported games must be validated for legality and deduplicated accurately to prevent skewed analytics, duplicate review queue items, and wasted engine resources.

## Decision
1. **Client-side parsing in TypeScript:** PGN parsing runs in the browser / client using `chess.js` for legal move validation and Seven Tag Roster (STR) extraction. This provides instantaneous validation feedback before network requests or database writes occur.
2. **Deterministic SHA-256 Fingerprinting:**
   - Fingerprint payload formula: `normalized_movetext + "|" + white.toLowerCase().trim() + "|" + black.toLowerCase().trim() + "|" + (date || "").trim()`.
   - `normalized_movetext` consists of sequential SAN moves without comments, annotations, or clock timestamps.
   - SHA-256 is computed using the standard `globalThis.crypto.subtle` API.
3. **Database-enforced uniqueness:** Uniqueness is enforced at the database level with a unique constraint on `(user_id, fingerprint)` and a partial unique index on `(user_id, platform, external_id)`.
4. **Descriptive Error Isolation:** When processing multi-game PGN files, malformed or invalid games are flagged with line snippets and error messages, while valid games proceed with import without blocking the entire file.

## Consequences
- **Positive:** Guaranteed deduplication even if game metadata (e.g. site or round) slightly differs across file exports.
- **Positive:** Instant client-side feedback without overloading backend servers.
- **Trade-off:** Client must parse up to 5 MB PGN files in memory, which is well within desktop/browser capacity for hundreds of games.

