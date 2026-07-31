-- ============================================================
--  0005_finance.sql
--  payments, expenses, settlements, debts, approval_requests,
--  financial_adjustments, idempotency_keys, attachments.
--  Tiền = BIGINT. Không xóa cứng payment/expense.
-- ============================================================

do $$ begin
  create type payment_type as enum ('DEPOSIT','BALANCE','REFUND','ADJUSTMENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('PENDING','APPROVED','REJECTED');
exception when duplicate_object then null; end $$;

create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_id          uuid references orders(id),
  lead_id           uuid references leads(id),
  type              payment_type not null default 'BALANCE',
  method            text,
  amount            bigint not null,          -- có thể âm cho REFUND/ADJUSTMENT
  reason            text,                     -- BẮT BUỘC với REFUND (enforce ở server + trigger)
  idempotency_key   text,                     -- chống double-submit
  voided            boolean not null default false,  -- không xóa cứng, chỉ void bằng adjustment
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  version           integer not null default 1,
  deleted_at        timestamptz,
  unique (organization_id, idempotency_key)
);
create trigger t_payments_touch before update on payments for each row execute function app.touch_updated_at();
create index if not exists idx_payments_order on payments(order_id);

-- REFUND phải có lý do
create or replace function app.enforce_refund_reason()
returns trigger language plpgsql as $$
begin
  if new.type = 'REFUND' and (new.reason is null or length(trim(new.reason)) = 0) then
    raise exception 'REFUND payment phải có lý do (reason)';
  end if;
  return new;
end $$;
create trigger t_payments_refund_reason before insert or update on payments
  for each row execute function app.enforce_refund_reason();

create table if not exists expenses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_id          uuid references orders(id),
  category          text not null,
  amount            bigint not null,
  note              text,
  idempotency_key   text,
  voided            boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  version           integer not null default 1,
  deleted_at        timestamptz,
  unique (organization_id, idempotency_key)
);
create trigger t_expenses_touch before update on expenses for each row execute function app.touch_updated_at();
create index if not exists idx_expenses_order on expenses(order_id);

create table if not exists settlements (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_id          uuid not null references orders(id) on delete cascade,
  total_revenue     bigint not null default 0,
  total_cost        bigint not null default 0,
  profit            bigint not null default 0,
  settled_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);
create index if not exists idx_settlements_order on settlements(order_id);

create table if not exists debts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_id          uuid not null references orders(id) on delete cascade,
  amount            bigint not null,
  status            approval_status not null default 'PENDING',
  requested_by      uuid references auth.users(id),
  approved_by       uuid references auth.users(id),   -- KHÁC requested_by (enforce ở server)
  reason            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger t_debts_touch before update on debts for each row execute function app.touch_updated_at();

-- Yêu cầu phê duyệt chung (giảm giá, ghi nợ...). Người tạo KHÔNG tự duyệt.
create table if not exists approval_requests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  kind              text not null,           -- DISCOUNT | DEBT | ADJUSTMENT
  entity_type       text not null,
  entity_id         uuid not null,
  payload           jsonb not null default '{}',
  status            approval_status not null default 'PENDING',
  requested_by      uuid references auth.users(id),
  approved_by       uuid references auth.users(id),
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger t_approvals_touch before update on approval_requests for each row execute function app.touch_updated_at();

-- Không tự phê duyệt yêu cầu của chính mình
create or replace function app.enforce_no_self_approval()
returns trigger language plpgsql as $$
begin
  if new.status in ('APPROVED','REJECTED')
     and new.approved_by is not null
     and new.approved_by = new.requested_by then
    raise exception 'Người tạo yêu cầu không được tự phê duyệt';
  end if;
  return new;
end $$;
create trigger t_approvals_no_self before insert or update on approval_requests
  for each row execute function app.enforce_no_self_approval();
create trigger t_debts_no_self before insert or update on debts
  for each row execute function app.enforce_no_self_approval();

-- Điều chỉnh tài chính (thay cho xóa cứng)
create table if not exists financial_adjustments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  target_type       text not null,           -- payment | expense
  target_id         uuid not null,
  delta_amount      bigint not null,
  reason            text not null,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

-- Khóa idempotency cho command server
create table if not exists idempotency_keys (
  key               text primary key,
  organization_id   uuid not null references organizations(id) on delete cascade,
  command           text not null,
  request_hash      text,
  response          jsonb,
  created_at        timestamptz not null default now()
);

-- File đính kèm (metadata; file thật ở private bucket)
create table if not exists attachments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  entity_type       text not null,
  entity_id         uuid not null,
  storage_path      text not null,           -- tên file dạng UUID trong bucket private
  mime_type         text,
  size_bytes        bigint,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);
create index if not exists idx_attachments_entity on attachments(entity_type, entity_id);
