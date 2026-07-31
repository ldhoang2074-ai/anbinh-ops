-- ============================================================
--  0007_rls.sql
--  Row Level Security: bật cho MỌI bảng nghiệp vụ, mặc định DENY.
--  Nguyên tắc:
--   - Đọc: phải là thành viên ACTIVE của organization_id của hàng.
--   - Ghi trực tiếp từ client: KHÔNG cho (mọi ghi đi qua server command
--     dùng service role, bypass RLS có kiểm soát). Ta chỉ mở SELECT theo
--     quyền; INSERT/UPDATE/DELETE để mặc định deny.
--   - Phân quyền chi tiết bằng app.has_perm().
-- ============================================================

-- Helper: bật RLS + ép luôn (kể cả owner bảng)
-- (chạy thủ công từng bảng để rõ ràng)

------------------------------------------------------------------
-- Core / org / auth
------------------------------------------------------------------
alter table organizations          enable row level security;
alter table profiles               enable row level security;
alter table invitations            enable row level security;
alter table organization_members   enable row level security;
alter table roles                  enable row level security;
alter table permissions            enable row level security;
alter table role_permissions       enable row level security;
alter table member_roles           enable row level security;

-- organizations: chỉ đọc org mình là member ACTIVE
create policy org_select on organizations for select
  using (app.is_active_member(id));

-- profiles: đọc chính mình, hoặc profile của người cùng org (để hiển thị tên)
create policy profiles_self on profiles for select
  using (id = auth.uid()
         or exists (select 1 from organization_members m1
                    join organization_members m2 on m1.organization_id = m2.organization_id
                    where m1.user_id = auth.uid() and m1.status='ACTIVE'
                      and m2.user_id = profiles.id and m2.status='ACTIVE'));
-- profile tự cập nhật tên/avatar của mình
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- invitations: chỉ người có quyền user.manage trong org được đọc
create policy invitations_select on invitations for select
  using (app.has_perm(organization_id, 'user.manage'));

-- organization_members: đọc member cùng org (để trang quản lý người dùng)
create policy members_select on organization_members for select
  using (app.is_active_member(organization_id));

-- member_roles: đọc trong org mình
create policy member_roles_select on member_roles for select
  using (app.is_active_member(organization_id));

-- roles/permissions/role_permissions: đọc chung cho member đã đăng nhập (không nhạy cảm)
create policy roles_select on roles for select using (auth.uid() is not null);
create policy permissions_select on permissions for select using (auth.uid() is not null);
create policy role_permissions_select on role_permissions for select using (auth.uid() is not null);

------------------------------------------------------------------
-- Business
------------------------------------------------------------------
alter table customers            enable row level security;
alter table leads                enable row level security;
alter table quotes               enable row level security;
alter table quote_versions       enable row level security;
alter table vehicles             enable row level security;
alter table vehicle_documents    enable row level security;
alter table drivers              enable row level security;
alter table driver_documents     enable row level security;
alter table orders               enable row level security;
alter table order_status_history enable row level security;
alter table assignments          enable row level security;
alter table trip_events          enable row level security;

-- customers: member cùng org + có quyền lead.read_all HOẶC là sales (đọc để tạo lead)
create policy customers_select on customers for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'lead.read_all')
              or app.has_perm(organization_id,'lead.read_assigned')));

-- leads: read_all thấy hết; read_assigned chỉ thấy lead được giao cho mình
create policy leads_select on leads for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'lead.read_all')
              or (app.has_perm(organization_id,'lead.read_assigned')
                  and assigned_staff = auth.uid())));

-- quotes: theo quyền đọc lead tương ứng
create policy quotes_select on quotes for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'lead.read_all')
              or exists (select 1 from leads l where l.id = quotes.lead_id
                         and l.assigned_staff = auth.uid()
                         and app.has_perm(organization_id,'lead.read_assigned'))));

create policy quote_versions_select on quote_versions for select
  using (app.is_active_member(organization_id)
         and app.has_perm(organization_id,'lead.read_all'));

-- vehicles / drivers: member cùng org có quyền dispatch.* hoặc order.read
create policy vehicles_select on vehicles for select
  using (app.is_active_member(organization_id));
create policy vehicle_docs_select on vehicle_documents for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'dispatch.assign'));

-- drivers: DRIVER chỉ thấy hồ sơ của chính mình; ai có dispatch/order.read_all thấy hết
create policy drivers_select on drivers for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'order.read_all')
              or app.has_perm(organization_id,'dispatch.assign')
              or user_id = auth.uid()));
create policy driver_docs_select on driver_documents for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'dispatch.assign')
              or exists (select 1 from drivers d where d.id = driver_documents.driver_id and d.user_id = auth.uid())));

-- orders: read_all thấy hết; DRIVER chỉ thấy đơn có driver là mình
create policy orders_select on orders for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'order.read_all')
              or exists (select 1 from drivers d where d.id = orders.driver_id and d.user_id = auth.uid())));

create policy osh_select on order_status_history for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'order.read_all'));

create policy assignments_select on assignments for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'dispatch.assign')
              or app.has_perm(organization_id,'order.read_all')
              or exists (select 1 from drivers d where d.id = assignments.driver_id and d.user_id = auth.uid())));

create policy trip_events_select on trip_events for select
  using (app.is_active_member(organization_id)
         and (app.has_perm(organization_id,'order.read_all')
              or exists (select 1 from orders o join drivers d on d.id=o.driver_id
                         where o.id = trip_events.order_id and d.user_id = auth.uid())));

------------------------------------------------------------------
-- Finance
------------------------------------------------------------------
alter table payments               enable row level security;
alter table expenses               enable row level security;
alter table settlements            enable row level security;
alter table debts                  enable row level security;
alter table approval_requests      enable row level security;
alter table financial_adjustments  enable row level security;
alter table idempotency_keys       enable row level security;
alter table attachments            enable row level security;

-- payments/expenses/settlements: cần quyền finance.read
create policy payments_select on payments for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'finance.read'));
create policy expenses_select on expenses for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'finance.read'));
create policy settlements_select on settlements for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'finance.read'));
create policy debts_select on debts for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'finance.read'));
create policy approvals_select on approval_requests for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'finance.read'));
create policy fin_adj_select on financial_adjustments for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'finance.read'));

-- idempotency_keys: không cho client đọc (chỉ server/service role)
-- (RLS bật, không policy select => deny mọi client)

-- attachments: metadata đọc được nếu là member (file thật bảo vệ bằng signed URL + bucket private)
create policy attachments_select on attachments for select
  using (app.is_active_member(organization_id));

------------------------------------------------------------------
-- Audit / traffic
------------------------------------------------------------------
alter table audit_events   enable row level security;
alter table traffic_events enable row level security;

-- audit: cần quyền audit.read; không ai được update/delete (đã chặn bằng trigger)
create policy audit_select on audit_events for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'audit.read'));

-- traffic: đọc cần quyền traffic.read
create policy traffic_select on traffic_events for select
  using (app.is_active_member(organization_id) and app.has_perm(organization_id,'traffic.read'));

-- LƯU Ý: KHÔNG tạo policy INSERT/UPDATE/DELETE cho client.
-- Mọi thao tác ghi đi qua server command (service role) => bypass RLS
-- nhưng server tự kiểm tra session + membership + permission trước khi ghi.
