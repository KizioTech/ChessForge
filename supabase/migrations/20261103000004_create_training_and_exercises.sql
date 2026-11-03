-- Migration: create_training_and_exercises
-- Description: Phase 4 tables for mistakes, generated training exercises, spaced repetition review schedule, and attempts.

-- 1. mistakes table
create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  position_id uuid references public.positions(id) on delete set null,
  ply integer not null,
  fen text not null,
  played_san text not null,
  played_uci text not null,
  engine_class text not null check (engine_class in ('inaccuracy', 'mistake', 'blunder')),
  win_pct_loss numeric(5, 2) not null,
  best_uci text,
  best_san text,
  tags text[] not null default array[]::text[],
  tag_confidence jsonb not null default '{}'::jsonb,
  user_corrected boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mistakes_user on public.mistakes(user_id);
create index if not exists idx_mistakes_game on public.mistakes(game_id);
create index if not exists idx_mistakes_class on public.mistakes(engine_class);

alter table public.mistakes enable row level security;

create policy "Users manage own mistakes"
  on public.mistakes
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. training_exercises table
create table if not exists public.training_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mistake_id uuid references public.mistakes(id) on delete set null,
  game_id uuid references public.games(id) on delete cascade,
  fen text not null,
  user_colour text not null check (user_colour in ('white', 'black')),
  exercise_type text not null check (exercise_type in ('attack', 'defence', 'avoid_blunder')),
  prompt text not null,
  solutions jsonb not null default '[]'::jsonb,
  principal_variation jsonb not null default '[]'::jsonb,
  blunder_move jsonb,
  themes text[] not null default array[]::text[],
  difficulty text not null default 'medium',
  status text not null check (status in ('active', 'mastered', 'flagged')) default 'active',
  flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_exercises_user_fen unique (user_id, fen)
);

create index if not exists idx_training_exercises_user on public.training_exercises(user_id);
create index if not exists idx_training_exercises_status on public.training_exercises(status);
create index if not exists idx_training_exercises_game on public.training_exercises(game_id);

alter table public.training_exercises enable row level security;

create policy "Users manage own exercises"
  on public.training_exercises
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3. review_schedule table (SM-2 spaced repetition state)
create table if not exists public.review_schedule (
  exercise_id uuid primary key references public.training_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days numeric(6, 2) not null default 1.0,
  ease_factor numeric(4, 2) not null default 2.50,
  repetitions integer not null default 0,
  lapses integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_review_schedule_user_due on public.review_schedule(user_id, due_at);

alter table public.review_schedule enable row level security;

create policy "Users manage own review schedule"
  on public.review_schedule
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 4. exercise_attempts table
create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.training_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  correct boolean not null,
  duration_ms integer not null default 0,
  hints_used integer not null default 0,
  moves_tried jsonb not null default '[]'::jsonb,
  grade text not null check (grade in ('Again', 'Hard', 'Good', 'Easy'))
);

create index if not exists idx_exercise_attempts_user on public.exercise_attempts(user_id);
create index if not exists idx_exercise_attempts_exercise on public.exercise_attempts(exercise_id);

alter table public.exercise_attempts enable row level security;

create policy "Users manage own exercise attempts"
  on public.exercise_attempts
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 5. training_sessions table
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  exercises_done integer not null default 0,
  exercises_correct integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_training_sessions_user on public.training_sessions(user_id);

alter table public.training_sessions enable row level security;

create policy "Users manage own training sessions"
  on public.training_sessions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
