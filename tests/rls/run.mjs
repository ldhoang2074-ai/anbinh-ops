// tests/rls/run.mjs
// RLS integration tests against an isolated local Supabase instance.
// The test provisions its own users and data, then removes them afterward.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    'SKIP: cần NEXT_PUBLIC_SUPABASE_URL, ' +
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY và ' +
    'SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(2);
}

let hostname;

try {
  hostname = new URL(SUPABASE_URL).hostname;
} catch {
  console.error('SKIP: NEXT_PUBLIC_SUPABASE_URL không hợp lệ');
  process.exit(2);
}

const localHosts = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
]);

if (
  !localHosts.has(hostname) &&
  process.env.ALLOW_REMOTE_RLS_TESTS !== '1'
) {
  console.error(
    'TỪ CHỐI: RLS test chỉ được chạy trên Supabase local. ' +
    'Không chạy nhầm vào production.'
  );
  process.exit(2);
}

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

function createPublicClient() {
  return createClient(
    SUPABASE_URL,
    PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
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

const testTag = randomUUID()
  .replaceAll('-', '')
  .slice(0, 12);

const password = `Rls-${testTag}-Aa1!`;

const createdUserIds = [];
const createdOrganizationIds = [];

const state = {
  users: {},
  clients: {},
  roles: {},
  organizations: {},
  drivers: {},
  vehicles: {},
  leads: {},
  orders: {},
  payment: null,
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

async function createTestUser(label) {
  const email =
    `rls-${label}-${testTag}@example.com`
      .toLowerCase();

  const { data, error } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `RLS ${label}`,
      },
    });

  if (error || !data.user) {
    throw new Error(
      `Tạo user ${label}: ` +
      (error?.message ?? 'không nhận được user')
    );
  }

  createdUserIds.push(data.user.id);

  return {
    id: data.user.id,
    email,
  };
}

async function signInUser(user) {
  const client = createPublicClient();

  const { data, error } =
    await client.auth.signInWithPassword({
      email: user.email,
      password,
    });

  if (error || !data.session) {
    throw new Error(
      `Đăng nhập ${user.email}: ` +
      (error?.message ?? 'không có session')
    );
  }

  return client;
}

