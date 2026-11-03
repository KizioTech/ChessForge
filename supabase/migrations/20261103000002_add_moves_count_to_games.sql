-- Migration: add_moves_count_to_games
-- Adds moves_count column to the games table if it does not already exist.

alter table public.games
add column if not exists moves_count integer not null default 0;
