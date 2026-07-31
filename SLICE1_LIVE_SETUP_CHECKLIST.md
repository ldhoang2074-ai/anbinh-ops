# SLICE 1 — LIVE SETUP CHECKLIST

Quy trình đưa Slice 1 (Auth + Org + Invitation + RBAC + RLS) lên Supabase THẬT và xác minh.
Làm tuần tự từ trên xuống. Mọi lệnh ghi rõ **thư mục phải đứng trước khi chạy**.

> ⚠️ Slice 1 CHƯA được coi là production-ready cho tới khi mục §10 (RLS + E2E + security) PASS thật.

---

## Ký hiệu giá trị
| Loại | Giá trị | Được lộ ra client? | Đưa vào chat/Git? |
|---|---|---|---|
| PUBLIC | `NEXT_PUBLIC_SUPABASE_URL` | ✅ có | ❌ không commit `.env.local` (nhưng giá trị không nhạy cảm) |
| PUBLIC | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon) | ✅ có | ❌ |
| PUBLIC | `NEXT_PUBLIC_APP_URL` | ✅ có | ❌ |
| **SECRET** | `SUPABASE_SERVICE_ROLE_KEY` | ❌ **KHÔNG** | ❌ **TUYỆT ĐỐI KHÔNG gửi chat/Git** |
| **SECRET** | Google **Client Secret** | ❌ **KHÔNG** | ❌ **chỉ dán trong Supabase Dashboard** |
| PUBLIC | Google **Client ID** | ✅ | dán trong Supabase Dashboard |
| server-only | `APP_URL` (cho test script) | — | ❌ |

`.env.local`, `tools/backups/`, `*.backup.json` đã nằm trong `.gitignore` — kiểm lại ở §11.

---

## 0. Yêu cầu trước
```bash
# (thư mục bất kỳ) — cài công cụ
node -v            # >= 18.18
npm i -g supabase  # hoặc dùng npx supabase
```
Tài khoản: Supabase (supabase.com), Google Cloud Console.

---

## 1. Tạo Supabase project
Thủ công trên dashboard (không có lệnh CLI tạo project):
1. https://supabase.com → **New project** → tên `anbinh-ops`, region **Singapore**, đặt **Database Password** (LƯU LẠI — secret).
2. Chờ tạo xong.
3. **Project Settings → API**, ghi lại:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon`/`publishable` key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**SECRET**)
   - Project **ref** (chuỗi trong URL `https://<ref>.supabase.co`)

---

## 2. Link local project với Supabase
```bash
cd admin-next
supabase login                       # mở trình duyệt xác thực CLI
supabase link --project-ref <ref>    # <ref> ở bước 1.3
```
Kỳ vọng: "Finished supabase link." Nếu hỏi DB password → nhập password ở §1.

---

## 3. Chạy migrations (đúng thứ tự 0001→0009 tự động theo tên file)
```bash
cd admin-next
supabase db push
```
Kỳ vọng: CLI liệt kê áp dụng `0001_extensions.sql` … `0009_triggers.sql`, kết thúc không lỗi.

> Local (tùy chọn) để test nhanh trước khi đụng cloud:
> ```bash
> cd admin-next
> supabase start          # dựng Postgres local trong Docker
> supabase db reset       # chạy migrations + seed.sql tự động
> ```

---

## 4. Chạy seed (org An Bình + roles + permissions)
`supabase db reset` (local) tự chạy `seed.sql`. Với **cloud** chạy thủ công:
```bash
cd admin-next
# Lấy connection string: Dashboard → Project Settings → Database → Connection string (URI)
export SUPABASE_DB_URL="postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres"
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```
Kỳ vọng: các lệnh `INSERT 0 N` / `INSERT 0 0` (khi chạy lại — idempotent), không ERROR.

---

## 5. Tạo invitation cho Super Admin
Chạy trong **Supabase Dashboard → SQL Editor** (thay email của bạn):
```sql
-- (a) allowlist
insert into invitations (organization_id, email, status)
select id, 'ban@gmail.com', 'INVITED' from organizations where slug='an-binh'
on conflict (organization_id, email) do nothing;
```
> Chưa gán role/membership vội — cần đăng nhập Google 1 lần để tạo `auth.users` trước (làm ở §9).

---

