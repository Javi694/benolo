create extension if not exists pgcrypto;

create or replace function public.generate_league_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from leagues where code = new_code);
  end loop;
  return new_code;
end;
$$;

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.generate_league_code(),
  name text not null,
  description text,
  creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft',
  entry_fee numeric(12,2) default 0,
  currency text not null default 'USDC',
  is_public boolean not null default true,
  max_members integer,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists leagues_creator_idx on leagues(creator_id);
create index if not exists leagues_status_idx on leagues(status);
create index if not exists leagues_public_idx on leagues(is_public);

create trigger leagues_set_updated_at
  before update on leagues
  for each row execute function public.set_updated_at();

create table if not exists league_members (
  id bigserial primary key,
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'pending',
  joined_at timestamptz not null default timezone('utc', now()),
  unique (league_id, user_id)
);

create index if not exists league_members_league_idx on league_members(league_id);
create index if not exists league_members_user_idx on league_members(user_id);
create index if not exists league_members_role_idx on league_members(role);

create or replace function public.handle_league_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into league_members (league_id, user_id, role, status, joined_at)
  values (new.id, new.creator_id, 'owner', 'active', timezone('utc', now()))
  on conflict (league_id, user_id)
  do update set role = 'owner', status = 'active';
  return new;
end;
$$;

create trigger leagues_handle_insert
  after insert on leagues
  for each row execute function public.handle_league_created();

alter table leagues enable row level security;
alter table league_members enable row level security;

create policy "Leagues public read"
  on leagues for select
  using (
    is_public
    or creator_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from league_members lm
      where lm.league_id = leagues.id and lm.user_id = auth.uid()
    )
  );

create policy "Leagues self insert"
  on leagues for insert
  with check (creator_id = auth.uid());

create policy "Leagues manage owner"
  on leagues for update
  using (creator_id = auth.uid() or public.is_admin(auth.uid()))
  with check (creator_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Leagues delete owner"
  on leagues for delete
  using (creator_id = auth.uid() or public.is_admin(auth.uid()));

create policy "League members read"
  on league_members for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from leagues l
      where l.id = league_id and l.creator_id = auth.uid()
    )
  );

create policy "League members manage owner"
  on league_members for all
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from leagues l
      where l.id = league_id and l.creator_id = auth.uid()
    )
  )
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from leagues l
      where l.id = league_id and l.creator_id = auth.uid()
    )
  );
