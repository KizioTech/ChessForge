-- Migration: create_game_analyses_and_positions
-- Description: Phase 3 tables for storing engine analysis runs and move-by-move evaluations with strict RLS.

-- 1. game_analyses table
create table if not exists public.game_analyses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  engine_name text not null default 'Stockfish',
  engine_version text not null default '16-wasm',
  depth integer not null default 16,
  multipv integer not null default 3,
  status text not null check (status in ('pending', 'running', 'completed', 'aborted', 'failed')) default 'pending',
  moves_analyzed integer not null default 0,
  total_moves integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_game_analyses_game_engine unique (game_id, engine_name, depth)
);

create index if not exists idx_game_analyses_user on public.game_analyses(user_id);
create index if not exists idx_game_analyses_game on public.game_analyses(game_id);
create index if not exists idx_game_analyses_status on public.game_analyses(status);

alter table public.game_analyses enable row level security;

create policy "Users manage own game analyses"
  on public.game_analyses
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. positions table (move-by-move evaluation data)
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.game_analyses(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ply integer not null,
  fen text not null,
  move_san text,
  move_uci text,
  score_cp integer,
  mate_in integer,
  win_probability numeric(5, 2),
  best_move_uci text,
  best_move_san text,
  pv_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_positions_analysis_ply unique (analysis_id, ply)
);

create index if not exists idx_positions_analysis on public.positions(analysis_id);
create index if not exists idx_positions_game on public.positions(game_id);
create index if not exists idx_positions_analysis_ply on public.positions(analysis_id, ply);

alter table public.positions enable row level security;

create policy "Users manage own positions"
  on public.positions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

