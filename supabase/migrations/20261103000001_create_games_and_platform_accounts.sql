-- Migration: create_games_and_platform_accounts
-- Description: Creates games and platform_accounts tables with strict RLS and fingerprint uniqueness.

-- 1. platform_accounts table
create table if not exists public.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('chesscom', 'lichess')),
  username text not null,
  last_synced_at timestamptz,
  sync_cursor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_platform_accounts_user_platform_username unique (user_id, platform, username)
);

create index if not exists idx_platform_accounts_user on public.platform_accounts(user_id);

alter table public.platform_accounts enable row level security;

create policy "Users manage own platform accounts"
  on public.platform_accounts
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. games table
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  external_id text,
  fingerprint text not null,
  pgn text not null,
  white text not null,
  black text not null,
  white_elo integer,
  black_elo integer,
  user_colour text not null default 'unknown' check (user_colour in ('white', 'black', 'unknown')),
  result text not null,
  termination text,
  time_control text,
  time_class text,
  rated boolean not null default false,
  played_at timestamptz,
  variant text not null default 'standard',
  start_fen text,
  source text not null default 'upload' check (source in ('upload', 'paste', 'chesscom', 'lichess')),
  moves_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_games_user_fingerprint unique (user_id, fingerprint)
);

-- Partial index for deduplicating synced games with an external ID
create unique index if not exists idx_games_user_platform_external
  on public.games (user_id, platform, external_id)
  where external_id is not null;

-- Query performance indexes
create index if not exists idx_games_user_played_at
  on public.games (user_id, played_at desc nulls last);

create index if not exists idx_games_user_fingerprint
  on public.games (user_id, fingerprint);

create index if not exists idx_games_user_platform
  on public.games (user_id, platform);

alter table public.games enable row level security;

create policy "Users manage own games"
  on public.games
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

