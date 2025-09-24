create or replace view public.league_leaderboard as
select
  league_id,
  user_id,
  sum(points) as total_points,
  count(*) filter (where points is not null) as predictions_count,
  count(*) filter (
    where points is not null
      and coalesce(home_score, away_score) is not null
      and exists (
        select 1
        from league_matches m
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
  and points > 0
group by league_id, user_id;