## 6. Cấu hình Google OAuth
Chi tiết: `docs/GOOGLE_OAUTH_SETUP.md`. Tóm tắt URL cần nhập:

**Google Cloud Console → Credentials → OAuth client (Web):**
- Authorized JavaScript origins:
  - `http://localhost:3000`
  - `https://admin.anbinh.vn` (khi có domain)
- Authorized redirect URIs (dùng URL của **Supabase**, KHÔNG phải app):
  - `https://<ref>.supabase.co/auth/v1/callback`

**Supabase → Authentication → Providers → Google:** bật, dán **Client ID** + **Client Secret** (secret chỉ dán ở đây).

**Supabase → Authentication → URL Configuration:**
- Site URL: `http://localhost:3000` (dev) / `https://admin.anbinh.vn` (prod)
- Redirect URLs (thêm cả hai):
  - `http://localhost:3000/auth/callback`
  - `https://admin.anbinh.vn/auth/callback`

---

## 7. Biến môi trường local
```bash
cd admin-next
cp .env.example .env.local
```
Điền `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co        # PUBLIC
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>           # PUBLIC
NEXT_PUBLIC_APP_URL=http://localhost:3000                 # PUBLIC
SUPABASE_SERVICE_ROLE_KEY=<service role key>              # SECRET — không commit
```
Cho test script (§10) thêm biến shell (không cần trong .env.local):
```bash
export APP_URL=http://localhost:3000
export SUPABASE_DB_URL="postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres"
```

---

## 8. Chạy Next.js Admin
```bash
cd admin-next
npm install
npm run dev        # http://localhost:3000/login
```
Kỳ vọng: build không lỗi; mở `/login` thấy trang An Bình + nút "Tiếp tục với Google".

---

## 9. Kiểm tra Google login thật + kích hoạt Super Admin
1. Mở `http://localhost:3000/admin` → middleware đẩy về `/login`.
2. Bấm **Tiếp tục với Google**, đăng nhập bằng `ban@gmail.com`.
3. Lần đầu: guard sẽ báo **"Tài khoản chưa được An Bình cấp quyền."** (đúng — chưa có membership). Điều này CŨNG tạo `auth.users` + `profiles`.
4. Trong **SQL Editor**, kích hoạt membership + gán SUPER_ADMIN:
```sql
with u as (select id from auth.users where email='ban@gmail.com'),
     o as (select id from organizations where slug='an-binh')
insert into organization_members (organization_id, user_id, status, created_by)
select o.id, u.id, 'ACTIVE', u.id from u, o
on conflict (organization_id, user_id) do update set status='ACTIVE';

with u as (select id from auth.users where email='ban@gmail.com'),
     o as (select id from organizations where slug='an-binh'),
     r as (select id from roles where key='SUPER_ADMIN')
insert into member_roles (organization_id, user_id, role_id)
select o.id, u.id, r.id from u, o, r on conflict do nothing;

update invitations set status='ACTIVE', accepted_at=now() where email='ban@gmail.com';
```
5. Đăng nhập lại → vào được `/admin`, thấy email + vai trò SUPER_ADMIN + số quyền (24).

---

## 10. Chạy test
### 10.1 Unit (KHÔNG cần Supabase) — phải PASS trước
```bash
cd admin-next
npm run test:unit
```
Kỳ vọng: **31/31 pass** (orderStateMachine 14 + dispatchConflict 9 + financeCalculator 8).

### 10.2 RLS (cần Supabase + JWT các vai trò)
Tạo vài user test (mời + gán role SALES/DISPATCHER/ACCOUNTANT/DRIVER như §5+§9), lấy JWT của mỗi user:
```bash
# Cách lấy JWT test nhanh (service role tạo phiên) — hoặc copy access_token từ DevTools sau khi login.
# Xuất các biến rồi chạy:
cd admin-next
export TEST_SALES_A_JWT=... TEST_SALES_A_UID=...
export TEST_SALES_B_JWT=...
export TEST_DRIVER_A_JWT=... TEST_DRIVER_A_DRIVERID=...
export TEST_DISPATCHER_JWT=...
export TEST_ACCOUNTANT_JWT=...
npm run test:rls
```
Kỳ vọng: mọi case in `PASS`, dòng cuối `RLS: pass=5 fail=0`. Exit code 2 = SKIP (chưa set env).

