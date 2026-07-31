# Kiến trúc Backend — An Bình OPS

## Tổng quan
- **Website công khai**: giữ nguyên (static, `web-anbinh-flat/`).
- **Admin**: Next.js (App Router) tại `admin-next/`, deploy `/admin` hoặc `admin.anbinh.vn`.
- **Supabase**: PostgreSQL + Auth (Google OAuth) + Storage (private) + Realtime.

## Lớp (từ ngoài vào trong)
```
UI (React, tái dùng giao diện SaaS)
  │  chỉ gọi Repository
Repository layer (lib/repositories)
  │  READ  → Supabase client (RLS lọc theo quyền)
  │  WRITE → POST /api/commands/<name>
API Route Handler (app/api/commands/[command])
  │
Command layer (lib/commands) ── base.execute():
  1 session  2 membership ACTIVE  3 org  4 permission
  5 validate(zod)  6 transaction  7 history  8 audit
  9 lỗi an toàn  10 idempotency
  │  dùng service-role client (bypass RLS CÓ KIỂM SOÁT)
PostgreSQL: RLS deny-by-default + constraint + trigger
```

## Nguyên tắc bảo mật cốt lõi
1. **Client không bao giờ ghi trực tiếp** status/tài chính. Mọi mutation qua command server.
2. **RLS deny-by-default**: client chỉ SELECT được dữ liệu đúng org + đúng quyền. Không có policy INSERT/UPDATE/DELETE cho client.
3. **Server command dùng service role** để ghi, nhưng tự kiểm tra session+membership+permission trước — không tin bất kỳ giá trị nào client gửi (org lấy từ session, không từ body).
4. **State machine + dispatch conflict + finance** chạy server-side (`lib/core/*.mjs`); ràng buộc cứng lặp lại ở DB (exclusion constraint, trigger remaining, refund-reason, no-self-approval, audit append-only).
5. **Secret** chỉ ở server env. Chỉ `NEXT_PUBLIC_*` được nhúng client.

## Phòng thủ nhiều lớp cho các bất biến
| Bất biến | App/command | Database |
|---|---|---|
| Không trùng lịch xe/tài xế | `checkAssignment()` | `ex_assign_vehicle_overlap`, `ex_assign_driver_overlap` (exclusion) |
| remaining = total − paid | finance recompute | trigger `sync_order_remaining` |
| REFUND cần lý do | zod + command | trigger `enforce_refund_reason` |
| Người tạo không tự duyệt | command | trigger `enforce_no_self_approval` |
| Audit không sửa/xóa | chỉ command insert | trigger chặn UPDATE/DELETE |
| Không COMPLETED khi còn nợ | `canOrderTransition` | (kiểm ở command) |

## Idempotency
Command tài chính nhận `x-idempotency-key`; `idempotency_keys` lưu response, gọi lại trả kết quả cũ → gửi payment 2 lần không tạo trùng.

## Đa thiết bị / Realtime
Dữ liệu tập trung ở Postgres → mọi nhân viên thấy cùng dữ liệu. Có thể bật Supabase Realtime để đồng bộ tức thời (Slice sau).

## Slice
1. Auth + Org + Invitation + RBAC + RLS ✅ (bản này)
2. Lead → Quote → Deposit → Confirmed Order
3. Dispatch → Trip
4. Payment → Expense → Settlement
5. Audit + Storage + Migration + Backup
