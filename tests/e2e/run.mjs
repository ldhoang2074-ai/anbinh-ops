// tests/e2e/run.mjs
// E2E integration tests for the commands currently implemented.
// Flow:
// Sales creates Lead -> Sales moves Lead to CONSULTING ->
// Sales is blocked from dispatching -> Dispatcher assigns vehicle/driver ->
// overlapping assignment is rejected.
//
// This test is local-only and removes all test data afterward.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Client as PostgresClient } from 'pg';

const APP_URL = process.env.APP_URL;
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DB_URL;

if (
  !APP_URL ||
  !SUPABASE_URL ||
  !PUBLISHABLE_KEY ||
  !SERVICE_ROLE_KEY ||
  !DB_URL
) {
  console.error(
    'SKIP: cần APP_URL, NEXT_PUBLIC_SUPABASE_URL, ' +
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ' +
    'SUPABASE_SERVICE_ROLE_KEY và DB_URL'
  );

  process.exit(2);
}

function isLocalUrl(value) {
  try {
    return new Set([
      '127.0.0.1',
      'localhost',
      '::1',
    ]).has(new URL(value).hostname);
  } catch {
    return false;
  }
}

if (
  !isLocalUrl(APP_URL) ||
  !isLocalUrl(SUPABASE_URL) ||
  !isLocalUrl(DB_URL)
) {
  console.error(
    'TỪ CHỐI: E2E test chỉ được chạy với app, ' +
    'Supabase và PostgreSQL local.'
  );

  process.exit(2);
}

const appBase = APP_URL.replace(/\/+$/, '');

const admin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const testTag = randomUUID()
  .replaceAll('-', '')
  .slice(0, 12);

const organizationSlug = `e2e-${testTag}`;
const salesEmail =
  `e2e-sales-${testTag}@example.com`;
const dispatcherEmail =
  `e2e-dispatcher-${testTag}@example.com`;
const password = `E2e-${testTag}-Aa1!`;

const tripOne = {
  start: '2035-01-15T08:00:00.000Z',
  end: '2035-01-15T10:00:00.000Z',
};

const tripTwo = {
  start: '2035-01-15T09:00:00.000Z',
  end: '2035-01-15T11:00:00.000Z',
};

const state = {
  organizationId: null,

  users: {
    sales: null,
    dispatcher: null,
  },

  cookies: {
    sales: '',
    dispatcher: '',
  },

  roles: {
    sales: null,
    dispatcher: null,
  },

  leadId: null,
  customerId: null,
  vehicleId: null,
  driverId: null,
  orderOneId: null,
  orderTwoId: null,
};

let pass = 0;
let fail = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log('PASS  ', name);
    pass += 1;
  } catch (error) {
    console.log(
      'FAIL  ',
      name,
      '→',
      error instanceof Error
        ? error.message
        : String(error)
    );

    fail += 1;
  }
}

async function expectOk(promise, label) {
  const result = await promise;

  if (result.error) {
    throw new Error(
      `${label}: ${result.error.message}`
    );
  }

  return result;
}

async function createTestUser(label, email) {
  const { data, error } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `E2E ${label}`,
      },
    });

  if (error || !data.user) {
    throw new Error(
      `Tạo user ${label}: ` +
      (error?.message ?? 'không nhận được user')
    );
  }

  return data.user;
}

async function createSessionCookie(email) {
  const cookieJar = new Map();

  const client = createServerClient(
    SUPABASE_URL,
    PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(
            cookieJar.entries(),
            ([name, value]) => ({
              name,
              value,
            })
          );
        },

        setAll(cookiesToSet) {
          for (
            const {
              name,
              value,
            } of cookiesToSet
          ) {
            cookieJar.set(name, value);
          }
        },
      },
    }
  );

  const { data, error } =
    await client.auth.signInWithPassword({
      email,
      password,
    });

  if (error || !data.session) {
    throw new Error(
      `Đăng nhập ${email}: ` +
      (error?.message ?? 'không có session')
    );
  }

  const cookieHeader = Array.from(
    cookieJar.entries(),
    ([name, value]) => `${name}=${value}`
  ).join('; ');

  assert.ok(
    cookieHeader.length > 0,
    `Không tạo được cookie cho ${email}`
  );

  return cookieHeader;
}

