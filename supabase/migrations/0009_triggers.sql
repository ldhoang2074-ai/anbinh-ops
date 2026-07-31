-- ============================================================
--  0009_triggers.sql
--  Trigger nghiệp vụ chạy ở DB (lớp phòng thủ cuối, độc lập với app):
--   - tạo profile tự động khi có auth user mới;
--   - version tăng khi update bảng nghiệp vụ;
--   - order.remaining_amount = total - paid (không cho lệch).
-- ============================================================

-- Tự tạo profile khi user đăng nhập lần đầu (Supabase tạo hàng trong auth.users)
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function app.handle_new_user();

-- Tăng version mỗi lần update (optimistic concurrency)
create or replace function app.bump_version()
returns trigger language plpgsql as $$
begin
  new.version = coalesce(old.version, 0) + 1;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['customers','leads','quotes','vehicles','drivers',
                           'orders','assignments','payments','expenses']
  loop
    execute format('drop trigger if exists t_%s_version on %I;', t, t);
    execute format('create trigger t_%s_version before update on %I
                    for each row execute function app.bump_version();', t, t);
  end loop;
end $$;

-- remaining_amount luôn = total_price - paid_amount (không cho app ghi lệch)
create or replace function app.sync_order_remaining()
returns trigger language plpgsql as $$
begin
  new.remaining_amount = greatest(new.total_price - new.paid_amount, 0);
  return new;
end $$;
drop trigger if exists t_orders_remaining on orders;
create trigger t_orders_remaining before insert or update on orders
  for each row execute function app.sync_order_remaining();
