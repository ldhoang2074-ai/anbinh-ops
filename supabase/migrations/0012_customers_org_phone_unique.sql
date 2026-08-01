-- 0012_customers_org_phone_unique.sql
-- Bảo đảm mỗi số điện thoại chỉ có một khách hàng trong cùng tổ chức.
-- Unique index này cũng là điều kiện để createLead dùng ON CONFLICT.

do $$
begin
  if exists (
    select 1
    from public.customers
    group by organization_id, phone
    having count(*) > 1
  ) then
    raise exception
      'Cannot create customer phone unique index: duplicate organization_id and phone values exist';
  end if;
end
$$;

create unique index if not exists customers_organization_id_phone_uidx
  on public.customers (organization_id, phone);