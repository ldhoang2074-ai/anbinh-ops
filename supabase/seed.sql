-- ============================================================
--  seed.sql
--  Seed tổ chức An Bình, roles, permissions, role_permissions.
--  Idempotent (chạy lại an toàn nhờ ON CONFLICT).
--  KHÔNG seed người dùng — người dùng vào qua Google OAuth + invitation.
--  Chạy sau khi migrations hoàn tất: supabase db reset chạy tự động,
--  hoặc: psql < seed.sql
-- ============================================================

-- 1) Organization mặc định
insert into organizations (slug, name)
values ('an-binh', 'An Bình — Vận Tải 360')
on conflict (slug) do nothing;

-- 2) Permissions (chi tiết)
insert into permissions (key, description) values
  ('lead.read_assigned',  'Xem Lead được giao cho mình'),
  ('lead.read_all',       'Xem tất cả Lead'),
  ('lead.create',         'Tạo Lead'),
  ('lead.update',         'Sửa Lead'),
  ('quote.create',        'Tạo/sửa báo giá'),
  ('quote.send',          'Gửi báo giá'),
  ('order.read_all',      'Xem tất cả đơn hàng'),
  ('order.create',        'Tạo đơn từ Lead'),
  ('order.transition',    'Chuyển trạng thái đơn'),
  ('order.cancel',        'Hủy đơn'),
  ('dispatch.assign',     'Gán xe & tài xế'),
  ('trip.manage',         'Quản lý workflow chuyến'),
  ('payment.create',      'Ghi nhận thanh toán'),
  ('expense.create',      'Ghi nhận chi phí'),
  ('finance.read',        'Xem dữ liệu tài chính'),
  ('settlement.execute',  'Đối soát/đóng đơn'),
  ('debt.approve',        'Phê duyệt ghi nợ'),
  ('discount.approve',    'Phê duyệt giảm giá'),
  ('vehicle.manage',      'Quản lý xe'),
  ('driver.manage',       'Quản lý tài xế'),
  ('traffic.read',        'Xem lưu lượng truy cập'),
  ('audit.read',          'Xem nhật ký hệ thống'),
  ('user.manage',         'Mời/khóa người dùng'),
  ('role.manage',         'Quản lý vai trò & quyền')
on conflict (key) do nothing;

-- 3) Roles
insert into roles (key, name) values
  ('SUPER_ADMIN', 'Quản trị tối cao'),
  ('MANAGER',     'Quản lý'),
  ('SALES',       'Kinh doanh / CSKH'),
  ('DISPATCHER',  'Điều phối'),
  ('ACCOUNTANT',  'Kế toán'),
  ('DRIVER',      'Tài xế'),
  ('AFFILIATE',   'Cộng tác viên')
on conflict (key) do nothing;

-- 4) role_permissions
-- SUPER_ADMIN: tất cả quyền
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'SUPER_ADMIN'
on conflict do nothing;

-- MANAGER: gần như tất cả trừ role.manage
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in (
  'lead.read_all','lead.create','lead.update','quote.create','quote.send',
  'order.read_all','order.create','order.transition','order.cancel',
  'dispatch.assign','trip.manage','payment.create','expense.create','finance.read',
  'settlement.execute','debt.approve','discount.approve','vehicle.manage','driver.manage',
  'traffic.read','audit.read','user.manage')
where r.key = 'MANAGER'
on conflict do nothing;

-- SALES: lead của mình + tạo lead/quote + gửi báo giá + ghi cọc
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in (
  'lead.read_assigned','lead.create','lead.update','quote.create','quote.send',
  'payment.create','order.create')
where r.key = 'SALES'
on conflict do nothing;

-- DISPATCHER: xem đơn + gán xe + quản lý chuyến (KHÔNG payment)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in (
  'order.read_all','order.transition','dispatch.assign','trip.manage',
  'vehicle.manage','driver.manage')
where r.key = 'DISPATCHER'
on conflict do nothing;

-- ACCOUNTANT: tài chính + đối soát (KHÔNG dispatch.assign)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in (
  'order.read_all','finance.read','payment.create','expense.create',
  'settlement.execute','debt.approve','audit.read')
where r.key = 'ACCOUNTANT'
on conflict do nothing;

-- DRIVER: chỉ xem (RLS lọc còn chuyến của mình), cập nhật trip của mình
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in (
  'trip.manage')
where r.key = 'DRIVER'
on conflict do nothing;

-- AFFILIATE: chỉ tạo lead giới thiệu (RLS lọc khách/hoa hồng của mình)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in (
  'lead.read_assigned','lead.create')
where r.key = 'AFFILIATE'
on conflict do nothing;

-- 5) Invitation allowlist ban đầu (SUPER_ADMIN đầu tiên).
--    THAY <admin-email> bằng email Google của bạn trước khi chạy,
--    rồi sau khi đăng nhập lần đầu, gán role SUPER_ADMIN (xem SUPABASE_SETUP.md).
-- insert into invitations (organization_id, email, status)
-- select id, '<admin-email>', 'INVITED' from organizations where slug='an-binh'
-- on conflict do nothing;
