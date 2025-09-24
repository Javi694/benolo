create or replace function public.is_admin(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists(
    select 1 from profiles where id = user_uuid and role = 'admin'
  );
end;
$$;

drop policy if exists "Profiles admin manage" on profiles;

create policy "Profiles admin manage"
  on profiles for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
