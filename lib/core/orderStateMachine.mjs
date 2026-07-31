// ============================================================
//  core/orderStateMachine.mjs — server-side, thuần logic
//  Không phụ thuộc DB/store. Server command gọi các hàm này để
//  quyết định hợp lệ TRƯỚC khi ghi transaction. Không cho phép
//  set status trực tiếp ở bất kỳ đâu khác.
// ============================================================

export const LABELS = {
  LEAD_NEW: 'Lead mới', CONSULTING: 'Đang tư vấn', QUOTE_SENT: 'Đã gửi báo giá',
  WAITING_DEPOSIT: 'Chờ đặt cọc', CONFIRMED: 'Đã xác nhận', WAITING_ASSIGNMENT: 'Chờ điều xe',
  ASSIGNED: 'Đã gán xe', PREPARING: 'Chuẩn bị chuyến', IN_PROGRESS: 'Đang chạy',
  WAITING_SETTLEMENT: 'Chờ đối soát', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', INCIDENT: 'Sự cố',
};

export const LEAD_TRANSITIONS = {
  LEAD_NEW: ['CONSULTING', 'CANCELLED'],
  CONSULTING: ['QUOTE_SENT', 'CANCELLED'],
  QUOTE_SENT: ['WAITING_DEPOSIT', 'CONSULTING', 'CANCELLED'],
  WAITING_DEPOSIT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: [],
  CANCELLED: [],
};

export const ORDER_TRANSITIONS = {
  CONFIRMED: ['WAITING_ASSIGNMENT', 'CANCELLED'],
  WAITING_ASSIGNMENT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PREPARING', 'WAITING_ASSIGNMENT', 'CANCELLED', 'INCIDENT'],
  PREPARING: ['IN_PROGRESS', 'CANCELLED', 'INCIDENT'],
  IN_PROGRESS: ['WAITING_SETTLEMENT', 'INCIDENT'],
  WAITING_SETTLEMENT: ['COMPLETED'],
  INCIDENT: ['WAITING_ASSIGNMENT', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
  COMPLETED: [],
};

/**
 * @param {{ status: string, id?: string }} lead Lead hiện tại.
 * @param {string} to Trạng thái đích.
 * @param {{ hasSentQuote?: boolean, hasDeposit?: boolean }} [facts] Dữ kiện được tra từ server.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canLeadTransition(lead, to, facts = {}) {
  const allowed = LEAD_TRANSITIONS[lead.status] || [];
  if (allowed.indexOf(to) === -1)
    return { ok: false, reason: `Không thể chuyển Lead từ "${LABELS[lead.status] || lead.status}" sang "${LABELS[to] || to}"` };
  if (to === 'WAITING_DEPOSIT' && !facts.hasSentQuote)
    return { ok: false, reason: 'Chưa có báo giá đã gửi cho Lead này' };
  if (to === 'CONFIRMED' && !facts.hasDeposit)
    return { ok: false, reason: 'Chưa ghi nhận đặt cọc cho Lead này' };
  return { ok: true };
}

/**
 * @param {{
 *   status: string,
 *   vehicleId?: string | null,
 *   driverId?: string | null,
 *   remainingAmount?: number,
 *   debtApproved?: boolean
 * }} order Đơn hàng hiện tại.
 * @param {string} to Trạng thái đích.
 * @param {{ reason?: string }} [ctx] Thông tin bổ sung.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canOrderTransition(order, to, ctx = {}) {
  const from = order.status;
  const allowed = ORDER_TRANSITIONS[from] || [];
  if (allowed.indexOf(to) === -1)
    return { ok: false, reason: `Không thể chuyển đơn từ "${LABELS[from] || from}" sang "${LABELS[to] || to}"` };
  if (to === 'ASSIGNED' && (!order.vehicleId || !order.driverId))
    return { ok: false, reason: 'Chưa gán xe hoặc tài xế' };
  if (to === 'IN_PROGRESS' && (!order.vehicleId || !order.driverId))
    return { ok: false, reason: 'Chuyến chưa được gán xe và tài xế' };
  if (to === 'COMPLETED') {
    const remaining = order.remainingAmount || 0;
    if (remaining !== 0 && !order.debtApproved)
      return { ok: false, reason: `Còn công nợ ${remaining.toLocaleString('vi-VN')}đ chưa thu và chưa được duyệt ghi nợ` };
  }
  if ((to === 'INCIDENT' || to === 'CANCELLED') && !ctx.reason)
    return { ok: false, reason: 'Bắt buộc nhập lý do' };
  return { ok: true };
}

export function nextOrderStates(order) { return ORDER_TRANSITIONS[order.status] || []; }
export function nextLeadStates(lead) { return LEAD_TRANSITIONS[lead.status] || []; }
