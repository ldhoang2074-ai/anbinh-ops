-- ============================================================
-- 0011_api_role_grants.sql
-- Explicit database privileges for Supabase API roles.
-- RLS policies remain the final authorization layer.
-- ============================================================

-- Anonymous callers must not access application tables directly.
revoke all privileges on all tables in schema public
  from public, anon;

revoke all privileges on all sequences in schema public
  from public, anon;

-- Authenticated users start with no direct table privileges.
-- Only the explicitly listed read operations below are allowed.
revoke all privileges on all tables in schema public
  from authenticated;

revoke all privileges on all sequences in schema public
  from authenticated;

grant select on table
  public.approval_requests,
  public.assignments,
  public.attachments,
  public.audit_events,
  public.customers,
  public.debts,
  public.driver_documents,
  public.drivers,
  public.expenses,
  public.financial_adjustments,
  public.invitations,
  public.leads,
  public.member_roles,
  public.order_status_history,
  public.orders,
  public.organization_members,
  public.organizations,
  public.payments,
  public.permissions,
  public.profiles,
  public.quote_versions,
  public.quotes,
  public.role_permissions,
  public.roles,
  public.settlements,
  public.traffic_events,
  public.trip_events,
  public.vehicle_documents,
  public.vehicles
to authenticated;

-- profiles_update_self is the only client-side write policy.
grant update on table public.profiles
  to authenticated;

-- Server commands use service_role.
-- service_role bypasses RLS, but PostgreSQL still requires table privileges.
grant all privileges on all tables in schema public
  to service_role;

grant all privileges on all sequences in schema public
  to service_role;

-- Keep the same secure defaults for tables created by future migrations.
alter default privileges for role postgres in schema public
  revoke all privileges on tables
  from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences
  from public, anon, authenticated;

alter default privileges for role postgres in schema public
  grant all privileges on tables
  to service_role;

alter default privileges for role postgres in schema public
  grant all privileges on sequences
  to service_role;