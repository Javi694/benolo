create or replace function public.match_is_open_for_predictions(p_match_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from league_matches m
    where m.id = p_match_id
      and coalesce(m.status, 'upcoming') = 'upcoming'
      and m.start_at > timezone('utc', now())
  );
$$;

create or replace function public.league_prediction_guardrail()
returns trigger
language plpgsql
as $$
declare
  match_start timestamptz;
  match_status text;
  now_utc timestamptz := timezone('utc', now());
begin
  select start_at, status
  into match_start, match_status
  from league_matches
  where id = new.match_id;

  if match_start is null then
    raise exception 'Match introuvable pour le pronostic.' using errcode = 'P0001';
  end if;

  if coalesce(match_status, 'upcoming') <> 'upcoming' or match_start <= now_utc then
    if tg_op = 'UPDATE' then
      if coalesce(new.home_score, -9999) = coalesce(old.home_score, -9999)
         and coalesce(new.away_score, -9999) = coalesce(old.away_score, -9999)
         and coalesce(new.confident, false) = coalesce(old.confident, false) then
        return new;
      end if;
    end if;
    raise exception 'Les pronostics sont clos pour ce match.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists league_predictions_guardrail on league_predictions;
create trigger league_predictions_guardrail
  before insert or update on league_predictions
  for each row execute function public.league_prediction_guardrail();

drop policy if exists "League predictions insert by members" on league_predictions;
create policy "League predictions insert by members"
  on league_predictions for insert
  with check (
    public.is_league_member(league_id, auth.uid())
    and user_id = auth.uid()
    and public.match_is_open_for_predictions(match_id)
  );

-- ensure update policy still exists but allow owners/admins while keeping guardrail trigger in place
create or replace policy "League predictions update self"
  on league_predictions for update
  using (
    user_id = auth.uid()
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  )
  with check (
    (user_id = auth.uid() and public.match_is_open_for_predictions(match_id))
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );

create or replace policy "League predictions delete self"
  on league_predictions for delete
  using (
    (user_id = auth.uid() and public.match_is_open_for_predictions(match_id))
    or public.is_league_owner(league_id, auth.uid())
    or public.is_admin(auth.uid())
  );
