create table if not exists league_matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  external_ref text,
  home_team text not null,
  away_team text not null,
  start_at timestamptz not null,
  status text not null default 'upcoming',
  home_score integer,
  away_score integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists league_matches_league_id_idx on league_matches(league_id);
create index if not exists league_matches_start_at_idx on league_matches(start_at);
create index if not exists league_matches_status_idx on league_matches(status);

create trigger league_matches_set_updated_at
  before update on league_matches
  for each row execute function public.set_updated_at();

create table if not exists league_predictions (
  id bigserial primary key,
  match_id uuid not null references league_matches(id) on delete cascade,
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  home_score integer,
  away_score integer,
  confident boolean default false,
  points numeric(10,2) default 0,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (match_id, user_id)
);

create index if not exists league_predictions_match_idx on league_predictions(match_id);
create index if not exists league_predictions_league_idx on league_predictions(league_id);
create index if not exists league_predictions_user_idx on league_predictions(user_id);

create trigger league_predictions_set_updated_at
  before update on league_predictions
  for each row execute function public.set_updated_at();

alter table league_matches enable row level security;
alter table league_predictions enable row level security;

create policy "League matches readable by members"
  on league_matches for select
  using (
    public.is_league_member(league_id, auth.uid())
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );

create policy "League matches manageable by owner"
  on league_matches for all
  using (
    public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  )
  with check (
    public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );

create policy "League predictions readable by members"
  on league_predictions for select
  using (
    public.is_league_member(league_id, auth.uid())
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );

create policy "League predictions insert by members"
  on league_predictions for insert
  with check (
    public.is_league_member(league_id, auth.uid())
    and user_id = auth.uid()
  );

create policy "League predictions update self"
  on league_predictions for update
  using (
    user_id = auth.uid()
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );

create policy "League predictions delete self"
  on league_predictions for delete
  using (
    user_id = auth.uid()
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );
