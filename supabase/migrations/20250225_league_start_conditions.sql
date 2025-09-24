alter table leagues
  add column if not exists start_condition text default 'date',
  add column if not exists start_min_participants integer,
  add column if not exists started_at timestamptz;

update leagues
  set start_condition = coalesce(start_condition, 'date');

create index if not exists leagues_start_condition_idx on leagues(start_condition);
create index if not exists leagues_start_min_participants_idx on leagues(start_min_participants);
