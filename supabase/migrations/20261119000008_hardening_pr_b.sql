-- Migration: 20261119000008_hardening_pr_b.sql
-- Description: Hardening schema updates for PR B:
--   1. review_schedule.consecutive_successes column
--   2. mistakes provenance (analysis_id, source, updated_at) and unique index
--   3. training_exercises normalized fen_key and unique index
--   4. atomic replace_analysis RPC function
--   5. game_analyses engine_version default to '19-lite-wasm'

-- 1. Review Schedule: Add consecutive_successes
alter table public.review_schedule
  add column if not exists consecutive_successes integer not null default 0;

-- 2. Mistakes: Add provenance, source, updated_at and unique index per analysis ply
alter table public.mistakes
  add column if not exists analysis_id uuid references public.game_analyses(id) on delete cascade,
  add column if not exists source text not null default 'stockfish'
    check (source in ('stockfish', 'heuristic')),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists uq_mistakes_analysis_ply
  on public.mistakes (analysis_id, ply) where analysis_id is not null;

-- 3. Training Exercises: Normalized fen_key and unique constraint
-- Normalize FEN to first 4 fields: piece placement, active color, castling, en passant
alter table public.training_exercises
  add column if not exists fen_key text generated always as (
    split_part(fen, ' ', 1) || ' ' || split_part(fen, ' ', 2) || ' ' ||
    split_part(fen, ' ', 3) || ' ' || split_part(fen, ' ', 4)
  ) stored;

alter table public.training_exercises drop constraint if exists uq_exercises_user_fen;
create unique index if not exists uq_exercises_user_fen_key
  on public.training_exercises (user_id, fen_key);

-- 4. Default drift: Update engine_version default
alter table public.game_analyses
  alter column engine_version set default '19-lite-wasm';

-- 5. Atomic analysis replace RPC function
create or replace function public.replace_analysis(
  p_analysis jsonb,
  p_positions jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into public.game_analyses as ga (
    id, game_id, user_id, engine_name, engine_version, depth, multipv,
    status, moves_analyzed, total_moves, completed_at
  )
  values (
    coalesce((p_analysis->>'id')::uuid, gen_random_uuid()),
    (p_analysis->>'game_id')::uuid,
    auth.uid(),
    coalesce(p_analysis->>'engine_name', 'Stockfish'),
    coalesce(p_analysis->>'engine_version', '19-lite-wasm'),
    (p_analysis->>'depth')::int,
    (p_analysis->>'multipv')::int,
    coalesce(p_analysis->>'status', 'completed'),
    (p_analysis->>'moves_analyzed')::int,
    (p_analysis->>'total_moves')::int,
    now()
  )
  on conflict (game_id, engine_name, depth) do update
    set status = excluded.status,
        moves_analyzed = excluded.moves_analyzed,
        total_moves = excluded.total_moves,
        engine_version = excluded.engine_version,
        completed_at = excluded.completed_at,
        updated_at = now()
  returning id into v_id;

  delete from public.positions where analysis_id = v_id;

  insert into public.positions (
    analysis_id, game_id, user_id, ply, fen, move_san, move_uci,
    score_cp, mate_in, win_probability, best_move_uci, best_move_san, pv_lines
  )
  select v_id, (p->>'game_id')::uuid, auth.uid(), (p->>'ply')::int, p->>'fen',
         p->>'move_san', p->>'move_uci', (p->>'score_cp')::int, (p->>'mate_in')::int,
         (p->>'win_probability')::numeric, p->>'best_move_uci', p->>'best_move_san',
         coalesce(p->'pv_lines', '[]'::jsonb)
  from jsonb_array_elements(p_positions) p;

  return v_id;
end $$;
