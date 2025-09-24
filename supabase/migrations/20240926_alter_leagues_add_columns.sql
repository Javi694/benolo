alter table leagues
  add column if not exists championship text,
  add column if not exists strategy text,
  add column if not exists reward_distribution text not null default 'winner-only',
  add column if not exists can_leave boolean not null default false;

alter table leagues
  alter column reward_distribution set default 'winner-only';
