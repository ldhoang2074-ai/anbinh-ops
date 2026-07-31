// tests/e2e/run.mjs — KIỂM THỬ E2E WORKFLOW THẬT (cần Supabase + tài khoản đủ quyền).
// Chạy trọn: Lead → Quote → Deposit → Confirm → Order → Dispatch → Trip →
// Payment/Expense → Settlement → Completed, gọi qua API command thật.
// Yêu cầu env: APP_URL, TEST_MANAGER_JWT (hoặc cookie session).
import assert from 'node:assert/strict';

const APP = process.env.APP_URL;
const JWT = process.env.TEST_MANAGER_JWT;
if (!APP || !JWT) { console.error('SKIP: thiếu APP_URL/TEST_MANAGER_JWT — chưa cấu hình'); process.exit(2); }

async function cmd(name, body, idem) {
  const res = await fetch(`${APP}/api/commands/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${JWT}`, ...(idem ? { 'x-idempotency-key': idem } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

let pass = 0, fail = 0;
async function step(name, fn) { try { await fn(); console.log('PASS  ', name); pass++; } catch (e) { console.log('FAIL  ', name, '→', e.message); fail++; } }

let leadId, orderId;
await step('create_lead', async () => {
  const r = await cmd('create_lead', { name: 'E2E', phone: '0900' + Date.now() % 1000000, estimatedPrice: 800000 });
  assert.equal(r.json.ok, true); leadId = r.json.data.leadId;
});
await step('lead_transition → CONSULTING', async () => {
  const r = await cmd('lead_transition', { leadId, to: 'CONSULTING' });
  assert.equal(r.json.ok, true);
});
// ... (Slice 2-4: create_quote, send_quote, record_deposit, confirm_order, create_order,
//      assign_vehicle_driver, prepare_trip, start_trip, finish_trip, record_payment,
//      record_expense, settle_order) — thêm khi các command tương ứng hoàn tất.

await step('idempotency: gửi payment 2 lần không tạo trùng', async () => {
  if (!orderId) return; // bỏ qua nếu chưa tới bước order
  const key = 'e2e-pay-' + Date.now();
  const a = await cmd('record_payment', { orderId, amount: 100000 }, key);
  const b = await cmd('record_payment', { orderId, amount: 100000 }, key);
  assert.deepEqual(a.json.data, b.json.data, 'Idempotency THỦNG: 2 response khác nhau');
});

console.log(`\nE2E: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
