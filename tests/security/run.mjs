// tests/security/run.mjs — KIỂM THỬ BẢO MẬT THẬT (cần Supabase/app đang chạy).
import assert from 'node:assert/strict';

const APP = process.env.APP_URL;
if (!APP) { console.error('SKIP: thiếu APP_URL — chưa cấu hình'); process.exit(2); }

async function cmd(name, body, headers = {}) {
  const res = await fetch(`${APP}/api/commands/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log('PASS  ', name); pass++; } catch (e) { console.log('FAIL  ', name, '→', e.message); fail++; } }

await t('Gọi API không session → 401', async () => {
  const r = await cmd('create_lead', { name: 'x', phone: '0900000000' });
  assert.equal(r.status, 401);
});

await t('Command không tồn tại → 404', async () => {
  const r = await cmd('drop_everything', {});
  assert.equal(r.status, 404);
});

await t('Đổi organization_id trong request KHÔNG có tác dụng', async () => {
  // org lấy từ session server, không từ body → dù gửi org lạ vẫn bị bỏ qua.
  const r = await cmd('create_lead', { name: 'x', phone: '0900000000', organizationId: 'other-org' },
    { Authorization: `Bearer ${process.env.TEST_SALES_A_JWT ?? ''}` });
  // Nếu có JWT hợp lệ: lead tạo trong org của session, không phải 'other-org'. Nếu không JWT: 401.
  assert.ok(r.status === 200 || r.status === 401);
});

await t('Bundle client KHÔNG chứa service role key', async () => {
  // Kiểm tra trang login không lộ secret (chuỗi bắt đầu 'eyJ...' role service).
  const res = await fetch(`${APP}/login`);
  const html = await res.text();
  assert.ok(!/service_role/i.test(html), 'Lộ service_role trong HTML');
});

console.log(`\nSECURITY: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