async function setup() {
  const roleKeys = [
    'SALES',
    'DISPATCHER',
    'ACCOUNTANT',
    'DRIVER',
  ];

  const { data: roleRows } = await expectOk(
    admin
      .from('roles')
      .select('id, key')
      .in('key', roleKeys),
    'Đọc roles'
  );

  assert.equal(
    roleRows.length,
    roleKeys.length,
    'Seed chưa có đủ 4 roles cần kiểm thử'
  );

  for (const role of roleRows) {
    state.roles[role.key] = role.id;
  }

  const { data: orgA } = await expectOk(
    admin
      .from('organizations')
      .insert({
        slug: `rls-a-${testTag}`,
        name: `RLS Test A ${testTag}`,
      })
      .select('id')
      .single(),
    'Tạo organization A'
  );

  const { data: orgB } = await expectOk(
    admin
      .from('organizations')
      .insert({
        slug: `rls-b-${testTag}`,
        name: `RLS Test B ${testTag}`,
      })
      .select('id')
      .single(),
    'Tạo organization B'
  );

  state.organizations.a = orgA.id;
  state.organizations.b = orgB.id;

  createdOrganizationIds.push(
    orgA.id,
    orgB.id
  );

  const userLabels = [
    'sales-a',
    'sales-b',
    'sales-org-b',
    'dispatcher',
    'accountant',
    'driver-a',
    'driver-b',
  ];

  for (const label of userLabels) {
    state.users[label] =
      await createTestUser(label);
  }

  await expectOk(
    admin
      .from('organization_members')
      .insert([
        {
          organization_id: orgA.id,
          user_id: state.users['sales-a'].id,
          status: 'ACTIVE',
        },
        {
          organization_id: orgA.id,
          user_id: state.users['sales-b'].id,
          status: 'ACTIVE',
        },
        {
          organization_id: orgB.id,
          user_id: state.users['sales-org-b'].id,
          status: 'ACTIVE',
        },
        {
          organization_id: orgA.id,
          user_id: state.users.dispatcher.id,
          status: 'ACTIVE',
        },
        {
          organization_id: orgA.id,
          user_id: state.users.accountant.id,
          status: 'ACTIVE',
        },
        {
          organization_id: orgA.id,
          user_id: state.users['driver-a'].id,
          status: 'ACTIVE',
        },
        {
          organization_id: orgA.id,
          user_id: state.users['driver-b'].id,
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
          organization_id: orgA.id,
          user_id: state.users['sales-a'].id,
          role_id: state.roles.SALES,
        },
        {
          organization_id: orgA.id,
          user_id: state.users['sales-b'].id,
          role_id: state.roles.SALES,
        },
        {
          organization_id: orgB.id,
          user_id: state.users['sales-org-b'].id,
          role_id: state.roles.SALES,
        },
        {
          organization_id: orgA.id,
          user_id: state.users.dispatcher.id,
          role_id: state.roles.DISPATCHER,
        },
        {
          organization_id: orgA.id,
          user_id: state.users.accountant.id,
          role_id: state.roles.ACCOUNTANT,
        },
        {
          organization_id: orgA.id,
          user_id: state.users['driver-a'].id,
          role_id: state.roles.DRIVER,
        },
        {
          organization_id: orgA.id,
          user_id: state.users['driver-b'].id,
          role_id: state.roles.DRIVER,
        },
      ]),
    'Gán roles'
  );

  const { data: driverRows } = await expectOk(
    admin
      .from('drivers')
      .insert([
        {
          organization_id: orgA.id,
          user_id: state.users['driver-a'].id,
          name: 'RLS Driver A',
          phone: '0900000001',
        },
        {
          organization_id: orgA.id,
          user_id: state.users['driver-b'].id,
          name: 'RLS Driver B',
          phone: '0900000002',
        },
      ])
      .select('id, user_id'),
    'Tạo drivers'
  );

  for (const driver of driverRows) {
    if (
      driver.user_id ===
      state.users['driver-a'].id
    ) {
      state.drivers.a = driver.id;
    }

    if (
      driver.user_id ===
      state.users['driver-b'].id
    ) {
      state.drivers.b = driver.id;
    }
  }

  assert.ok(
    state.drivers.a &&
    state.drivers.b,
    'Không tạo đủ hai driver'
  );

  const { data: vehicleRows } = await expectOk(
    admin
      .from('vehicles')
      .insert([
        {
          organization_id: orgA.id,
          plate: `RLS-A-${testTag}`,
          model: 'Test Vehicle A',
          seats: 7,
        },
        {
          organization_id: orgA.id,
          plate: `RLS-B-${testTag}`,
          model: 'Test Vehicle B',
          seats: 7,
        },
      ])
      .select('id, plate'),
    'Tạo vehicles'
  );

  state.vehicles.a = vehicleRows[0].id;
  state.vehicles.b = vehicleRows[1].id;

  const { data: leadRows } = await expectOk(
    admin
      .from('leads')
      .insert([
        {
          organization_id: orgA.id,
          assigned_staff:
            state.users['sales-a'].id,
          service_type: 'RLS_SALES_A',
        },
        {
          organization_id: orgA.id,
          assigned_staff:
            state.users['sales-b'].id,
          service_type: 'RLS_SALES_B',
        },
        {
          organization_id: orgB.id,
          assigned_staff:
            state.users['sales-org-b'].id,
          service_type: 'RLS_ORG_B',
        },
      ])
      .select(
        'id, organization_id, assigned_staff'
      ),
    'Tạo leads'
  );

  state.leads.a = leadRows.find(
    (row) =>
      row.assigned_staff ===
      state.users['sales-a'].id
  );

  state.leads.b = leadRows.find(
    (row) =>
      row.assigned_staff ===
      state.users['sales-b'].id
  );

  state.leads.orgB = leadRows.find(
    (row) =>
      row.organization_id === orgB.id
  );

  assert.ok(
    state.leads.a &&
    state.leads.b &&
    state.leads.orgB,
    'Không tạo đủ leads kiểm thử'
  );

  const { data: orderRows } = await expectOk(
    admin
      .from('orders')
      .insert([
        {
          organization_id: orgA.id,
          order_code: `RLS-A-${testTag}`,
          driver_id: state.drivers.a,
          vehicle_id: state.vehicles.a,
          service_type: 'RLS_ORDER_A',
        },
        {
          organization_id: orgA.id,
          order_code: `RLS-B-${testTag}`,
          driver_id: state.drivers.b,
          vehicle_id: state.vehicles.b,
          service_type: 'RLS_ORDER_B',
        },
      ])
      .select(
        'id, driver_id, service_type'
      ),
    'Tạo orders'
  );

  state.orders.a = orderRows.find(
    (row) =>
      row.driver_id === state.drivers.a
  );

  state.orders.b = orderRows.find(
    (row) =>
      row.driver_id === state.drivers.b
  );

  assert.ok(
    state.orders.a &&
    state.orders.b,
    'Không tạo đủ orders kiểm thử'
  );

  const { data: payment } = await expectOk(
    admin
      .from('payments')
      .insert({
        organization_id: orgA.id,
        order_id: state.orders.a.id,
        amount: 100000,
        method: 'RLS_TEST',
      })
      .select('id')
      .single(),
    'Tạo payment'
  );

  state.payment = payment;

  state.clients.salesA =
    await signInUser(
      state.users['sales-a']
    );

  state.clients.dispatcher =
    await signInUser(
      state.users.dispatcher
    );

  state.clients.accountant =
    await signInUser(
      state.users.accountant
    );

  state.clients.driverA =
    await signInUser(
      state.users['driver-a']
    );
}

