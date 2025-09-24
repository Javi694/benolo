-- Profiles table stores public info for each authenticated user.
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url text,
  country_code text,
  preferred_language text default 'en',
  bio text,
  role text not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Track external auth providers the player connected (Google, Apple, Meta, etc.).
create table if not exists user_connections (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  provider text not null,
  provider_uid text not null,
  metadata jsonb default '{}'::jsonb,
  connected_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_connections_provider_uid_idx
  on user_connections (provider, provider_uid);

create index if not exists user_connections_user_id_idx
  on user_connections (user_id);

-- Wallets linked to a player account.
create table if not exists user_wallets (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  address text not null,
  network text not null default 'evm',
  label text,
  is_primary boolean default false,
  verified boolean default false,
  linked_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_wallets_address_unique
  on user_wallets (lower(address));

create unique index if not exists user_wallets_primary_unique
  on user_wallets (user_id)
  where is_primary;

create index if not exists user_wallets_user_id_idx
  on user_wallets (user_id);

-- Maintain updated_at column on profiles.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

-- Enable row level security.
alter table profiles enable row level security;
alter table user_connections enable row level security;
alter table user_wallets enable row level security;

-- RLS policies for profiles.
create policy "Profiles are viewable by owner"
  on profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Allow the service role to manage profiles (for Edge Functions / Admin tasks).
create policy "Profiles service role access"
  on profiles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- RLS policies for connections.
create policy "Connections visible to owner"
  on user_connections for select
  using (auth.uid() = user_id);

create policy "Connections manageable by owner"
  on user_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Connections service role access"
  on user_connections for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- RLS policies for wallets.
create policy "Wallets visible to owner"
  on user_wallets for select
  using (auth.uid() = user_id);

create policy "Wallets manageable by owner"
  on user_wallets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Wallets service role access"
  on user_wallets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Helper function to keep a single primary wallet per user.
create or replace function public.ensure_single_primary_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_primary then
    update user_wallets
    set is_primary = false
    where user_id = new.user_id
      and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger user_wallets_single_primary
  after insert or update on user_wallets
  for each row execute function public.ensure_single_primary_wallet();

-- Ensure email-providers metadata stay unique (optional guard).
create or replace function public.handle_user_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = new.id) then
    insert into profiles (id, display_name, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Player'),
      case when exists (select 1 from profiles) then 'user' else 'admin' end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- Hook into auth.users so local stack mimics production behaviour.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_user_new();
