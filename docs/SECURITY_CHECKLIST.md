# Security Checklist — An Bình OPS

## Secrets
- [ ] `SUPABASE_SERVICE_ROLE_KEY` chỉ ở server env (Vercel encrypted / `.env.local`), không commit.
- [ ] Google Client Secret chỉ trong Supabase Dashboard, không commit.
- [ ] Chỉ `NEXT_PUBLIC_*` xuất hiện trong client bundle. Kiểm: `grep -r service_role .next/` phải rỗng.
- [ ] `.env.local` nằm trong `.gitignore`.

## Auth
- [ ] Không còn mật khẩu demo (`Anbinh8386`) ở bất kỳ đâu trong `admin-next/`.
- [ ] Chỉ email có invitation + membership ACTIVE vào được `/admin`.
- [ ] Tài khoản chưa mời → thông báo "Tài khoản chưa được An Bình cấp quyền." + signOut.
- [ ] SUSPENDED/REVOKED bị guard đẩy ra /login ngay lần request kế.
- [ ] Logout xóa session thật (không vào lại bằng back).

## RLS
- [ ] RLS bật cho MỌI bảng nghiệp vụ; mặc định deny.
- [ ] Không có policy INSERT/UPDATE/DELETE cho client trên bảng nghiệp vụ.
- [ ] Org isolation kiểm bằng test.
- [ ] Không tắt RLS để debug (dùng service role trong command thay thế).

## Command / API
- [ ] org lấy từ session, KHÔNG từ body request.
- [ ] Mọi command kiểm permission trước khi ghi.
- [ ] Chuyển status trái phép bị state machine từ chối.
- [ ] Payment có idempotency-key; gửi 2 lần không tạo trùng.
- [ ] Lỗi trả về không lộ chi tiết nội bộ/stack.

## Dữ liệu / tài chính
- [ ] Tiền dùng BIGINT.
- [ ] Payment/expense không xóa cứng (voided + financial_adjustment).
- [ ] REFUND bắt buộc lý do (trigger).
- [ ] Người tạo yêu cầu không tự duyệt (trigger).
- [ ] audit_events không UPDATE/DELETE được (trigger).

## Storage (Slice 5)
- [ ] Bucket private; truy cập bằng signed URL có hạn.
- [ ] Giới hạn MIME + dung lượng; chặn HTML/executable.
- [ ] Tên file dạng UUID.

## Headers
- [ ] X-Frame-Options DENY, X-Content-Type-Options nosniff (đã set ở next.config.js).
