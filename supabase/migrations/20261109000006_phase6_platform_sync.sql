-- Migration: 20261109000006_phase6_platform_sync.sql
-- Description: Phase 6 — Platform integration tables: import_logs.
--              platform_accounts already exists (migration 000001).

-- 1. import_logs: provenance record for every sync run
create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('chesscom', 'lichess')),
  username text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  games_imported integer not null default 0,
  games_skipped integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_import_logs_user_started
  on public.import_logs (user_id, started_at desc);

create index if not exists idx_import_logs_user_platform
  on public.import_logs (user_id, platform);

alter table public.import_logs enable row level security;

create policy "Users manage own import logs"
  on public.import_logs
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
