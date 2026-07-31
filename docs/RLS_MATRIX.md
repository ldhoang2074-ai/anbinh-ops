# RLS Matrix — An Bình OPS

Nguồn sự thật: `supabase/migrations/0007_rls.sql`. Mặc định **DENY** mọi thứ; chỉ mở SELECT theo điều kiện. **Không** có policy INSERT/UPDATE/DELETE cho client → mọi ghi qua server command (service role).

| Bảng | Điều kiện SELECT (client) | Ghi (client) |
|---|---|---|
| organizations | là member ACTIVE của org đó | ❌ |
| profiles | chính mình hoặc cùng org | update tên/avatar của mình |
| invitations | có `user.manage` | ❌ |
| organization_members | member ACTIVE cùng org | ❌ |
| roles / permissions / role_permissions | đã đăng nhập | ❌ |
| member_roles | member ACTIVE cùng org | ❌ |
| customers | member + (`lead.read_all` hoặc `lead.read_assigned`) | ❌ |
| leads | `lead.read_all` **hoặc** (`lead.read_assigned` và assigned_staff = mình) | ❌ |
| quotes | theo quyền đọc lead tương ứng | ❌ |
| vehicles | member ACTIVE | ❌ |
| drivers | `order.read_all`/`dispatch.assign` **hoặc** driver.user_id = mình | ❌ |
| orders | `order.read_all` **hoặc** đơn có driver là mình | ❌ |
| order_status_history | `order.read_all` | ❌ |
| assignments | `dispatch.assign`/`order.read_all` **hoặc** tài xế của mình | ❌ |
| trip_events | `order.read_all` **hoặc** chuyến của mình | ❌ |
| payments / expenses / settlements / debts / approval_requests / financial_adjustments | `finance.read` | ❌ |
| idempotency_keys | (không policy) → **deny hoàn toàn** với client | ❌ |
| attachments | member ACTIVE (file thật bảo vệ bằng signed URL + bucket private) | ❌ |
| audit_events | `audit.read` | ❌ (trigger chặn cả UPDATE/DELETE ở DB) |
| traffic_events | `traffic.read` | ❌ (ghi qua Edge Function public) |

## Bất biến RLS kiểm thử (tests/rls/run.mjs)
- Org A không đọc Org B (mọi truy vấn lọc theo `app.active_org_ids()`).
- Sales A không thấy lead của Sales B khi thiếu `lead.read_all`.
- Driver A chỉ thấy đơn/chuyến của mình.
- Dispatcher không đọc payments (thiếu `finance.read`).
- Accountant không ghi assignment.
- User SUSPENDED/REVOKED: `app.is_active_member()` trả false → không đọc được gì.

## Vì sao an toàn khi command dùng service role
Service role bỏ qua RLS, nhưng **chỉ chạy trong server command** sau khi đã xác thực session + membership + permission, và **org lấy từ session** (không từ input client). Client không có service key.
