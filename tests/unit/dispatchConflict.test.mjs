// tests/unit/dispatchConflict.test.mjs — node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, checkAssignment } from '../../lib/core/dispatchConflict.mjs';

const W = { startTime: '2026-07-10T08:00:00Z', endTime: '2026-07-10T12:00:00Z' };
const okVeh = { status: 'AVAILABLE', plate: '29B-001.01' };
const okDrv = { status: 'AVAILABLE', name: 'Nguyễn A' };

test('overlaps đúng công thức', () => {
  assert.equal(overlaps('2026-07-10T08:00:00Z', '2026-07-10T12:00:00Z', '2026-07-10T11:00:00Z', '2026-07-10T13:00:00Z'), true);
  assert.equal(overlaps('2026-07-10T08:00:00Z', '2026-07-10T12:00:00Z', '2026-07-10T12:00:00Z', '2026-07-10T14:00:00Z'), false); // chạm mép
});

test('assign hợp lệ', () => {
  const r = checkAssignment({ vehicle: okVeh, driver: okDrv, window: W, existingAssignments: [], vehicleId: 'v1', driverId: 'd1' });
  assert.equal(r.ok, true);
});

test('chặn xe bảo dưỡng', () => {
  const r = checkAssignment({ vehicle: { ...okVeh, status: 'MAINTENANCE' }, driver: okDrv, window: W, existingAssignments: [], vehicleId: 'v1', driverId: 'd1' });
  assert.equal(r.ok, false);
});

test('chặn xe hết đăng kiểm', () => {
  const r = checkAssignment({ vehicle: { ...okVeh, registrationExpiry: '2020-01-01' }, driver: okDrv, window: W, existingAssignments: [], vehicleId: 'v1', driverId: 'd1' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /đăng kiểm/);
});

test('chặn bằng lái hết hạn', () => {
  const r = checkAssignment({ vehicle: okVeh, driver: { ...okDrv, licenseExpiry: '2020-01-01' }, window: W, existingAssignments: [], vehicleId: 'v1', driverId: 'd1' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /[Bb]ằng lái/);
});

test('chặn cùng xe trùng giờ', () => {
  const r = checkAssignment({ vehicle: okVeh, driver: okDrv, window: W, vehicleId: 'v1', driverId: 'd1',
    existingAssignments: [{ vehicleId: 'v1', driverId: 'dX', startTime: '2026-07-10T10:00:00Z', endTime: '2026-07-10T14:00:00Z', orderId: 'o9' }] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /trùng khung giờ/);
});

test('chặn cùng tài xế trùng giờ', () => {
  const r = checkAssignment({ vehicle: okVeh, driver: okDrv, window: W, vehicleId: 'v1', driverId: 'd1',
    existingAssignments: [{ vehicleId: 'vX', driverId: 'd1', startTime: '2026-07-10T11:00:00Z', endTime: '2026-07-10T13:00:00Z', orderId: 'o9' }] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /[Tt]ài xế/);
});

test('không trùng khi lệch giờ', () => {
  const r = checkAssignment({ vehicle: okVeh, driver: okDrv, window: W, vehicleId: 'v1', driverId: 'd1',
    existingAssignments: [{ vehicleId: 'v1', driverId: 'd1', startTime: '2026-07-10T13:00:00Z', endTime: '2026-07-10T15:00:00Z', orderId: 'o9' }] });
  assert.equal(r.ok, true);
});
