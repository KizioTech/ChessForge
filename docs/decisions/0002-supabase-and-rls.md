# 0002. Supabase Backend and Database-Level Row Level Security

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
ChessForge stores private user data: games, personal mistake profiles, spaced repetition attempt histories, and performance analytics. A security and authorization model is required that guarantees user privacy and data isolation.

## Decision
We chose Supabase (PostgreSQL + Auth + Edge Functions) with PostgreSQL Row Level Security (RLS) as the primary authorization layer:
1. Every user-owned table carries `user_id` and has RLS enabled in the exact migration that creates it.
2. Policies explicitly enforce `user_id = (select auth.uid())` on all operations (`USING` and `WITH CHECK`).
3. Client-side code operates strictly with the public `anon` key. The `service_role` key is never exposed to the client.

## Alternatives Considered
- **Local SQLite only:** Would prevent cross-device synchronization and web deployment until R5.
- **Custom Node.js / Express API:** Higher operational maintenance burden; requires maintaining custom authentication, token handling, and authorization middleware.

## Consequences
- **Positive:** Robust database-level isolation, zero-cost operational tier for single user, out-of-the-box secure magic link authentication.
- **Negative:** Schema migrations and RLS policies must be meticulously authored and tested with automated cross-user policy tests.

