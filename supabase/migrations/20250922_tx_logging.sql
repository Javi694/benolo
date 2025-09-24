create table if not exists league_transactions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete set null,
  action text not null,
  tx_hash text not null,
  wallet_address text,
  chain_id bigint,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists league_transactions_league_idx on league_transactions(league_id);
create index if not exists league_transactions_action_idx on league_transactions(action);

alter table league_transactions enable row level security;

create policy league_transactions_service
  on league_transactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy league_transactions_admin_read
  on league_transactions
  for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create policy league_transactions_member_read
  on league_transactions
  for select
  using (
    league_id in (
      select league_id from league_members where league_members.user_id = auth.uid()
    )
  );