### 10.3 E2E (cần app chạy + JWT manager)
```bash
cd admin-next
export APP_URL=http://localhost:3000
export TEST_MANAGER_JWT=...
npm run test:e2e
```
Kỳ vọng (Slice 1): create_lead + lead_transition PASS. Các bước Slice 2-4 kích hoạt sau.

### 10.4 Security (cần app chạy)
```bash
cd admin-next
export APP_URL=http://localhost:3000
npm run test:security
```
Kỳ vọng: 401 khi không session, 404 command lạ, org-id trong request vô hiệu, HTML không lộ `service_role`. `SECURITY: pass=4 fail=0`.

---

## 11. Kiểm tra bảo mật thủ công (bắt buộc)
```bash
cd admin-next
# (a) Không có secret thật trong source/Git
git grep -nE "service_role|eyJhbGciOi|GOCSPX-" -- . ':!*.md' || echo "OK: không thấy secret"
# (b) .env.local KHÔNG được track
git check-ignore .env.local && echo "OK: .env.local bị ignore"
# (c) Không có service key trong client bundle
npm run build
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|service_role" .next/static && echo "LỖI: lộ secret" || echo "OK: bundle client sạch"
```
Checklist xác nhận (đối chiếu `docs/SECURITY_CHECKLIST.md`):
- [ ] Không secret thật trong source/Git (a).
- [ ] `.env.local` bị ignore (b).
- [ ] Service role key KHÔNG có trong `.next/static` (c).
- [ ] RLS bật toàn bộ bảng nghiệp vụ — kiểm:
  ```sql
  select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;
  -- Kỳ vọng: KHÔNG trả về bảng nghiệp vụ nào (mọi bảng đã bật RLS).
  ```
- [ ] User chưa mời: đăng nhập → bị chặn + thông báo (thử ở §9 bước 3).
- [ ] User SUSPENDED/REVOKED bị chặn: `update organization_members set status='SUSPENDED' where user_id=...` → user reload `/admin` bị đẩy ra `/login`.
- [ ] Org A không đọc Org B: tạo org thứ 2 + user, xác nhận truy vấn không thấy dữ liệu An Bình (test RLS 10.2).
- [ ] Logout xong bấm Back KHÔNG xem lại được Admin (middleware đã set `Cache-Control: no-store` cho `/admin`).
- [ ] OAuth callback không open-redirect: mở
  `http://localhost:3000/auth/callback?next=//evil.com` → phải về `/admin`, KHÔNG ra evil.com (hàm `safeNext` chặn `//`, `/\`, và path ngoài `/admin`).

---

## 12. Rollback khi migration/seed lỗi
```bash
cd admin-next
# Local (Docker): reset sạch rồi chạy lại từ đầu
supabase db reset

# Cloud: hạ về trạng thái trước migration lỗi
supabase migration list                 # xem migration đã áp
supabase migration repair --status reverted <version>   # đánh dấu lùi migration hỏng
# hoặc khôi phục từ backup (xem docs/BACKUP_RESTORE.md):
pg_restore --clean --no-owner -d "$SUPABASE_DB_URL" anbinh-YYYY-MM-DD.dump
```
Seed idempotent (dùng `on conflict`) nên chạy lại an toàn; nếu vẫn lỗi, xoá dữ liệu seed rồi chạy lại:
```sql
-- thận trọng: chỉ trên môi trường chưa có dữ liệu thật
delete from role_permissions; delete from member_roles;
delete from roles; delete from permissions;
-- rồi psql -f supabase/seed.sql
```

---

## 13. Tiêu chí coi Slice 1 XONG (definition of done)
- [ ] §10.1 unit 31/31 PASS.
- [ ] §10.2 RLS pass, fail=0.
- [ ] §10.3 E2E (create_lead + lead_transition) PASS.
- [ ] §10.4 security pass=4 fail=0.
- [ ] §11 toàn bộ mục tick xanh.
- [ ] Đăng nhập Google thật vào được `/admin` với SUPER_ADMIN; tài khoản chưa mời bị chặn.

Chỉ khi TẤT CẢ ô trên xanh mới tuyên bố Slice 1 production-ready. Trước đó: "code hoàn tất, chờ xác minh live".
