alter table leagues
  add column if not exists signup_deadline timestamptz,
  add column if not exists duration_type text,
  add column if not exists duration_value integer,
  add column if not exists is_paid boolean not null default false,
  add column if not exists investment_protocol text,
  add column if not exists investment_apy_range text,
  add column if not exists investment_risk_level text,
  add column if not exists early_exit_penalty_rate numeric(5,2) default 0,
  add column if not exists reward_distribution_custom jsonb;

alter table leagues
  alter column early_exit_penalty_rate set default 0;
