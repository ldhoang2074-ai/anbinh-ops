-- ============================================================
--  0008_constraints.sql
--  Chống trùng lịch xe & tài xế ở tầng DATABASE (không chỉ ở app).
--  Dùng exclusion constraint với btree_gist (bật ở 0001): hai
--  assignment ACTIVE cùng xe (hoặc cùng tài xế) không được giao nhau
--  thời gian. Điều kiện giao nhau tstzrange && tstzrange tương đương
--  new_start < existing_end AND new_end > existing_start.
-- ============================================================

-- Cột range phục vụ exclusion constraint.
alter table assignments
  add column if not exists period tstzrange
  generated always as (tstzrange(start_time, end_time, '[)')) stored;

-- Trùng XE (chỉ xét assignment còn hiệu lực)
alter table assignments drop constraint if exists ex_assign_vehicle_overlap;
alter table assignments add constraint ex_assign_vehicle_overlap
  exclude using gist (
    vehicle_id with =,
    period with &&
  ) where (status = 'ACTIVE' and deleted_at is null);

-- Trùng TÀI XẾ
alter table assignments drop constraint if exists ex_assign_driver_overlap;
alter table assignments add constraint ex_assign_driver_overlap
  exclude using gist (
    driver_id with =,
    period with &&
  ) where (status = 'ACTIVE' and deleted_at is null);

-- Nếu hai điều phối viên cùng lúc gán trùng lịch, transaction thứ hai
-- sẽ bị Postgres từ chối bởi exclusion constraint => không thể tạo lịch trùng.
