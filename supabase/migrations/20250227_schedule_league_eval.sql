create extension if not exists pg_cron;

-- remove existing job if present
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
