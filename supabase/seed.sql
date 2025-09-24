-- Seed helper to add demo matches when running `supabase db reset`.
insert into league_matches (league_id, home_team, away_team, start_at, status)
select
  id,
  'Demo FC',
  'Sample United',
  timezone('utc', now()) + interval '3 days',
  'upcoming'
from leagues
where is_public = true
limit 1
on conflict do nothing;

insert into league_matches (league_id, home_team, away_team, start_at, status)
select
  id,
  'Fallback City',
  'Placeholder Town',
  timezone('utc', now()) + interval '6 days',
  'upcoming'
from leagues
where is_public = true
limit 1
on conflict do nothing;
