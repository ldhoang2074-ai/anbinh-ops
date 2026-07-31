-- ============================================================
--  0002_core_org_auth.sql
--  Organization, profiles, membership, invitation (allowlist).
--  Đây là lớp kiểm soát AI ĐƯỢC VÀO hệ thống.
-- ============================================================

-- Tổ chức (multi-tenant sẵn sàng, hiện tại chỉ An Bình)
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create trigger t_org_touch before update on organizations
  for each row execute function app.touch_updated_at();

-- Hồ sơ người dùng, 1-1 với auth.users
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext unique not null,
  full_name     text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger t_profiles_touch before update on profiles
  for each row execute function app.touch_updated_at();

-- Trạng thái membership
do $$ begin
  create type membership_status as enum ('INVITED','ACTIVE','SUSPENDED','REVOKED');
exception when duplicate_object then null; end $$;

-- Lời mời (allowlist): CHỈ email có trong bảng này (hoặc đã là member) mới vào được.
create table if not exists invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           citext not null,
  status          membership_status not null default 'INVITED',
  invited_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (organization_id, email)
);
create trigger t_inv_touch before update on invitations
  for each row execute function app.touch_updated_at();

-- Thành viên tổ chức (sau khi accept invitation)
create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          membership_status not null default 'ACTIVE',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  deleted_at      timestamptz,
  unique (organization_id, user_id)
);
create trigger t_memb_touch before update on organization_members
  for each row execute function app.touch_updated_at();

create index if not exists idx_members_user on organization_members(user_id) where deleted_at is null;
create index if not exists idx_members_org  on organization_members(organization_id) where deleted_at is null;

-- ---- Helper bảo mật dùng trong RLS (SECURITY DEFINER, bỏ qua RLS để tránh đệ quy) ----

-- Tập organization_id mà user hiện tại là thành viên ACTIVE
create or replace function app.active_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from organization_members m
  where m.user_id = auth.uid()
    and m.status = 'ACTIVE'
    and m.deleted_at is null;
$$;

-- User có phải thành viên ACTIVE của org không
create or replace function app.is_active_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members m
    where m.user_id = auth.uid()
      and m.organization_id = org
      and m.status = 'ACTIVE'
      and m.deleted_at is null
  );
$$;
