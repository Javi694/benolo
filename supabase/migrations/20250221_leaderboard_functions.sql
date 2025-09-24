create or replace function public.compute_prediction_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer,
  is_confident boolean
)
returns numeric
language plpgsql
as $$
declare
  predicted_diff integer;
  actual_diff integer;
  total numeric := 0;
  predicted_result integer;
  actual_result integer;
begin
  if predicted_home is null or predicted_away is null then
    return 0;
  end if;
  if actual_home is null or actual_away is null then
    return 0;
  end if;

  predicted_diff := predicted_home - predicted_away;
  actual_diff := actual_home - actual_away;

  predicted_result := case when predicted_diff = 0 then 0 when predicted_diff > 0 then 1 else -1 end;
  actual_result := case when actual_diff = 0 then 0 when actual_diff > 0 then 1 else -1 end;

  if predicted_home = actual_home and predicted_away = actual_away then
    total := total + 5;
  end if;

  if predicted_result = actual_result then
    total := total + 3;
  end if;

  if predicted_diff = actual_diff then
    total := total + 2;
  end if;

  if is_confident then
    total := total * 1.1;
  end if;

  return total;
end;
$$;

create or replace function public.update_prediction_points()
returns trigger
language plpgsql
as $$
declare
  match_record record;
  computed_points numeric;
begin
  select home_score, away_score
  into match_record
  from league_matches
  where id = new.match_id;

  computed_points := public.compute_prediction_points(
    new.home_score,
    new.away_score,
    match_record.home_score,
    match_record.away_score,
    new.confident
  );

  new.points := computed_points;

  if new.home_score is not null and new.away_score is not null then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

create trigger league_predictions_compute_points
  before insert or update on league_predictions
  for each row execute function public.update_prediction_points();

create or replace view public.league_leaderboard as
select
  league_id,
  user_id,
  sum(points) as total_points,
  count(*) filter (where points is not null) as predictions_count
from league_predictions
where points is not null
  and status <> 'pending'
group by league_id, user_id;
