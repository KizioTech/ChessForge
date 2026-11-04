-- Migration: 20261104000005_phase5_insight.sql
-- Description: Phase 5 views and helpers for weakness diagnosis and mistake tagging.

-- 1. Create view for aggregating user mistake tag counts and blunder rates
create or replace view public.mistake_tag_summary as
select
  user_id,
  tag,
  count(*) as mistake_count,
  round(avg(win_pct_loss), 2) as avg_win_pct_loss
from
  public.mistakes,
  unnest(tags) as tag
group by
  user_id,
  tag;

-- 2. Add an index to speed up mistake tag queries
create index if not exists idx_mistakes_tags on public.mistakes using gin(tags);
create index if not exists idx_mistakes_created_at on public.mistakes(created_at);

