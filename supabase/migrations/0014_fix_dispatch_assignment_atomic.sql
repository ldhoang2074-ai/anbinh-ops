-- ============================================================
-- 0014_fix_dispatch_assignment_atomic.sql
-- Fix PL/pgSQL output-variable ambiguity in the atomic dispatch RPC.
-- ============================================================

create or replace function public.assign_vehicle_driver_atomic(
  p_organization_id uuid,
  p_order_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_actor_id uuid,
  p_reason text default null,
  p_actor_role text default null,
  p_request_id text default null
)
returns table (order_id uuid, status public.order_status)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_order public.orders%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_driver public.drivers%rowtype;
begin
  select o.*
    into v_order
    from public.orders as o
   where o.id = p_order_id
     and o.organization_id = p_organization_id
     and o.deleted_at is null
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'WAITING_ASSIGNMENT'::public.order_status then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_ASSIGNABLE';
  end if;

  if v_order.start_time is null
     or v_order.end_time is null
     or v_order.end_time <= v_order.start_time then
    raise exception using errcode = 'P0001', message = 'ORDER_INVALID_WINDOW';
  end if;

  select v.*
    into v_vehicle
    from public.vehicles as v
   where v.id = p_vehicle_id
     and v.organization_id = p_organization_id
     and v.deleted_at is null
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'VEHICLE_NOT_FOUND';
  end if;

  select d.*
    into v_driver
    from public.drivers as d
   where d.id = p_driver_id
     and d.organization_id = p_organization_id
     and d.deleted_at is null
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DRIVER_NOT_FOUND';
  end if;

  if v_vehicle.status = 'MAINTENANCE'::public.vehicle_status then
    raise exception using errcode = 'P0001', message = 'VEHICLE_MAINTENANCE';
  end if;

  if v_vehicle.status = 'INACTIVE'::public.vehicle_status then
    raise exception using errcode = 'P0001', message = 'VEHICLE_INACTIVE';
  end if;

  if v_vehicle.registration_expiry is not null
     and v_vehicle.registration_expiry::timestamp
       < (now() at time zone 'UTC') then
    raise exception using errcode = 'P0001', message = 'VEHICLE_REGISTRATION_EXPIRED';
  end if;

  if v_vehicle.insurance_expiry is not null
     and v_vehicle.insurance_expiry::timestamp
       < (now() at time zone 'UTC') then
    raise exception using errcode = 'P0001', message = 'VEHICLE_INSURANCE_EXPIRED';
  end if;

  if v_driver.status = 'INACTIVE'::public.driver_status then
    raise exception using errcode = 'P0001', message = 'DRIVER_INACTIVE';
  end if;

  if v_driver.license_expiry is not null
     and v_driver.license_expiry::timestamp
       < (now() at time zone 'UTC') then
    raise exception using errcode = 'P0001', message = 'DRIVER_LICENSE_EXPIRED';
  end if;

  perform 1
    from public.assignments as a
   where a.organization_id = p_organization_id
     and a.order_id = v_order.id
     and a.status = 'ACTIVE'
     and a.deleted_at is null
   for update;

  if found then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_ASSIGNED';
  end if;

  insert into public.assignments (
    organization_id,
    order_id,
    vehicle_id,
    driver_id,
    start_time,
    end_time,
    status,
    created_by,
    updated_by
  ) values (
    p_organization_id,
    v_order.id,
    p_vehicle_id,
    p_driver_id,
    v_order.start_time,
    v_order.end_time,
    'ACTIVE',
    p_actor_id,
    p_actor_id
  );

  update public.orders
     set status = 'ASSIGNED'::public.order_status,
         vehicle_id = p_vehicle_id,
         driver_id = p_driver_id,
         updated_by = p_actor_id,
         updated_at = now()
   where id = v_order.id
     and organization_id = p_organization_id
     and deleted_at is null
     and status = 'WAITING_ASSIGNMENT'::public.order_status;

  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_ASSIGNED';
  end if;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    created_by
  ) values (
    p_organization_id,
    v_order.id,
    v_order.status,
    'ASSIGNED'::public.order_status,
    coalesce(p_reason, 'Điều phối'),
    p_actor_id
  );

  insert into public.audit_events (
    organization_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    request_id
  ) values (
    p_organization_id,
    p_actor_id,
    p_actor_role,
    'ASSIGN',
    'order',
    v_order.id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object(
      'status', 'ASSIGNED',
      'vehicleId', p_vehicle_id,
      'driverId', p_driver_id
    ),
    p_request_id
  );

  return query
    select v_order.id, 'ASSIGNED'::public.order_status;
end;
$$;

revoke all on function public.assign_vehicle_driver_atomic(
  uuid, uuid, uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.assign_vehicle_driver_atomic(
  uuid, uuid, uuid, uuid, uuid, text, text, text
) to service_role;
