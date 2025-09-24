alter table leagues
  add column if not exists vault_address text,
  add column if not exists strategy_id text,
  add column if not exists commission_bps integer default 1000;

alter table leagues
  alter column commission_bps set default 1000;

alter table leagues
  add constraint leagues_commission_bps_check
    check (commission_bps is null or (commission_bps >= 0 and commission_bps <= 10000));

alter table leagues
  alter column early_exit_penalty_rate type numeric(5,2) using early_exit_penalty_rate::numeric(5,2);

alter table leagues
  add constraint leagues_exit_penalty_check
    check (early_exit_penalty_rate >= 0 and early_exit_penalty_rate <= 100);

create index if not exists leagues_strategy_id_idx on leagues(strategy_id);
