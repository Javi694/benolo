create or replace function public.evaluate_league_start(p_league_id uuid)
returns void
language plpgsql
as $$
declare
  league_record leagues%rowtype;
  member_count integer := 0;
  should_start boolean := false;
  new_status text;
  new_started_at timestamptz;
begin
  select * into league_record
  from leagues
  where id = p_league_id
  for update;

  if not found then
    return;
  end if;

  new_status := league_record.status;
  new_started_at := league_record.started_at;

  if league_record.status <> 'completed' then
    if league_record.start_condition = 'participants' then
      select count(*) into member_count
      from league_members
      where league_id = league_record.id;

      if league_record.start_min_participants is not null
         and member_count >= league_record.start_min_participants then
        should_start := true;
      end if;
    else
      if league_record.start_at is not null
         and league_record.start_at <= timezone('utc', now()) then
        should_start := true;
      end if;
    end if;

    if should_start then
      new_status := 'active';
      new_started_at := coalesce(league_record.started_at, timezone('utc', now()));
    end if;
  end if;

  if league_record.start_condition = 'participants'
     and league_record.start_min_participants is not null
     and new_status = 'active' then
    select count(*) into member_count
    from league_members
    where league_id = league_record.id;

    if member_count < league_record.start_min_participants then
      new_status := 'draft';
    end if;
  end if;

  update leagues
  set status = new_status,
      started_at = new_started_at
  where id = league_record.id
    and (status <> new_status or started_at is distinct from new_started_at);
end;
$$;

create or replace function public.leagues_after_change()
returns trigger
language plpgsql
as $$
begin
  perform public.evaluate_league_start(new.id);
  return new;
end;
$$;

create or replace function public.league_members_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.evaluate_league_start(old.league_id);
    return old;
  else
    perform public.evaluate_league_start(new.league_id);
    return new;
  end if;
end;
$$;

drop trigger if exists leagues_eval_start on leagues;
create trigger leagues_eval_start
  after insert or update of start_condition, start_min_participants, start_at, status
  on leagues
  for each row
  execute function public.leagues_after_change();

drop trigger if exists league_members_eval_start on league_members;
create trigger league_members_eval_start
  after insert or update or delete on league_members
  for each row
  execute function public.league_members_after_change();

create or replace function public.league_allows_predictions(p_league_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  league_record leagues%rowtype;
  member_count integer := 0;
begin
  select * into league_record
  from leagues
  where id = p_league_id;

  if not found then
    return false;
  end if;

  if league_record.status = 'active' then
    return true;
  end if;

  if league_record.start_condition = 'participants' then
    if league_record.start_min_participants is null then
      return false;
    end if;

    select count(*) into member_count
    from league_members
    where league_id = league_record.id;

    return member_count >= league_record.start_min_participants;
  end if;

  if league_record.start_at is not null
     and league_record.start_at <= timezone('utc', now()) then
    return true;
  end if;

  return false;
end;
$$;

-- policies defined in previous migrations are replaced here

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'league_start_eval';

select cron.schedule(
  'league_start_eval',
  '* * * * *',
  $$
    select public.evaluate_league_start(id)
    from leagues
    where status <> 'completed'
  $$
);
