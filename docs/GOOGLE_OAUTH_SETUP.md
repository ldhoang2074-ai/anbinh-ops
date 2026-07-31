# Thiết lập Google OAuth — An Bình Admin

> Cần tài khoản Google Cloud. Client Secret **không dán vào chat, không commit Git** — chỉ nhập vào Supabase Dashboard.

## 1. Tạo OAuth consent screen

1. https://console.cloud.google.com → tạo project (vd `An Binh OPS`).
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** (hoặc Internal nếu dùng Google Workspace nội bộ).
   - App name: `An Bình Vận Tải 360`, email hỗ trợ, logo (tuỳ chọn).
   - Scopes: `email`, `profile`, `openid` (mặc định là đủ).
   - Test users: thêm email sẽ đăng nhập (khi app còn ở chế độ Testing).

## 2. Tạo OAuth Client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- Application type: **Web application**
- Name: `An Binh Admin Web`
- **Authorized JavaScript origins**:
  - `https://admin.anbinh.vn`
  - `http://localhost:3000`
- **Authorized redirect URIs** — dùng URL callback của **Supabase** (không phải app):
  - `https://<project-ref>.supabase.co/auth/v1/callback`

  > Lấy đúng URL này trong Supabase: **Authentication → Providers → Google** (Supabase hiển thị sẵn "Callback URL").

Bấm **Create** → nhận **Client ID** và **Client Secret**.

## 3. Nối vào Supabase

**Supabase → Authentication → Providers → Google**:
- Bật provider.
- Dán **Client ID** (được phép, không phải secret nhạy cảm như service key).
- Dán **Client Secret** (nhập trực tiếp tại đây; đây là nơi hợp lệ để lưu secret — Supabase giữ phía server).
- Lưu.

## 4. Redirect trong app

App gọi `signInWithOAuth({ provider:'google', options:{ redirectTo: APP_URL + '/auth/callback' }})`.
Luồng đầy đủ:

```
/login  ──"Tiếp tục với Google"──▶ Google
        ◀── consent ──
Google  ──▶ https://<ref>.supabase.co/auth/v1/callback  (Supabase đổi code)
        ──▶ APP_URL/auth/callback   (app đổi code lấy session)
app kiểm tra invitation/membership ACTIVE
   ├─ đạt   → /admin
   └─ không → signOut + /login?error="Tài khoản chưa được An Bình cấp quyền."
```

## 5. Đưa app lên Production trên Google

Khi hết giai đoạn Testing: **OAuth consent screen → Publish app**. Nếu chỉ dùng nội bộ Workspace, chọn **Internal** để bỏ giới hạn test users.

## 6. Biến môi trường liên quan

| Biến | Nơi đặt | Client thấy? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / Vercel | Có |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` / Vercel | Có |
| `SUPABASE_SERVICE_ROLE_KEY` | server env (Vercel encrypted) | **Không** |
| Google Client ID | Supabase Dashboard | — |
| Google Client Secret | Supabase Dashboard | **Không** |

Không cần đặt Google Client ID/Secret trong repo nếu dùng Supabase-hosted Google provider.
