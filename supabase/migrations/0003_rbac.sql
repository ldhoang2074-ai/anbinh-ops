-- ============================================================
--  0003_rbac.sql
--  Roles, permissions, role_permissions, member_roles.
--  Phân quyền server-side. RLS sẽ gọi app.has_perm().
-- ============================================================

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,     -- SUPER_ADMIN, MANAGER, SALES, ...
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,     -- lead.create, order.transition, ...
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Gán role cho member trong phạm vi 1 organization
create table if not exists member_roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, user_id, role_id)
);
create index if not exists idx_member_roles_lookup on member_roles(user_id, organization_id);

-- Kiểm tra quyền: user hiện tại có permission `perm` trong org không.
-- SECURITY DEFINER để RLS gọi được mà không đệ quy.
create or replace function app.has_perm(org uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from member_roles mr
    join organization_members m
      on m.user_id = mr.user_id
     and m.organization_id = mr.organization_id
     and m.status = 'ACTIVE'
     and m.deleted_at is null
    join role_permissions rp on rp.role_id = mr.role_id
    join permissions p on p.id = rp.permission_id
    where mr.user_id = auth.uid()
      and mr.organization_id = org
      and p.key = perm
  );
$$;

-- Lấy danh sách role key của user trong org (dùng cho guard + UI)
create or replace function app.role_keys(org uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select r.key
  from member_roles mr
  join roles r on r.id = mr.role_id
  where mr.user_id = auth.uid()
    and mr.organization_id = org;
$$;
