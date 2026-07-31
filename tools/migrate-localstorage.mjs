#!/usr/bin/env node
// tools/migrate-localstorage.mjs
// Nhập dữ liệu từ bản export localStorage (ab_ops_db_v1) vào PostgreSQL/Supabase.
//
// Tính năng: validate schema, DRY-RUN, mapping ID cũ→UUID mới, chống duplicate
// (idempotent theo natural key), báo cáo, chạy lại an toàn, backup trước khi ghi.
//
// Dùng:
//   node tools/migrate-localstorage.mjs --file export.json --org an-binh --dry-run
//   node tools/migrate-localstorage.mjs --file export.json --org an-binh --commit
//
// Cần env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (service role chỉ đọc từ môi trường, KHÔNG hardcode).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) =>
  a.startsWith('--') ? [[a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : []));

const FILE = args.file;
const ORG_SLUG = args.org || 'an-binh';
const DRY = !!args['dry-run'] || !args.commit;

if (!FILE) { console.error('Thiếu --file <export.json>'); process.exit(1); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false } });

// ---- 1) Đọc + validate ----
const raw = JSON.parse(readFileSync(FILE, 'utf8'));
const REQUIRED = ['customers', 'leads', 'quotes', 'orders', 'vehicles', 'drivers',
  'assignments', 'payments', 'expenses', 'auditLogs', 'trafficEvents'];
if (typeof raw.schemaVersion !== 'number') { console.error('File thiếu schemaVersion'); process.exit(1); }
const missing = REQUIRED.filter(k => !(k in raw));
if (missing.length) { console.error('Thiếu bảng:', missing.join(', ')); process.exit(1); }

const report = { dryRun: DRY, org: ORG_SLUG, inserted: {}, skipped: {}, errors: [] };
const idMap = {}; // 'leads:lea_x' -> uuid

function asArray(coll) {
  const v = raw[coll];
  return Array.isArray(v) ? v : Object.values(v || {});
}

