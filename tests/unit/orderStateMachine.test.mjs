// tests/unit/orderStateMachine.test.mjs — node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canLeadTransition, canOrderTransition, nextOrderStates,
} from '../../lib/core/orderStateMachine.mjs';

test('lead: LEAD_NEW → CONSULTING hợp lệ', () => {
  assert.equal(canLeadTransition({ status: 'LEAD_NEW' }, 'CONSULTING').ok, true);
});

test('lead: LEAD_NEW → CONFIRMED bị chặn (không trong bảng)', () => {
  assert.equal(canLeadTransition({ status: 'LEAD_NEW' }, 'CONFIRMED').ok, false);
});

test('lead: QUOTE_SENT → WAITING_DEPOSIT cần có báo giá đã gửi', () => {
  assert.equal(canLeadTransition({ status: 'QUOTE_SENT' }, 'WAITING_DEPOSIT', { hasSentQuote: false }).ok, false);
  assert.equal(canLeadTransition({ status: 'QUOTE_SENT' }, 'WAITING_DEPOSIT', { hasSentQuote: true }).ok, true);
});

test('lead: WAITING_DEPOSIT → CONFIRMED cần có đặt cọc', () => {
  assert.equal(canLeadTransition({ status: 'WAITING_DEPOSIT' }, 'CONFIRMED', { hasDeposit: false }).ok, false);
  assert.equal(canLeadTransition({ status: 'WAITING_DEPOSIT' }, 'CONFIRMED', { hasDeposit: true }).ok, true);
});

test('order: ASSIGNED cần xe + tài xế', () => {
  assert.equal(canOrderTransition({ status: 'WAITING_ASSIGNMENT' }, 'ASSIGNED').ok, false);
  assert.equal(canOrderTransition({ status: 'WAITING_ASSIGNMENT', vehicleId: 'v', driverId: 'd' }, 'ASSIGNED').ok, true);
});

test('order: COMPLETED bị chặn khi còn nợ chưa duyệt', () => {
  assert.equal(canOrderTransition({ status: 'WAITING_SETTLEMENT', remainingAmount: 100000 }, 'COMPLETED').ok, false);
  assert.equal(canOrderTransition({ status: 'WAITING_SETTLEMENT', remainingAmount: 100000, debtApproved: true }, 'COMPLETED').ok, true);
  assert.equal(canOrderTransition({ status: 'WAITING_SETTLEMENT', remainingAmount: 0 }, 'COMPLETED').ok, true);
});

test('order: CANCELLED/INCIDENT bắt buộc lý do', () => {
  assert.equal(canOrderTransition({ status: 'ASSIGNED' }, 'CANCELLED').ok, false);
  assert.equal(canOrderTransition({ status: 'ASSIGNED' }, 'CANCELLED', { reason: 'khách hủy' }).ok, true);
});

test('order: chuyển trái phép bị chặn (COMPLETED → IN_PROGRESS)', () => {
  assert.equal(canOrderTransition({ status: 'COMPLETED' }, 'IN_PROGRESS').ok, false);
  assert.deepEqual(nextOrderStates({ status: 'COMPLETED' }), []);
});
