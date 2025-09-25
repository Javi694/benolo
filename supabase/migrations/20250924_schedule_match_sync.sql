create extension if not exists pg_net;

create or replace function public.invoke_sync_matches(p_league_ids uuid[] default null)
returns jsonb
language plpgsql
as $$
declare
  base_url text := coalesce(
    nullif(current_setting('app.settings.functions_base_url', true), ''),
    nullif(current_setting('app.settings.supabase_functions_url', true), ''),
    'http://127.0.0.1:54321/functions/v1'
  );
  auth_token text := coalesce(
    nullif(current_setting('app.settings.functions_service_jwt', true), ''),
    nullif(current_setting('app.settings.functions_anon_jwt', true), '')
  );
  headers jsonb := jsonb_build_object('Content-Type', 'application/json');
  payload jsonb := '{}'::jsonb;
  response net.http_response;
  prepared_url text;
  response_json jsonb;
begin
  if auth_token is not null then
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || auth_token);
  end if;

  if p_league_ids is not null and array_length(p_league_ids, 1) > 0 then
    payload := jsonb_build_object(
      'leagueIds',
      (select jsonb_agg(id::text) from unnest(p_league_ids) as id)
    );
  end if;

  prepared_url := base_url || '/sync-matches';

  response := net.http_post(
    url := prepared_url,
    headers := headers,
    body := payload::text,
    timeout_milliseconds := 120000
  );

  response_json := to_jsonb(response);

  if response.status >= 400 then
    raise notice 'sync-matches responded with status %: %', response.status, response.body;
  end if;

  return response_json;
exception
  when others then
    raise notice 'invoke_sync_matches failed: %', sqlerrm;
    return jsonb_build_object('error', sqlerrm);
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'sync_matches_daily';

select cron.schedule(
  'sync_matches_daily',
  '0 4 * * *',
  $$select public.invoke_sync_matches();$$
);
