-- ============================================================
--  0001_extensions.sql
--  Extension + helper chung. Chạy đầu tiên.
-- ============================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "btree_gist";     -- exclusion constraint chống trùng lịch
create extension if not exists "citext";         -- email không phân biệt hoa/thường

-- Schema riêng cho hàm helper để không đụng public
create schema if not exists app;

-- updated_at tự động
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Lấy uid hiện tại (auth.uid() có thể null nếu gọi bằng service role)
create or replace function app.current_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;
