-- ============================================================
--  0004_business.sql
--  Bảng nghiệp vụ: customers, leads, quotes, orders, vehicles,
--  drivers, assignments, trip_events + lịch sử.
--  Chuẩn cột: id, organization_id, created_at, updated_at,
--  created_by, updated_by, version, deleted_at.
--  Tiền = BIGINT (VND, không dùng FLOAT).
-- ============================================================

-- Enums nghiệp vụ
do $$ begin
  create type lead_status as enum
    ('LEAD_NEW','CONSULTING','QUOTE_SENT','WAITING_DEPOSIT','CONFIRMED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum
    ('WAITING_ASSIGNMENT','ASSIGNED','PREPARING','IN_PROGRESS','WAITING_SETTLEMENT',
     'COMPLETED','CANCELLED','INCIDENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_status as enum ('AVAILABLE','ASSIGNED','IN_TRIP','MAINTENANCE','INACTIVE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type driver_status as enum ('AVAILABLE','ASSIGNED','ON_TRIP','OFF','INACTIVE');
exception when duplicate_object then null; end $$;

-- Macro cột chung được lặp lại thủ công (Postgres không có mixin).

create table if not exists customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  phone           text not null,
  email           citext,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  version         integer not null default 1,
  deleted_at      timestamptz
);
create trigger t_customers_touch before update on customers for each row execute function app.touch_updated_at();
create index if not exists idx_customers_org on customers(organization_id) where deleted_at is null;

create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_id       uuid references customers(id),
  status            lead_status not null default 'LEAD_NEW',
  service_type      text,
  pickup_location   text,
  dropoff_location  text,
  passenger_count   integer,
  estimated_price   bigint not null default 0,
  source            text,
  assigned_staff    uuid references auth.users(id),  -- Sales phụ trách (RLS read_assigned)
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  version           integer not null default 1,
  deleted_at        timestamptz
);
create trigger t_leads_touch before update on leads for each row execute function app.touch_updated_at();
create index if not exists idx_leads_org on leads(organization_id) where deleted_at is null;
create index if not exists idx_leads_assigned on leads(assigned_staff) where deleted_at is null;

create table if not exists quotes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id         uuid not null references leads(id) on delete cascade,
  status          quote_status not null default 'DRAFT',
  version_no      integer not null default 1,
  base_price      bigint not null default 0,
  toll_fee        bigint not null default 0,
  surcharge       bigint not null default 0,
  estimated_cost  bigint not null default 0,
  total_price     bigint not null default 0,
  estimated_profit bigint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  version         integer not null default 1,
  deleted_at      timestamptz
);
create trigger t_quotes_touch before update on quotes for each row execute function app.touch_updated_at();
create index if not exists idx_quotes_lead on quotes(lead_id) where deleted_at is null;

-- Lịch sử phiên bản báo giá (không sửa/xóa — append only)
create table if not exists quote_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  quote_id        uuid not null references quotes(id) on delete cascade,
  version_no      integer not null,
  snapshot        jsonb not null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);
create index if not exists idx_quote_versions_quote on quote_versions(quote_id);

create table if not exists vehicles (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  plate                 text not null,
  model                 text,
  seats                 integer,
  status                vehicle_status not null default 'AVAILABLE',
  registration_expiry   date,
  insurance_expiry      date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id),
  updated_by            uuid references auth.users(id),
  version               integer not null default 1,
  deleted_at            timestamptz,
  unique (organization_id, plate)
);
create trigger t_vehicles_touch before update on vehicles for each row execute function app.touch_updated_at();
create index if not exists idx_vehicles_org on vehicles(organization_id) where deleted_at is null;

create table if not exists vehicle_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vehicle_id      uuid not null references vehicles(id) on delete cascade,
  doc_type        text not null,
  storage_path    text,        -- private bucket path
  expiry          date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create table if not exists drivers (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid references auth.users(id),  -- nếu tài xế có tài khoản (role DRIVER)
  name              text not null,
  phone             text,
  status            driver_status not null default 'AVAILABLE',
  license_expiry    date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  version           integer not null default 1,
  deleted_at        timestamptz
);
create trigger t_drivers_touch before update on drivers for each row execute function app.touch_updated_at();
create index if not exists idx_drivers_org on drivers(organization_id) where deleted_at is null;
create index if not exists idx_drivers_user on drivers(user_id) where deleted_at is null;

create table if not exists driver_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  driver_id       uuid not null references drivers(id) on delete cascade,
  doc_type        text not null,
  storage_path    text,
  expiry          date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_code        text not null,
  lead_id           uuid references leads(id),
  customer_id       uuid references customers(id),
  status            order_status not null default 'WAITING_ASSIGNMENT',
  service_type      text,
  pickup_location   text,
  dropoff_location  text,
  passenger_count   integer,
  start_time        timestamptz,
  end_time          timestamptz,
  vehicle_id        uuid references vehicles(id),
  driver_id         uuid references drivers(id),
  total_price       bigint not null default 0,
  deposit_amount    bigint not null default 0,
  paid_amount       bigint not null default 0,
  remaining_amount  bigint not null default 0,
  actual_cost       bigint not null default 0,
  actual_profit     bigint not null default 0,
  debt_approved     boolean not null default false,
  cancel_reason     text,
  incident_reason   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  version           integer not null default 1,
  deleted_at        timestamptz,
  unique (organization_id, order_code)
);
create trigger t_orders_touch before update on orders for each row execute function app.touch_updated_at();
create index if not exists idx_orders_org on orders(organization_id) where deleted_at is null;
create index if not exists idx_orders_vehicle on orders(vehicle_id);
create index if not exists idx_orders_driver on orders(driver_id);

-- Lịch sử chuyển trạng thái đơn (append only)
create table if not exists order_status_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  from_status     order_status,
  to_status       order_status not null,
  reason          text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);
create index if not exists idx_osh_order on order_status_history(order_id);

-- Điều phối xe/tài xế cho đơn. Chống trùng lịch bằng exclusion constraint (0008).
create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  vehicle_id      uuid not null references vehicles(id),
  driver_id       uuid not null references drivers(id),
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  status          text not null default 'ACTIVE',   -- ACTIVE | CANCELLED
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  version         integer not null default 1,
  deleted_at      timestamptz,
  check (end_time > start_time)
);
create trigger t_assignments_touch before update on assignments for each row execute function app.touch_updated_at();
create index if not exists idx_assignments_order on assignments(order_id);

create table if not exists trip_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  content         text not null,
  timestamp       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);
create index if not exists idx_trip_events_order on trip_events(order_id);
