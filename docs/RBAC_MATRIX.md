# RBAC Matrix — An Bình OPS

Nguồn sự thật: `supabase/seed.sql`. Bảng dưới tóm tắt role → permission.

| Permission | SUPER_ADMIN | MANAGER | SALES | DISPATCHER | ACCOUNTANT | DRIVER | AFFILIATE |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| lead.read_assigned | ✅ | ✅(all) | ✅ | — | — | — | ✅ |
| lead.read_all | ✅ | ✅ | — | — | — | — | — |
| lead.create | ✅ | ✅ | ✅ | — | — | — | ✅ |
| lead.update | ✅ | ✅ | ✅ | — | — | — | — |
| quote.create | ✅ | ✅ | ✅ | — | — | — | — |
| quote.send | ✅ | ✅ | ✅ | — | — | — | — |
| order.read_all | ✅ | ✅ | — | ✅ | ✅ | — | — |
| order.create | ✅ | ✅ | ✅ | — | — | — | — |
| order.transition | ✅ | ✅ | — | ✅ | — | — | — |
| order.cancel | ✅ | ✅ | — | — | — | — | — |
| dispatch.assign | ✅ | ✅ | — | ✅ | — | — | — |
| trip.manage | ✅ | ✅ | — | ✅ | — | ✅ | — |
| payment.create | ✅ | ✅ | ✅ | — | ✅ | — | — |
| expense.create | ✅ | ✅ | — | — | ✅ | — | — |
| finance.read | ✅ | ✅ | — | — | ✅ | — | — |
| settlement.execute | ✅ | ✅ | — | — | ✅ | — | — |
| debt.approve | ✅ | ✅ | — | — | ✅ | — | — |
| discount.approve | ✅ | ✅ | — | — | — | — | — |
| vehicle.manage | ✅ | ✅ | — | ✅ | — | — | — |
| driver.manage | ✅ | ✅ | — | ✅ | — | — | — |
| traffic.read | ✅ | ✅ | — | — | — | — | — |
| audit.read | ✅ | ✅ | — | — | ✅ | — | — |
| user.manage | ✅ | ✅ | — | — | — | — | — |
| role.manage | ✅ | — | — | — | — | — | — |

Ghi chú:
- **DISPATCHER** không có `payment.*`/`finance.read` → không đụng được tiền.
- **ACCOUNTANT** không có `dispatch.assign` → không gán xe.
- **DRIVER** chỉ `trip.manage`; RLS còn lọc xuống chỉ chuyến của chính mình.
- **AFFILIATE** chỉ tạo/đọc lead giới thiệu của mình.
- Ẩn nút ở UI **không phải** bảo mật — quyền được ép ở command + RLS.
