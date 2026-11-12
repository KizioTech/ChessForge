-- Supabase Migration: 000007_phase7_opening_repertoires.sql
-- Phase 7: Opening Repertoires (R3)
--
-- Creates tables for storing opening repertoires and opening moves/lines with
-- Row Level Security (RLS) enabled and indexed foreign keys.

-- 1. opening_repertoires: High-level repertoire containers (White / Black)
create table if not exists opening_repertoires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null check (side in ('white', 'black')),
  title text not null,
  description text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_opening_repertoires_user_side
  on opening_repertoires (user_id, side);

-- Enable RLS
alter table opening_repertoires enable row level security;

-- RLS Policies
create policy "Users can view their own opening repertoires"
  on opening_repertoires for select
  using (auth.uid() = user_id);

create policy "Users can insert their own opening repertoires"
  on opening_repertoires for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own opening repertoires"
  on opening_repertoires for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own opening repertoires"
  on opening_repertoires for delete
  using (auth.uid() = user_id);

-- 2. opening_lines: Tree nodes of moves within a repertoire
create table if not exists opening_lines (
  id uuid primary key default gen_random_uuid(),
  repertoire_id uuid not null references opening_repertoires(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references opening_lines(id) on delete cascade,
  ply integer not null,
  fen text not null,
  san text not null,
  uci text not null,
  side_to_move text not null check (side_to_move in ('white', 'black')),
  is_user_move boolean not null default false,
  comment text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes for tree traversal and position lookup
create index if not exists idx_opening_lines_repertoire_parent
  on opening_lines (repertoire_id, parent_id);

create index if not exists idx_opening_lines_user_fen
  on opening_lines (user_id, fen);

-- Enable RLS
alter table opening_lines enable row level security;

-- RLS Policies
create policy "Users can view their own opening lines"
  on opening_lines for select
  using (auth.uid() = user_id);

create policy "Users can insert their own opening lines"
  on opening_lines for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own opening lines"
  on opening_lines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own opening lines"
  on opening_lines for delete
  using (auth.uid() = user_id);
