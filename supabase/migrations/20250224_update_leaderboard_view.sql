create or replace view public.league_leaderboard as
select
  league_id,
  user_id,
  sum(points) as total_points,
  count(*) filter (where points is not null) as predictions_count,
  count(*) filter (
    where points is not null
      and exists (
        select 1 from league_matches m
        where m.id = league_predictions.match_id
          and m.home_score is not null
          and m.away_score is not null
          and league_predictions.home_score = m.home_score
          and league_predictions.away_score = m.away_score
      )
  ) as correct_count
from league_predictions
where status <> 'pending'
  and points is not null
group by league_id, user_id;

create or replace function public.refresh_prediction_points_for_match()
returns trigger
language plpgsql
as $$
begin
  update league_predictions
  set
    points = public.compute_prediction_points(
      home_score,
      away_score,
      new.home_score,
      new.away_score,
      confident
    ),
    status = case
      when home_score is not null and away_score is not null then 'submitted'
      else status
    end,
    updated_at = timezone('utc', now())
  where match_id = new.id;

  return new;
end;
$$;

create or replace function public.refresh_prediction_points_after_insert()
returns trigger
language plpgsql
as $$
begin
  update league_predictions lp
  set
    points = public.compute_prediction_points(
      lp.home_score,
      lp.away_score,
      m.home_score,
      m.away_score,
      lp.confident
    ),
    status = case
      when lp.home_score is not null and lp.away_score is not null then 'submitted'
      else lp.status
    end
  from league_matches m
  where lp.id = new.id
    and m.id = new.match_id;

  return new;
end;
$$;

create or replace function public.refresh_prediction_points_after_update()
returns trigger
language plpgsql
as $$
begin
  if row(new.*) = row(old.*) then
    return new;
  end if;

  update league_predictions lp
  set
    points = public.compute_prediction_points(
      lp.home_score,
      lp.away_score,
      m.home_score,
      m.away_score,
      lp.confident
    ),
    status = case
      when lp.home_score is not null and lp.away_score is not null then 'submitted'
      else lp.status
    end,
    updated_at = timezone('utc', now())
  from league_matches m
  where lp.id = new.id
    and m.id = new.match_id;

  return new;
end;
$$;

-- Match score updates should refresh linked predictions
create or replace trigger league_matches_refresh_predictions
  after update of home_score, away_score on league_matches
  for each row
  execute function public.refresh_prediction_points_for_match();

-- Users upserting predictions get immediate point recalculation
drop trigger if exists league_predictions_compute_points on league_predictions;

drop trigger if exists league_predictions_after_update on league_predictions;

drop trigger if exists league_predictions_after_insert on league_predictions;

create trigger league_predictions_after_insert
  after insert on league_predictions
  for each row
  execute function public.refresh_prediction_points_after_insert();

create trigger league_predictions_after_update
  after update on league_predictions
  for each row
  execute function public.refresh_prediction_points_after_update();
