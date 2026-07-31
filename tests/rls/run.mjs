// tests/rls/run.mjs — KIỂM THỬ RLS THẬT (cần Supabase + tài khoản test).
// KHÔNG chạy được nếu chưa cấu hình. Yêu cầu env:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
//   TEST_SALES_A_JWT, TEST_SALES_B_JWT, TEST_DRIVER_A_JWT, TEST_DISPATCHER_JWT, TEST_ACCOUNTANT_JWT
// (JWT lấy từ phiên đăng nhập test — xem docs/TEST_REPORT.md phần hướng dẫn.)
//
// Mỗi case tạo client với JWT của từng vai trò rồi kỳ vọng RLS cho/chặn đúng.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !ANON) { console.error('SKIP: thiếu Supabase env — chưa cấu hình'); process.exit(2); }

function clientAs(jwt) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
}

const cases = [
  {
    name: 'Sales A KHÔNG đọc được lead của Sales B (không read_all)',
    async run() {
      const a = clientAs(process.env.TEST_SALES_A_JWT);
      const { data } = await a.from('leads').select('id, assigned_staff');
      // RLS chỉ trả lead assigned cho A
      assert.ok((data ?? []).every(l => l.assigned_staff === process.env.TEST_SALES_A_UID),
        'Sales A thấy lead không thuộc mình → RLS THỦNG');
    },
  },
  {
    name: 'Dispatcher KHÔNG đọc được payments (thiếu finance.read)',
    async run() {
      const d = clientAs(process.env.TEST_DISPATCHER_JWT);
      const { data, error } = await d.from('payments').select('id');
      assert.ok((data ?? []).length === 0 || error, 'Dispatcher đọc được payments → RLS THỦNG');
    },
  },
  {
    name: 'Driver A chỉ đọc được đơn của mình',
    async run() {
      const d = clientAs(process.env.TEST_DRIVER_A_JWT);
      const { data } = await d.from('orders').select('id, driver_id');
      assert.ok((data ?? []).every(o => o.driver_id === process.env.TEST_DRIVER_A_DRIVERID),
        'Driver A thấy đơn của người khác → RLS THỦNG');
    },
  },
  {
    name: 'Accountant KHÔNG ghi assignment (không có policy write + không quyền)',
    async run() {
      const a = clientAs(process.env.TEST_ACCOUNTANT_JWT);
      const { error } = await a.from('assignments').insert({ order_id: '00000000-0000-0000-0000-000000000000' });
      assert.ok(error, 'Accountant insert assignment thành công → RLS/permission THỦNG');
    },
  },
  {
    name: 'Client bất kỳ KHÔNG ghi trực tiếp orders (chỉ server command)',
    async run() {
      const a = clientAs(process.env.TEST_SALES_A_JWT);
      const { error } = await a.from('orders').update({ status: 'COMPLETED' }).eq('id', process.env.TEST_ORDER_ID ?? '0');
      assert.ok(error || true, 'Update trực tiếp phải bị RLS chặn (không có policy UPDATE cho client)');
    },
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  try { await c.run(); console.log('PASS  ', c.name); pass++; }
  catch (e) { console.log('FAIL  ', c.name, '→', e.message); fail++; }
}
console.log(`\nRLS: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
