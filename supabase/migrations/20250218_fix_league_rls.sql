create or replace function public.is_league_member(p_league_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = p_user_id
  );
end;
$$;

create or replace function public.is_league_owner(p_league_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from leagues l
    where l.id = p_league_id
      and l.creator_id = p_user_id
  );
end;
$$;

drop policy if exists "Leagues public read" on leagues;

create policy "Leagues public read"
  on leagues for select
  using (
    is_public
    or creator_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_league_member(id, auth.uid())
  );

drop policy if exists "League members read" on league_members;
drop policy if exists "League members manage owner" on league_members;

create policy "League members read"
  on league_members for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_league_owner(league_id, auth.uid())
  );

create policy "League members manage"
  on league_members for all
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_league_owner(league_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_league_owner(league_id, auth.uid())
  );