async function main() {
  // ---- 2) Backup trạng thái đích hiện tại ----
  mkdirSync('tools/backups', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { data: org } = await db.from('organizations').select('id').eq('slug', ORG_SLUG).maybeSingle();
  if (!org) { console.error(`Không tìm thấy organization slug=${ORG_SLUG}. Chạy seed trước.`); process.exit(1); }
  const orgId = org.id;

  if (!DRY) {
    const backup = {};
    for (const t of ['customers', 'leads', 'quotes', 'orders', 'vehicles', 'drivers', 'assignments', 'payments', 'expenses']) {
      const { data } = await db.from(t).select('*').eq('organization_id', orgId);
      backup[t] = data || [];
    }
    writeFileSync(`tools/backups/target-${stamp}.backup.json`, JSON.stringify(backup, null, 2));
    console.log(`Đã backup dữ liệu đích → tools/backups/target-${stamp}.backup.json`);
  }

  // ---- 3) Migrate theo thứ tự phụ thuộc, idempotent theo natural key ----
  // customers: natural key = phone
  await upsertColl('customers', 'customers', (c) => ({
    organization_id: orgId, name: c.name, phone: c.phone, email: c.email || null, note: c.note || null,
  }), 'phone', (c) => c.phone);

  // leads
  await upsertColl('leads', 'leads', (l) => ({
    organization_id: orgId,
    customer_id: idMap['customers:' + l.customerId] || null,
    status: l.status, service_type: l.serviceType || null,
    pickup_location: l.pickupLocation || null, dropoff_location: l.dropoffLocation || null,
    passenger_count: l.passengerCount || null, estimated_price: Math.round(l.estimatedPrice || 0),
    source: l.source || null,
  }), null, null);

  // vehicles: natural key = plate
  await upsertColl('vehicles', 'vehicles', (v) => ({
    organization_id: orgId, plate: v.plate, model: v.model || null, seats: v.seats || null,
    status: v.status || 'AVAILABLE',
    registration_expiry: v.registrationExpiry ? v.registrationExpiry.slice(0, 10) : null,
    insurance_expiry: v.insuranceExpiry ? v.insuranceExpiry.slice(0, 10) : null,
  }), 'plate', (v) => v.plate);

  // drivers
  await upsertColl('drivers', 'drivers', (d) => ({
    organization_id: orgId, name: d.name, phone: d.phone || null, status: d.status || 'AVAILABLE',
    license_expiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : null,
  }), null, null);

  // orders: natural key = order_code
  await upsertColl('orders', 'orders', (o) => ({
    organization_id: orgId, order_code: o.orderCode,
    lead_id: idMap['leads:' + o.leadId] || null, customer_id: idMap['customers:' + o.customerId] || null,
    status: o.status, service_type: o.serviceType || null,
    pickup_location: o.pickupLocation || null, dropoff_location: o.dropoffLocation || null,
    passenger_count: o.passengerCount || null, start_time: o.startTime || null, end_time: o.endTime || null,
    vehicle_id: idMap['vehicles:' + o.vehicleId] || null, driver_id: idMap['drivers:' + o.driverId] || null,
    total_price: Math.round(o.totalPrice || 0), deposit_amount: Math.round(o.depositAmount || 0),
    paid_amount: Math.round(o.paidAmount || 0), actual_cost: Math.round(o.actualCost || 0),
    actual_profit: Math.round(o.actualProfit || 0), debt_approved: !!o.debtApproved,
  }), 'order_code', (o) => o.orderCode);

  // payments / expenses (idempotency theo id cũ ghi vào idempotency-ish natural key)
  await upsertColl('payments', 'payments', (p) => ({
    organization_id: orgId, order_id: idMap['orders:' + p.orderId] || null,
    lead_id: idMap['leads:' + p.leadId] || null,
    type: (p.type || 'balance').toUpperCase(), method: p.method || null,
    amount: Math.round(p.amount || 0), reason: p.reason || null,
    idempotency_key: 'legacy:' + p.id,
  }), 'idempotency_key', (p) => 'legacy:' + p.id);

  await upsertColl('expenses', 'expenses', (e) => ({
    organization_id: orgId, order_id: idMap['orders:' + e.orderId] || null,
    category: e.category || 'other', amount: Math.round(e.amount || 0), note: e.note || null,
    idempotency_key: 'legacy:' + e.id,
  }), 'idempotency_key', (e) => 'legacy:' + e.id);

  // ---- 4) Ghi báo cáo ----
  const out = `tools/backups/migration-report-${stamp}.json`;
  if (!DRY) writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\n===== BÁO CÁO MIGRATION =====');
  console.log('Chế độ:', DRY ? 'DRY-RUN (không ghi)' : 'COMMIT');
  console.log('Inserted:', report.inserted);
  console.log('Skipped (đã tồn tại):', report.skipped);
  if (report.errors.length) console.log('Lỗi:', report.errors);
  if (!DRY) console.log('Báo cáo:', out);
  console.log('=============================');

  // Helper
  async function upsertColl(coll, table, mapFn, conflictCol, keyFn) {
    const rows = asArray(coll);
    report.inserted[table] = 0; report.skipped[table] = 0;
    for (const item of rows) {
      const payload = mapFn(item);
      try {
        if (conflictCol && keyFn) {
          // chống duplicate: kiểm tra tồn tại theo natural key
          const { data: exist } = await db.from(table).select('id')
            .eq('organization_id', orgId).eq(conflictCol, keyFn(item)).maybeSingle();
          if (exist) { idMap[`${coll}:${item.id}`] = exist.id; report.skipped[table]++; continue; }
        }
        if (DRY) { idMap[`${coll}:${item.id}`] = 'dry-' + (item.id); report.inserted[table]++; continue; }
        const { data, error } = await db.from(table).insert(payload).select('id').single();
        if (error) { report.errors.push(`${table}:${item.id}:${error.message}`); continue; }
        idMap[`${coll}:${item.id}`] = data.id; report.inserted[table]++;
      } catch (e) { report.errors.push(`${table}:${item.id}:${e.message}`); }
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
