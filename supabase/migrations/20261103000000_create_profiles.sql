-- Migration: 20261103000000_create_profiles.sql
-- Description: Creates the profiles table with RLS enabled and automatic profile creation on user signup.

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security immediately
alter table public.profiles enable row level security;

-- 3. RLS Policies
create policy "Users can view and update their own profile"
  on public.profiles
  for all
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 4. Trigger to handle profile creation on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, settings)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    '{}'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger if it already exists before creating
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

