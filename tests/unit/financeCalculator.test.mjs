// tests/unit/financeCalculator.test.mjs — node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeQuoteTotals, recomputeOrderFinance } from '../../lib/core/financeCalculator.mjs';

test('computeQuoteTotals cộng phụ phí, trừ giảm giá + chi phí', () => {
  const r = computeQuoteTotals({ basePrice: 800000, tollFee: 20000, surcharge: 10000, discount: 30000, estimatedCost: 500000 });
  assert.equal(r.totalPrice, 800000 + 20000 + 10000 - 30000); // 800000
  assert.equal(r.estimatedProfit, 800000 - 500000);            // 300000
});

test('recompute: cộng payment, trừ refund, tính còn lại/lợi nhuận', () => {
  const order = { totalPrice: 800000 };
  const payments = [
    { type: 'DEPOSIT', amount: 240000 },
    { type: 'BALANCE', amount: 560000 },
    { type: 'REFUND', amount: 100000 },
  ];
  const expenses = [{ amount: 520000 }];
  const r = recomputeOrderFinance(order, payments, expenses);
  assert.equal(r.paidAmount, 240000 + 560000 - 100000); // 700000
  assert.equal(r.remainingAmount, 800000 - 700000);     // 100000
  assert.equal(r.actualCost, 520000);
  assert.equal(r.actualProfit, 800000 - 520000);        // 280000
});

test('recompute bỏ qua bản ghi voided', () => {
  const order = { totalPrice: 500000 };
  const payments = [{ type: 'BALANCE', amount: 500000, voided: true }, { type: 'BALANCE', amount: 200000 }];
  const r = recomputeOrderFinance(order, payments, []);
  assert.equal(r.paidAmount, 200000);
  assert.equal(r.remainingAmount, 300000);
});

test('remaining không âm khi thu quá', () => {
  const r = recomputeOrderFinance({ totalPrice: 100000 }, [{ type: 'BALANCE', amount: 150000 }], []);
  assert.equal(r.remainingAmount, 0);
});
