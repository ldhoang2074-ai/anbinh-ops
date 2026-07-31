# Thiết lập Supabase — An Bình Admin

> Mục tiêu: sau khi làm xong các bước này, migrations chạy được, RLS bật, và Google login hoạt động thật. Bạn **không cần gửi secret cho ai** — tất cả nhập trực tiếp vào Supabase Dashboard hoặc file `.env.local` trên máy bạn.

## 1. Tạo project Supabase

1. Vào https://supabase.com → **New project**.
2. Đặt tên (vd `anbinh-ops`), chọn region gần VN (Singapore), đặt Database Password (lưu lại).
3. Chờ project khởi tạo.

## 2. Lấy khóa

Vào **Project Settings → API**:

- **Project URL** → dùng cho `NEXT_PUBLIC_SUPABASE_URL`
- **Project API keys → `anon` / `publishable`** → dùng cho `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (an toàn để lộ ở client)
- **`service_role`** → dùng cho `SUPABASE_SERVICE_ROLE_KEY` — **CHỈ đặt trong server env, KHÔNG commit, KHÔNG để client đọc**

Giá trị được phép đưa vào frontend: **chỉ** `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Secret chỉ đặt server: `SUPABASE_SERVICE_ROLE_KEY` (và Google Client Secret nếu tự xử lý OAuth).

## 3. Cấu hình `.env.local`

```bash
cd admin-next
cp .env.example .env.local
# điền NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL
```

## 4. Chạy migrations + seed

Cài Supabase CLI: https://supabase.com/docs/guides/cli

```bash
cd admin-next
supabase link --project-ref <project-ref>   # ref nằm trong Project URL
supabase db push                            # chạy toàn bộ supabase/migrations/*.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql # seed org + roles + permissions
```

> `supabase db reset` (môi trường local) sẽ tự chạy migrations rồi `seed.sql`.

## 5. Bật Google provider

Vào **Authentication → Providers → Google** → bật, dán **Client ID** và **Client Secret** lấy từ Google Cloud (xem `GOOGLE_OAUTH_SETUP.md`). Client Secret nhập thẳng vào đây, **không vào Git**.

Vào **Authentication → URL Configuration**:
- **Site URL**: `https://admin.anbinh.vn` (hoặc `http://localhost:3000` khi dev)
- **Redirect URLs**: thêm `https://admin.anbinh.vn/auth/callback` và `http://localhost:3000/auth/callback`

## 6. Mời tài khoản đầu tiên (allowlist) + gán SUPER_ADMIN

Chưa ai vào được cho tới khi có invitation + membership ACTIVE. Cách khởi tạo admin đầu tiên (chạy trong SQL Editor của Supabase):

```sql
-- (a) Thêm email của bạn vào allowlist
insert into invitations (organization_id, email, status)
select id, 'ban@gmail.com', 'INVITED' from organizations where slug='an-binh';
```

Sau đó **đăng nhập 1 lần bằng Google** (tạo `auth.users` + `profiles`). Rồi:

```sql
-- (b) Biến bạn thành thành viên ACTIVE + SUPER_ADMIN
with u as (select id from auth.users where email='ban@gmail.com'),
     o as (select id from organizations where slug='an-binh')
insert into organization_members (organization_id, user_id, status, created_by)
select o.id, u.id, 'ACTIVE', u.id from u, o
on conflict (organization_id, user_id) do update set status='ACTIVE';

with u as (select id from auth.users where email='ban@gmail.com'),
     o as (select id from organizations where slug='an-binh'),
     r as (select id from roles where key='SUPER_ADMIN')
insert into member_roles (organization_id, user_id, role_id)
select o.id, u.id, r.id from u, o, r
on conflict do nothing;

update invitations set status='ACTIVE', accepted_at=now()
where email='ban@gmail.com';
```

Đăng nhập lại → vào được `/admin`. Từ đây mời người khác bằng cách thêm `invitations` + `organization_members` + `member_roles` (Slice sau sẽ có UI quản lý người dùng).

## 7. Chạy app

```bash
npm install
npm run dev          # http://localhost:3000/login
npm run test:unit    # test logic thuần (không cần Supabase) — phải PASS
```

## 8. Thu hồi quyền

Đặt `organization_members.status='SUSPENDED'` hoặc `'REVOKED'` → lần request tiếp theo guard server sẽ đẩy user ra `/login`. RLS cũng chặn vì `app.is_active_member()` chỉ tính ACTIVE.