async function runTests() {
  await test(
    'Sales A chỉ thấy lead của mình, không thấy Sales B hoặc org khác',
    async () => {
      const { data, error } =
        await state.clients.salesA
          .from('leads')
          .select(
            'id, organization_id, assigned_staff'
          )
          .in('id', [
            state.leads.a.id,
            state.leads.b.id,
            state.leads.orgB.id,
          ]);

      assert.ifError(error);

      const ids = new Set(
        (data ?? []).map((row) => row.id)
      );

      assert.equal(
        data.length,
        1,
        'Sales A phải nhận đúng một lead'
      );

      assert.ok(
        ids.has(state.leads.a.id),
        'Sales A không thấy lead của chính mình'
      );

      assert.ok(
        !ids.has(state.leads.b.id),
        'Sales A nhìn thấy lead của Sales B'
      );

      assert.ok(
        !ids.has(state.leads.orgB.id),
        'Sales A nhìn thấy lead của organization khác'
      );
    }
  );

  await test(
    'Dispatcher không thấy payment, Accountant phải thấy payment',
    async () => {
      const dispatcherResult =
        await state.clients.dispatcher
          .from('payments')
          .select('id')
          .eq('id', state.payment.id);

      assert.ifError(
        dispatcherResult.error
      );

      assert.equal(
        dispatcherResult.data.length,
        0,
        'Dispatcher nhìn thấy payment'
      );

      const accountantResult =
        await state.clients.accountant
          .from('payments')
          .select('id')
          .eq('id', state.payment.id);

      assert.ifError(
        accountantResult.error
      );

      assert.equal(
        accountantResult.data.length,
        1,
        'Accountant không thấy payment dù có finance.read'
      );

      assert.equal(
        accountantResult.data[0].id,
        state.payment.id
      );
    }
  );

  await test(
    'Driver A chỉ thấy order được gán cho mình',
    async () => {
      const { data, error } =
        await state.clients.driverA
          .from('orders')
          .select('id, driver_id')
          .in('id', [
            state.orders.a.id,
            state.orders.b.id,
          ]);

      assert.ifError(error);

      const ids = new Set(
        (data ?? []).map((row) => row.id)
      );

      assert.equal(
        data.length,
        1,
        'Driver A phải nhận đúng một order'
      );

      assert.ok(
        ids.has(state.orders.a.id),
        'Driver A không thấy order của mình'
      );

      assert.ok(
        !ids.has(state.orders.b.id),
        'Driver A nhìn thấy order của Driver B'
      );
    }
  );

  await test(
    'Accountant không thể insert assignment trực tiếp',
    async () => {
      const { error } =
        await state.clients.accountant
          .from('assignments')
          .insert({
            organization_id:
              state.organizations.a,
            order_id: state.orders.a.id,
            vehicle_id: state.vehicles.a,
            driver_id: state.drivers.a,
            start_time:
              '2030-01-01T08:00:00.000Z',
            end_time:
              '2030-01-01T10:00:00.000Z',
          })
          .select('id');

      assert.ok(
        error,
        'Accountant insert assignment thành công'
      );

      const {
        count,
        error: countError,
      } = await admin
        .from('assignments')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq(
          'order_id',
          state.orders.a.id
        );

      assert.ifError(countError);

      assert.equal(
        count,
        0,
        'Assignment trái phép đã được ghi vào database'
      );
    }
  );

  await test(
    'Authenticated client không thể UPDATE trực tiếp order',
    async () => {
      const beforeResult =
        await state.clients.dispatcher
          .from('orders')
          .select('id, service_type')
          .eq('id', state.orders.a.id)
          .single();

      assert.ifError(
        beforeResult.error
      );

      const originalServiceType =
        beforeResult.data.service_type;

      const updateResult =
        await state.clients.dispatcher
          .from('orders')
          .update({
            service_type:
              'UNAUTHORIZED_UPDATE',
          })
          .eq('id', state.orders.a.id)
          .select('id, service_type');

      assert.ok(
        updateResult.error,
        'Client UPDATE order thành công'
      );

      const afterResult = await admin
        .from('orders')
        .select('service_type')
        .eq('id', state.orders.a.id)
        .single();

      assert.ifError(
        afterResult.error
      );

      assert.equal(
        afterResult.data.service_type,
        originalServiceType,
        'Order đã bị thay đổi trái phép'
      );
    }
  );
}

async function cleanup() {
  if (createdOrganizationIds.length > 0) {
    const { error } = await admin
      .from('organizations')
      .delete()
      .in('id', createdOrganizationIds);

    if (error) {
      console.error(
        'CLEANUP organization:',
        error.message
      );
    }
  }

  for (
    const userId of
    [...createdUserIds].reverse()
  ) {
    const { error } =
      await admin.auth.admin.deleteUser(
        userId
      );

    if (error) {
      console.error(
        'CLEANUP user:',
        userId,
        error.message
      );
    }
  }
}

try {
  await setup();
  await runTests();
} catch (error) {
  console.error(
    'FAIL   Chuẩn bị môi trường test →',
    error instanceof Error
      ? error.message
      : String(error)
  );

  fail += 1;
} finally {
  await cleanup();
}

console.log(
  `\nRLS: pass=${pass} fail=${fail}`
);

process.exit(fail > 0 ? 1 : 0);