async function command(
  name,
  body,
  cookieHeader,
  extraHeaders = {}
) {
  const response = await fetch(
    `${appBase}/api/commands/${name}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      redirect: 'manual',
    }
  );

  const json =
    await response.json().catch(() => ({}));

  return {
    status: response.status,
    json,
  };
}

async function setup() {
  const { data: roleRows } = await expectOk(
    admin
      .from('roles')
      .select('id, key')
      .in('key', [
        'SALES',
        'DISPATCHER',
      ]),
    'Đọc roles'
  );

  assert.equal(
    roleRows.length,
    2,
    'Seed chưa có đủ SALES và DISPATCHER'
  );

  state.roles.sales =
    roleRows.find(
      (role) => role.key === 'SALES'
    )?.id;

  state.roles.dispatcher =
    roleRows.find(
      (role) => role.key === 'DISPATCHER'
    )?.id;

  assert.ok(
    state.roles.sales &&
    state.roles.dispatcher,
    'Không tìm được role cần kiểm thử'
  );

  const { data: organization } =
    await expectOk(
      admin
        .from('organizations')
        .insert({
          slug: organizationSlug,
          name: `E2E Test ${testTag}`,
        })
        .select('id')
        .single(),
      'Tạo organization'
    );

  state.organizationId = organization.id;

  state.users.sales =
    await createTestUser(
      'Sales',
      salesEmail
    );

  state.users.dispatcher =
    await createTestUser(
      'Dispatcher',
      dispatcherEmail
    );

  await expectOk(
    admin
      .from('organization_members')
      .insert([
        {
          organization_id:
            state.organizationId,
          user_id: state.users.sales.id,
          status: 'ACTIVE',
        },
        {
          organization_id:
            state.organizationId,
          user_id:
            state.users.dispatcher.id,
          status: 'ACTIVE',
        },
      ]),
    'Tạo memberships'
  );

  await expectOk(
    admin
      .from('member_roles')
      .insert([
        {
          organization_id:
            state.organizationId,
          user_id: state.users.sales.id,
          role_id: state.roles.sales,
        },
        {
          organization_id:
            state.organizationId,
          user_id:
            state.users.dispatcher.id,
          role_id:
            state.roles.dispatcher,
        },
      ]),
    'Gán roles'
  );

  const { data: vehicle } = await expectOk(
    admin
      .from('vehicles')
      .insert({
        organization_id:
          state.organizationId,
        plate: `E2E-${testTag}`,
        model: 'E2E Test Vehicle',
        seats: 7,
        status: 'AVAILABLE',
        registration_expiry:
          '2036-12-31',
        insurance_expiry:
          '2036-12-31',
        created_by:
          state.users.dispatcher.id,
        updated_by:
          state.users.dispatcher.id,
      })
      .select('id')
      .single(),
    'Tạo vehicle'
  );

  state.vehicleId = vehicle.id;

  const { data: driver } = await expectOk(
    admin
      .from('drivers')
      .insert({
        organization_id:
          state.organizationId,
        name: 'E2E Test Driver',
        phone: `08${testTag.slice(0, 8)}`,
        status: 'AVAILABLE',
        license_expiry:
          '2036-12-31',
        created_by:
          state.users.dispatcher.id,
        updated_by:
          state.users.dispatcher.id,
      })
      .select('id')
      .single(),
    'Tạo driver'
  );

  state.driverId = driver.id;

  const { data: orders } = await expectOk(
    admin
      .from('orders')
      .insert([
        {
          organization_id:
            state.organizationId,
          order_code:
            `E2E-ONE-${testTag}`,
          service_type:
            `E2E_ORDER_ONE_${testTag}`,
          start_time: tripOne.start,
          end_time: tripOne.end,
          created_by:
            state.users.dispatcher.id,
          updated_by:
            state.users.dispatcher.id,
        },
        {
          organization_id:
            state.organizationId,
          order_code:
            `E2E-TWO-${testTag}`,
          service_type:
            `E2E_ORDER_TWO_${testTag}`,
          start_time: tripTwo.start,
          end_time: tripTwo.end,
          created_by:
            state.users.dispatcher.id,
          updated_by:
            state.users.dispatcher.id,
        },
      ])
      .select('id, order_code'),
    'Tạo hai orders'
  );

  state.orderOneId =
    orders.find(
      (order) =>
        order.order_code ===
        `E2E-ONE-${testTag}`
    )?.id;

  state.orderTwoId =
    orders.find(
      (order) =>
        order.order_code ===
        `E2E-TWO-${testTag}`
    )?.id;

  assert.ok(
    state.orderOneId &&
    state.orderTwoId,
    'Không tạo đủ hai orders'
  );

  state.cookies.sales =
    await createSessionCookie(salesEmail);

  state.cookies.dispatcher =
    await createSessionCookie(
      dispatcherEmail
    );
}

async function runTests() {
  await test(
    'Sales tạo Lead qua API và database ghi đúng',
    async () => {
      const result = await command(
        'create_lead',
        {
          name: 'E2E Customer',
          phone: `09${testTag.slice(0, 8)}`,
          email:
            `customer-${testTag}@example.com`,
          serviceType:
            `E2E_LEAD_${testTag}`,
          pickupLocation: 'Thái Nguyên',
          dropoffLocation: 'Hà Nội',
          passengerCount: 4,
          estimatedPrice: 800000,
          source: 'E2E_TEST',
        },
        state.cookies.sales
      );

      assert.equal(
        result.status,
        200,
        JSON.stringify(result.json)
      );

      assert.equal(result.json.ok, true);

      state.leadId =
        result.json.data?.leadId;

      state.customerId =
        result.json.data?.customerId;

      assert.ok(
        state.leadId &&
        state.customerId,
        'API không trả về leadId/customerId'
      );

      const { data: lead } = await expectOk(
        admin
          .from('leads')
          .select(
            'id, organization_id, customer_id, status, assigned_staff, service_type'
          )
          .eq('id', state.leadId)
          .single(),
        'Đọc Lead'
      );

      assert.equal(
        lead.organization_id,
        state.organizationId
      );

      assert.equal(
        lead.customer_id,
        state.customerId
      );

      assert.equal(
        lead.status,
        'LEAD_NEW'
      );

      assert.equal(
        lead.assigned_staff,
        state.users.sales.id
      );

      assert.equal(
        lead.service_type,
        `E2E_LEAD_${testTag}`
      );

      const { data: customer } =
        await expectOk(
          admin
            .from('customers')
            .select(
              'id, organization_id, name'
            )
            .eq('id', state.customerId)
            .single(),
          'Đọc Customer'
        );

      assert.equal(
        customer.organization_id,
        state.organizationId
      );

      assert.equal(
        customer.name,
        'E2E Customer'
      );

      const { count: auditCount } =
        await expectOk(
          admin
            .from('audit_events')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('entity_id', state.leadId)
            .eq('action', 'CREATE'),
          'Kiểm tra audit tạo Lead'
        );

      assert.equal(
        auditCount,
        1,
        'Thiếu audit CREATE của Lead'
      );
    }
  );

  await test(
    'Sales chuyển Lead sang CONSULTING',
    async () => {
      const result = await command(
        'lead_transition',
        {
          leadId: state.leadId,
          to: 'CONSULTING',
        },
        state.cookies.sales
      );

      assert.equal(
        result.status,
        200,
        JSON.stringify(result.json)
      );

      assert.equal(result.json.ok, true);
      assert.equal(
        result.json.data?.status,
        'CONSULTING'
      );

      const { data: lead } = await expectOk(
        admin
          .from('leads')
          .select('status')
          .eq('id', state.leadId)
          .single(),
        'Đọc trạng thái Lead'
      );

      assert.equal(
        lead.status,
        'CONSULTING'
      );

      const { count: auditCount } =
        await expectOk(
          admin
            .from('audit_events')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('entity_id', state.leadId)
            .eq('action', 'STATUS_CHANGE'),
          'Kiểm tra audit chuyển Lead'
        );

      assert.equal(
        auditCount,
        1,
        'Thiếu audit STATUS_CHANGE'
      );
    }
  );

  await test(
    'Sales không thể điều phối xe và tài xế',
    async () => {
      const result = await command(
        'assign_vehicle_driver',
        {
          orderId: state.orderOneId,
          vehicleId: state.vehicleId,
          driverId: state.driverId,
        },
        state.cookies.sales
      );

      assert.equal(result.status, 403);
      assert.equal(
        result.json.code,
        'FORBIDDEN'
      );

      const { count } = await expectOk(
        admin
          .from('assignments')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('order_id', state.orderOneId),
        'Đếm assignment trái phép'
      );

      assert.equal(
        count,
        0,
        'Sales đã tạo được assignment'
      );
    }
  );

  await test(
    'Dispatcher điều phối thành công và ghi đủ dữ liệu',
    async () => {
      const result = await command(
        'assign_vehicle_driver',
        {
          orderId: state.orderOneId,
          vehicleId: state.vehicleId,
          driverId: state.driverId,
          reason: 'E2E dispatch',
        },
        state.cookies.dispatcher
      );

      assert.equal(
        result.status,
        200,
        JSON.stringify(result.json)
      );

      assert.equal(result.json.ok, true);
      assert.equal(
        result.json.data?.status,
        'ASSIGNED'
      );

      const { data: order } = await expectOk(
        admin
          .from('orders')
          .select(
            'status, vehicle_id, driver_id'
          )
          .eq('id', state.orderOneId)
          .single(),
        'Đọc Order đã điều phối'
      );

      assert.equal(
        order.status,
        'ASSIGNED'
      );

      assert.equal(
        order.vehicle_id,
        state.vehicleId
      );

      assert.equal(
        order.driver_id,
        state.driverId
      );

      const { data: assignment } =
        await expectOk(
          admin
            .from('assignments')
            .select(
              'order_id, vehicle_id, driver_id, status, start_time, end_time'
            )
            .eq('order_id', state.orderOneId)
            .single(),
          'Đọc Assignment'
        );

      assert.equal(
        assignment.vehicle_id,
        state.vehicleId
      );

      assert.equal(
        assignment.driver_id,
        state.driverId
      );

      assert.equal(
        assignment.status,
        'ACTIVE'
      );

      assert.equal(
        new Date(
          assignment.start_time
        ).toISOString(),
        tripOne.start
      );

      assert.equal(
        new Date(
          assignment.end_time
        ).toISOString(),
        tripOne.end
      );

      const { count: historyCount } =
        await expectOk(
          admin
            .from('order_status_history')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('order_id', state.orderOneId)
            .eq('to_status', 'ASSIGNED'),
          'Kiểm tra lịch sử Order'
        );

      assert.equal(
        historyCount,
        1,
        'Thiếu order_status_history'
      );

      const { count: auditCount } =
        await expectOk(
          admin
            .from('audit_events')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('entity_id', state.orderOneId)
            .eq('action', 'ASSIGN'),
          'Kiểm tra audit điều phối'
        );

      assert.equal(
        auditCount,
        1,
        'Thiếu audit ASSIGN'
      );
    }
  );

  await test(
    'Đơn trùng giờ bị chặn và không tạo assignment',
    async () => {
      const result = await command(
        'assign_vehicle_driver',
        {
          orderId: state.orderTwoId,
          vehicleId: state.vehicleId,
          driverId: state.driverId,
        },
        state.cookies.dispatcher
      );

      assert.equal(result.status, 400);
      assert.equal(result.json.ok, false);

      const { count } = await expectOk(
        admin
          .from('assignments')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('order_id', state.orderTwoId),
        'Đếm assignment trùng giờ'
      );

      assert.equal(
        count,
        0,
        'Assignment trùng giờ đã được ghi'
      );

      const { data: order } = await expectOk(
        admin
          .from('orders')
          .select(
            'status, vehicle_id, driver_id'
          )
          .eq('id', state.orderTwoId)
          .single(),
        'Đọc Order bị từ chối'
      );

      assert.equal(
        order.status,
        'WAITING_ASSIGNMENT'
      );

      assert.equal(order.vehicle_id, null);
      assert.equal(order.driver_id, null);
    }
  );
}

async function cleanup() {
  const database = new PostgresClient({
    connectionString: DB_URL,
  });

  await database.connect();

  try {
    await database.query('begin');

    /*
     * audit_events là append-only trong ứng dụng thật.
     * Chỉ trong PostgreSQL local của test, tạm tắt đúng trigger DELETE
     * để xóa organization test cùng dữ liệu cascade.
     */
    await database.query(
      'alter table public.audit_events ' +
      'disable trigger t_audit_no_delete'
    );

    await database.query(
      `
        delete from public.organizations
        where slug = $1
      `,
      [organizationSlug]
    );

    await database.query(
      `
        delete from auth.users
        where email = any($1::text[])
      `,
      [[
        salesEmail,
        dispatcherEmail,
      ]]
    );

    await database.query(
      'alter table public.audit_events ' +
      'enable trigger t_audit_no_delete'
    );

    const { rows } = await database.query(
      `
        select
          (
            select count(*)::integer
            from public.organizations
            where slug = $1
          ) as organizations,
          (
            select count(*)::integer
            from auth.users
            where email = any($2::text[])
          ) as auth_users,
          (
            select count(*)::integer
            from public.leads
            where service_type = $3
          ) as leads,
          (
            select count(*)::integer
            from public.orders
            where order_code = any($4::text[])
          ) as orders,
          (
            select count(*)::integer
            from public.vehicles
            where plate = $5
          ) as vehicles
      `,
      [
        organizationSlug,
        [
          salesEmail,
          dispatcherEmail,
        ],
        `E2E_LEAD_${testTag}`,
        [
          `E2E-ONE-${testTag}`,
          `E2E-TWO-${testTag}`,
        ],
        `E2E-${testTag}`,
      ]
    );

    assert.deepEqual(
      rows[0],
      {
        organizations: 0,
        auth_users: 0,
        leads: 0,
        orders: 0,
        vehicles: 0,
      },
      'Dữ liệu E2E test chưa được dọn sạch'
    );

    await database.query('commit');

    console.log(
      'PASS   Dọn sạch toàn bộ dữ liệu E2E test'
    );
  } catch (error) {
    await database
      .query('rollback')
      .catch(() => {});

    throw error;
  } finally {
    await database.end();
  }
}

try {
  await setup();
  await runTests();
} catch (error) {
  console.error(
    'FAIL   Chuẩn bị môi trường E2E →',
    error instanceof Error
      ? error.message
      : String(error)
  );

  fail += 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(
      'FAIL   Dọn dữ liệu E2E →',
      error instanceof Error
        ? error.message
        : String(error)
    );

    fail += 1;
  }
}

console.log(
  `\nE2E: pass=${pass} fail=${fail}`
);

process.exit(fail > 0 ? 1 : 0);