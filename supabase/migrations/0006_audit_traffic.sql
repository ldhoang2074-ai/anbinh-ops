-- ============================================================
--  0006_audit_traffic.sql
--  audit_events (append-only, không update/delete) + traffic_events.
-- ============================================================

create table if not exists audit_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id        uuid references auth.users(id),
  actor_role      text,
  action          text not null,          -- CREATE | STATUS_CHANGE | ASSIGN | ...
  entity_type     text not null,
  entity_id       uuid,
  before_data     jsonb,
  after_data      jsonb,
  request_id      text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_audit_org on audit_events(organization_id, created_at desc);
create index if not exists idx_audit_entity on audit_events(entity_type, entity_id);

-- Cấm UPDATE/DELETE ở tầng database (chỉ INSERT). Kể cả owner app cũng không sửa được.
create or replace function app.block_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_events là append-only: không được % ', tg_op;
end $$;
create trigger t_audit_no_update before update on audit_events
  for each row execute function app.block_audit_mutation();
create trigger t_audit_no_delete before delete on audit_events
  for each row execute function app.block_audit_mutation();

-- Sự kiện traffic từ website công khai (ghi qua Edge Function public, không cần login)
create table if not exists traffic_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  visitor_id      text,
  session_id      text,
  event_name      text not null,          -- PAGE_VIEW | PHONE_CLICK | QUOTE_CLICK | ...
  page            text,
  source          text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  referrer        text,
  href            text,
  timestamp       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_traffic_org_time on traffic_events(organization_id, timestamp desc);
create index if not exists idx_traffic_event on traffic_events(event_name);
