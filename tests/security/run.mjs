// tests/security/run.mjs
// API security integration tests for an isolated local environment.

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
    'TỪ CHỐI: security test chỉ được chạy với app, ' +
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

const realOrganizationSlug =
  `security-real-${testTag}`;
const forgedOrganizationSlug =
  `security-forged-${testTag}`;

const password = `Security-${testTag}-Aa1!`;
const email =
  `security-sales-${testTag}@example.com`;
const phone =
  `09${testTag.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;

const state = {
  userId: null,
  organizationId: null,
  forgedOrganizationId: null,
  cookieHeader: '',
  createdLeadId: null,
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

async function command(
  name,
  body,
  {
    authenticated = false,
    headers = {},
  } = {}
) {
  const requestHeaders = {
    'content-type': 'application/json',
    ...headers,
  };

  if (authenticated) {
    requestHeaders.cookie = state.cookieHeader;
  }

  const response = await fetch(
    `${appBase}/api/commands/${name}`,
    {
      method: 'POST',
      headers: requestHeaders,
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

async function createSessionCookie() {
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
      'Không tạo được session cookie: ' +
      (error?.message ?? 'không có session')
    );
  }

  const cookieHeader = Array.from(
    cookieJar.entries(),
    ([name, value]) =>
      `${name}=${value}`
  ).join('; ');

  assert.ok(
    cookieHeader.length > 0,
    'Supabase không tạo cookie đăng nhập'
  );

  return cookieHeader;
}

async function setup() {
  const { data: salesRole } = await expectOk(
    admin
      .from('roles')
      .select('id')
      .eq('key', 'SALES')
      .single(),
    'Đọc role SALES'
  );

  const { data: organization } =
    await expectOk(
      admin
        .from('organizations')
        .insert({
          slug: realOrganizationSlug,
          name: `Security Real ${testTag}`,
        })
        .select('id')
        .single(),
      'Tạo organization thật'
    );

  const { data: forgedOrganization } =
    await expectOk(
      admin
        .from('organizations')
        .insert({
          slug: forgedOrganizationSlug,
          name: `Security Forged ${testTag}`,
        })
        .select('id')
        .single(),
      'Tạo organization giả'
    );

  state.organizationId = organization.id;
  state.forgedOrganizationId =
    forgedOrganization.id;

  const {
    data: userData,
    error: userError,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Security Sales',
    },
  });

  if (userError || !userData.user) {
    throw new Error(
      'Tạo user test: ' +
      (
        userError?.message ??
        'không nhận được user'
      )
    );
  }

  state.userId = userData.user.id;

  await expectOk(
    admin
      .from('organization_members')
      .insert({
        organization_id:
          state.organizationId,
        user_id: state.userId,
        status: 'ACTIVE',
      }),
    'Tạo membership'
  );

  await expectOk(
    admin
      .from('member_roles')
      .insert({
        organization_id:
          state.organizationId,
        user_id: state.userId,
        role_id: salesRole.id,
      }),
    'Gán role SALES'
  );

  state.cookieHeader =
    await createSessionCookie();
}

async function cleanup() {
  const database =
    new PostgresClient({
      connectionString: DB_URL,
    });

  await database.connect();

  try {
    await database.query('begin');

    /*
     * audit_events là append-only trong ứng dụng thật.
     * Chỉ trong database local của test, tạm tắt đúng trigger DELETE
     * để xóa organization thử cùng dữ liệu cascade.
     */
    await database.query(
      'alter table public.audit_events ' +
      'disable trigger t_audit_no_delete'
    );

    await database.query(
      `
        delete from public.organizations
        where slug = any($1::text[])
      `,
      [[
        realOrganizationSlug,
        forgedOrganizationSlug,
      ]]
    );

    await database.query(
      `
        delete from auth.users
        where email = $1
      `,
      [email]
    );

    await database.query(
      'alter table public.audit_events ' +
      'enable trigger t_audit_no_delete'
    );

    const organizationIds = [
      state.organizationId,
      state.forgedOrganizationId,
    ].filter(Boolean);

    const { rows } = await database.query(
      `
        select
          (
            select count(*)::integer
            from public.organizations
            where slug = any($1::text[])
          ) as organizations,
          (
            select count(*)::integer
            from auth.users
            where email = $2
          ) as auth_users,
          (
            select count(*)::integer
            from public.audit_events
            where organization_id =
              any($3::uuid[])
          ) as audit_events
      `,
      [
        [
          realOrganizationSlug,
          forgedOrganizationSlug,
        ],
        email,
        organizationIds,
      ]
    );

    assert.deepEqual(
      rows[0],
      {
        organizations: 0,
        auth_users: 0,
        audit_events: 0,
      },
      'Dữ liệu security test chưa được dọn sạch'
    );

    await database.query('commit');

    console.log(
      'PASS   Dọn sạch toàn bộ dữ liệu security test'
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

async function getClientBundleText() {
  const loginResponse =
    await fetch(`${appBase}/login`);

  assert.equal(
    loginResponse.status,
    200,
    'Trang login không trả về HTTP 200'
  );

  const html = await loginResponse.text();
  const texts = [html];

  const scriptPaths = new Set();

  for (
    const match of html.matchAll(
      /<script[^>]+src=["']([^"']+)["']/gi
    )
  ) {
    scriptPaths.add(match[1]);
  }

  for (const scriptPath of scriptPaths) {
    const scriptUrl =
      new URL(scriptPath, appBase).toString();

    const response = await fetch(scriptUrl);

    if (response.ok) {
      texts.push(await response.text());
    }
  }

  return texts.join('\n');
}

try {
  await setup();

  await test(
    'Gọi API không có session trả về 401',
    async () => {
      const result = await command(
        'create_lead',
        {
          name: 'No Session',
          phone: '0900000000',
        }
      );

      assert.equal(result.status, 401);
      assert.equal(
        result.json.code,
        'NO_SESSION'
      );
    }
  );

  await test(
    'Command không tồn tại trả về 404',
    async () => {
      const result = await command(
        'drop_everything',
        {}
      );

      assert.equal(result.status, 404);
      assert.equal(result.json.ok, false);
    }
  );

  await test(
    'organizationId giả trong body và header bị bỏ qua',
    async () => {
      const result = await command(
        'create_lead',
        {
          name: 'Forged Organization Test',
          phone,
          organizationId:
            state.forgedOrganizationId,
          organization_id:
            state.forgedOrganizationId,
          serviceType:
            `SECURITY_${testTag}`,
        },
        {
          authenticated: true,
          headers: {
            'x-organization-id':
              state.forgedOrganizationId,
          },
        }
      );

      assert.equal(
        result.status,
        200,
        JSON.stringify(result.json)
      );

      assert.equal(result.json.ok, true);

      const leadId =
        result.json.data?.leadId;

      assert.ok(
        leadId,
        'API không trả về leadId'
      );

      state.createdLeadId = leadId;

      const { data: lead } = await expectOk(
        admin
          .from('leads')
          .select(
            'id, organization_id, assigned_staff'
          )
          .eq('id', leadId)
          .single(),
        'Đọc Lead vừa tạo'
      );

      assert.equal(
        lead.organization_id,
        state.organizationId,
        'Lead bị ghi vào organization giả'
      );

      assert.notEqual(
        lead.organization_id,
        state.forgedOrganizationId
      );

      assert.equal(
        lead.assigned_staff,
        state.userId,
        'Lead không được gán cho user trong session'
      );
    }
  );

  await test(
    'Request có session nhưng body sai trả về 422',
    async () => {
      const result = await command(
        'create_lead',
        {
          organizationId:
            state.forgedOrganizationId,
        },
        {
          authenticated: true,
        }
      );

      assert.equal(result.status, 422);
      assert.equal(
        result.json.code,
        'VALIDATION'
      );
    }
  );

  await test(
    'Client bundle không chứa service role secret',
    async () => {
      const bundleText =
        await getClientBundleText();

      assert.ok(
        !bundleText.includes(
          SERVICE_ROLE_KEY
        ),
        'Client bundle làm lộ service role secret'
      );

      assert.ok(
        !bundleText.includes(
          'SUPABASE_SERVICE_ROLE_KEY'
        ),
        'Client bundle chứa tên biến service role'
      );
    }
  );
} catch (error) {
  console.error(
    'FAIL   Chuẩn bị môi trường test →',
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
      'FAIL   Dọn dữ liệu security test →',
      error instanceof Error
        ? error.message
        : String(error)
    );

    fail += 1;
  }
}

console.log(
  `\nSECURITY: pass=${pass} fail=${fail}`
);

process.exit(fail > 0 ? 1 : 0);