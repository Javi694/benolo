alter table leagues
  add column if not exists completed_at timestamptz;

create index if not exists leagues_completed_at_idx on leagues(completed_at);

create unique index if not exists league_matches_league_external_ref_idx
  on league_matches(league_id, external_ref)
  where external_ref is not null;

create or replace function public.evaluate_league_completion(p_league_id uuid)
returns void
language plpgsql
as $$
declare
  league_record leagues%rowtype;
  total_matches integer := 0;
  completed_matches integer := 0;
  has_active boolean := false;
begin
  if p_league_id is null then
    return;
  end if;

  select * into league_record
  from leagues
  where id = p_league_id
  for update;

  if not found then
    return;
  end if;

  select count(*) into total_matches
  from league_matches
  where league_id = p_league_id;

  if total_matches = 0 then
    if league_record.status = 'completed' then
      update leagues
      set status = 'draft',
          completed_at = null
      where id = p_league_id;
    end if;
    return;
  end if;

  select count(*) into completed_matches
  from league_matches
  where league_id = p_league_id
    and status = 'completed'
    and home_score is not null
    and away_score is not null;

  select exists (
    select 1
    from league_matches
    where league_id = p_league_id
      and status in ('upcoming', 'live')
  ) into has_active;

  if completed_matches = total_matches then
    update leagues
    set status = 'completed',
        completed_at = coalesce(league_record.completed_at, timezone('utc', now())),
        end_at = coalesce(league_record.end_at, timezone('utc', now()))
    where id = p_league_id
      and (status <> 'completed'
        or completed_at is distinct from league_record.completed_at
        or end_at is distinct from league_record.end_at);
  elsif league_record.status = 'completed' then
    update leagues
    set status = case when has_active then 'active' else 'draft' end,
        completed_at = null
    where id = p_league_id;
  end if;
end;
$$;

create or replace function public.league_matches_eval_completion()
returns trigger
language plpgsql
as $$
declare
  target_league_id uuid;
begin
  if tg_op = 'DELETE' then
    target_league_id := old.league_id;
  else
    target_league_id := new.league_id;
  end if;

  perform public.evaluate_league_completion(target_league_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists league_matches_eval_completion on league_matches;
create trigger league_matches_eval_completion
  after insert or update of status, home_score, away_score on league_matches
  for each row
  execute function public.league_matches_eval_completion();

drop trigger if exists league_matches_eval_completion_delete on league_matches;
create trigger league_matches_eval_completion_delete
  after delete on league_matches
  for each row
  execute function public.league_matches_eval_completion();
