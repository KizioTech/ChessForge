# ADR-0012: Platform Integration Architecture (Phase 6)

- **Date:** 2026-11-09
- **Status:** Accepted

## Context

Phase 6 adds automatic game synchronisation from Chess.com and Lichess. The core design constraint from the documentation set (ADR-0006) is: **manual PGN import must remain fully functional regardless of platform API availability**. Platform sync is an enhancement, not a replacement.

## Decisions

### 1. Client-side adapter architecture (no Edge Functions)

The documentation specifies server-side Edge Functions for sync. However, since ChessForge is an Electron desktop app with no server-side execution environment beyond Supabase, and both Chess.com and Lichess offer public read-only APIs that do not require server-side secrets or OAuth for public game data, the adapters run client-side in the renderer process.

**Consequences:**
- No Supabase Edge Function deployment required (zero additional infrastructure).
- Chess.com PubAPI and Lichess export API for public accounts require no credentials.
- API credentials (if needed in future for private games) must be stored securely in Electron's keychain, never in source code.

### 2. Single-threaded adapter loop per account

The sync engine processes one adapter page at a time per account, enforcing the Lichess constraint of "one request at a time". An `AbortController` is passed to every adapter call to support mid-flight cancellation.

### 3. Resumable sync via cursor checkpoints

After every successful adapter page, the cursor is persisted to `platform_accounts.sync_cursor`. If the app closes or the sync is cancelled, the next run resumes exactly where it left off.

### 4. Rate limit handling

- Chess.com: exponential-capped back-off (min 60 s, max 5 min) on 429.
- Lichess: minimum 60-second wait on 429 as required by their API terms.
- Both: a `RateLimitError` class carries `retryAfterMs` surfaced to the UI.

### 5. Deduplication

Two independent deduplication layers:
1. `(user_id, platform, external_id)` unique index — guards synced games.
2. `(user_id, fingerprint)` SHA-256 unique index — safety net shared with manual uploads.

Both layers are enforced at the database level; the client-side `saveParsedGames` function provides a fast pre-check using in-memory fingerprint sets.

### 6. `import_logs` table for audit and resumability

Every sync run writes an `import_logs` row (created at the start, finalised at the end). This provides:
- Full sync history visible to the user.
- Diagnostic detail (games imported, skipped, errors) for troubleshooting.
- Status field (`running`, `completed`, `failed`, `cancelled`) for resumability signals.

## Consequences

- **Positive:** No server infrastructure required; works offline (cursor preserved locally).
- **Positive:** Rate-limit rules are enforced at the code level, not by policy.
- **Positive:** Manual PGN import is entirely unaffected.
- **Negative:** Chess.com and Lichess can change their public API without notice; adapters must be validated against real accounts before each release.
- **Action required:** Re-read Chess.com and Lichess API terms before every release that changes sync behaviour (per Part 5 of the documentation set).
