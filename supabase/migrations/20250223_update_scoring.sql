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
    total := 6;
  elsif predicted_result = actual_result then
    total := 3;
  else
    total := 0;
  end if;

  if is_confident and total > 0 then
    total := total * 1.1;
  end if;

  return total;
end;
$$;
