// ============================================================
//  core/financeCalculator.mjs — server-side, thuần logic
//  Mọi số tiền là BIGINT (đơn vị VND, số nguyên). Không dùng float.
// ============================================================

export function computeQuoteTotals(q) {
  const total = (q.basePrice || 0) + (q.tollFee || 0) + (q.waitingFee || 0)
    + (q.overnightFee || 0) + (q.surcharge || 0) - (q.discount || 0);
  const profit = total - (q.estimatedCost || 0) - (q.affiliateCommission || 0);
  return { totalPrice: total, estimatedProfit: profit };
}

/**
 * Tính lại tài chính đơn từ danh sách payments/expenses (đã lọc voided).
 * @param order {totalPrice}
 * @param payments [{type, amount, voided}]
 * @param expenses [{amount, voided}]
 */
export function recomputeOrderFinance(order, payments = [], expenses = []) {
  const active = (x) => !x.voided;
  const paidIn = payments.filter(p => active(p) && p.type !== 'REFUND')
    .reduce((s, p) => s + (p.amount || 0), 0);
  const refunds = payments.filter(p => active(p) && p.type === 'REFUND')
    .reduce((s, p) => s + Math.abs(p.amount || 0), 0);
  const paid = paidIn - refunds;
  const cost = expenses.filter(active).reduce((s, e) => s + (e.amount || 0), 0);
  const total = order.totalPrice || 0;
  return {
    paidAmount: paid,
    remainingAmount: Math.max(total - paid, 0),
    actualCost: cost,
    actualProfit: total - cost,
  };
}
