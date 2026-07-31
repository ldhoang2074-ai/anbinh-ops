# TEST REPORT — An Bình Admin Backend (Slice 1)

## Nguyên tắc
Không tuyên bố PASS cho test cần hạ tầng sống khi chưa chạy được. Phân biệt rõ:
- **Đã chạy thật** (không cần credential): unit test logic thuần.
- **Chưa chạy — chờ cấu hình**: RLS / integration / E2E / security (cần Supabase + Google + tài khoản test).

## A. Unit test — ĐÃ CHẠY THẬT ✅
Chạy trong runner JS thực thi trực tiếp `lib/core/*.mjs`:
- `orderStateMachine`: 14 case (lead/order transitions, chặn WAITING_DEPOSIT khi chưa có quote gửi, chặn CONFIRMED khi chưa cọc, chặn ASSIGNED khi thiếu xe/tài xế, chặn COMPLETED khi còn nợ chưa duyệt, bắt buộc lý do CANCELLED/INCIDENT, chặn chuyển trái phép).
- `dispatchConflict`: 9 case (công thức overlap, assign hợp lệ, chặn bảo dưỡng / hết đăng kiểm / hết bằng lái / trùng xe / trùng tài xế, không chặn khi lệch giờ).
- `financeCalculator`: 8 case (tổng báo giá, lợi nhuận, paid/remaining/cost/profit, bỏ qua voided, refund, remaining không âm).

**KẾT QUẢ: 31/31 PASS.** Lệnh CI: `npm run test:unit` (node --test tests/unit/).

## B. RLS test — CHƯA CHẠY (chờ Supabase) ⏳
File: `tests/rls/run.mjs`. Cần env Supabase + JWT các vai trò test. Bao phủ: Org A≠B, Sales A không đọc lead Sales B, Driver A chỉ đơn của mình, Dispatcher không đọc payments, Accountant không ghi assignment, client không UPDATE trực tiếp orders.
Chạy sau khi cấu hình: `npm run test:rls` (exit code 2 = SKIP do thiếu env).

## C. Integration / E2E — CHƯA CHẠY (chờ Supabase) ⏳
File: `tests/e2e/run.mjs`. Chạy trọn Lead→…→Completed qua API command thật + kiểm idempotency payment. Hiện có sẵn create_lead + lead_transition (Slice 1); các bước còn lại kích hoạt khi command Slice 2-4 hoàn tất.

## D. Security test — CHƯA CHẠY (chờ app deploy) ⏳
File: `tests/security/run.mjs`. Bao phủ: gọi API không session → 401, command lạ → 404, đổi organization_id trong request vô hiệu, HTML không lộ service_role.

## Còn chờ cấu hình bên ngoài (bắt buộc để chạy B/C/D)
1. Tạo Supabase project + chạy migrations + seed (xem `SUPABASE_SETUP.md`).
2. Bật Google OAuth (xem `GOOGLE_OAUTH_SETUP.md`).
3. Tạo vài tài khoản test + gán role, xuất JWT vào env test.
4. Deploy app (hoặc `npm run dev`) để chạy E2E/security.

## Việc CHƯA làm (ngoài phạm vi Slice 1)
- Command Slice 2-4 (quote/deposit/confirm/order/trip/payment/expense/settlement) — khung đã sẵn (`lib/commands/base.ts`), thêm theo mẫu `createLead`/`assignVehicleDriver`.
- Storage private bucket + signed URL + giới hạn MIME (Slice 5).
- Gắn giao diện SaaS đầy đủ vào Next.js (hiện `/admin` là placeholder xác thực).
