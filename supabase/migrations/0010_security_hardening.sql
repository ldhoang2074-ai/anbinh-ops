-- ============================================================
-- 0010_security_hardening.sql
-- Harden SECURITY DEFINER functions and profile membership RLS.
-- ============================================================

-- SECURITY DEFINER functions use an empty search_path.
-- Every referenced relation is schema-qualified.

create or replace function app.active_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.organization_members as m
  where m.user_id = auth.uid()
    and m.status = 'ACTIVE'::public.membership_status
    and m.deleted_at is null;
$$;

create or replace function app.is_active_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as m
    where m.user_id = auth.uid()
      and m.organization_id = org
      and m.status = 'ACTIVE'::public.membership_status
      and m.deleted_at is null
  );
$$;

create or replace function app.has_perm(org uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_roles as mr
    join public.organization_members as m
      on m.user_id = mr.user_id
     and m.organization_id = mr.organization_id
     and m.status = 'ACTIVE'::public.membership_status
     and m.deleted_at is null
    join public.role_permissions as rp
      on rp.role_id = mr.role_id
    join public.permissions as p
      on p.id = rp.permission_id
    where mr.user_id = auth.uid()
      and mr.organization_id = org
      and p.key = perm
  );
$$;

create or replace function app.role_keys(org uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select r.key
  from public.member_roles as mr
  join public.organization_members as m
    on m.user_id = mr.user_id
   and m.organization_id = mr.organization_id
   and m.status = 'ACTIVE'::public.membership_status
   and m.deleted_at is null
  join public.roles as r
    on r.id = mr.role_id
  where mr.user_id = auth.uid()
    and mr.organization_id = org;
$$;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(
          excluded.full_name,
          public.profiles.full_name
        ),
        avatar_url = coalesce(
          excluded.avatar_url,
          public.profiles.avatar_url
        );

  return new;
end;
$$;

-- The app schema is not exposed to anonymous callers.
revoke all on schema app from public;
revoke all on schema app from anon;
grant usage on schema app to authenticated, supabase_auth_admin;

-- RLS helper functions may only be called by authenticated users.
revoke all on function app.active_org_ids()
  from public, anon, authenticated;
grant execute on function app.active_org_ids()
  to authenticated;

revoke all on function app.is_active_member(uuid)
  from public, anon, authenticated;
grant execute on function app.is_active_member(uuid)
  to authenticated;

revoke all on function app.has_perm(uuid, text)
  from public, anon, authenticated;
grant execute on function app.has_perm(uuid, text)
  to authenticated;

revoke all on function app.role_keys(uuid)
  from public, anon, authenticated;
grant execute on function app.role_keys(uuid)
  to authenticated;

-- This function is only used by the auth.users trigger.
revoke all on function app.handle_new_user()
  from public, anon, authenticated;
grant execute on function app.handle_new_user()
  to supabase_auth_admin;

-- A deleted membership must not grant profile visibility.
drop policy if exists profiles_self on public.profiles;

create policy profiles_self
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members as m1
    join public.organization_members as m2
      on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid()
      and m1.status = 'ACTIVE'::public.membership_status
      and m1.deleted_at is null
      and m2.user_id = profiles.id
      and m2.status = 'ACTIVE'::public.membership_status
      and m2.deleted_at is null
  )
);
