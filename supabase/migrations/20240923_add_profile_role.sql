alter table profiles
  add column if not exists role text not null default 'user';

update profiles
set role = 'user'
where role is null;

create index if not exists profiles_role_idx on profiles(role);

drop policy if exists "Profiles admin manage" on profiles;

create policy "Profiles admin manage"
  on profiles for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
