# Deployment — An Bình Admin (Next.js + Supabase)

## Kiến trúc deploy
- Website công khai: giữ nguyên host tĩnh hiện tại (`web-anbinh-flat/`).
- Admin (Next.js): deploy Vercel, subdomain `admin.anbinh.vn` (khuyến nghị) hoặc path `/admin`.

## Vercel
1. Import repo (thư mục `admin-next/` làm **Root Directory**).
2. Framework preset: **Next.js** (tự nhận).
3. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (đánh dấu **Sensitive**)
   - `APP_URL=https://admin.anbinh.vn`
4. Deploy.

## Supabase
- Chạy migrations (`supabase db push`) + `seed.sql` trên project production.
- Bật Google provider + cấu hình Redirect URLs (thêm domain production).

## DNS (subdomain)
- Thêm bản ghi CNAME `admin` → Vercel, gắn domain trong Vercel project.

## Kiểm tra sau deploy
- [ ] `/login` mở, bấm Google → về `/admin` khi tài khoản ACTIVE.
- [ ] Tài khoản chưa mời bị chặn đúng thông báo.
- [ ] `npm run test:security` (trỏ APP_URL vào production) PASS.
- [ ] DevTools → Network: không có request lộ service key; không 404 asset.

## Rollback
- Vercel: revert về deployment trước.
- DB: xem `BACKUP_RESTORE.md`.
