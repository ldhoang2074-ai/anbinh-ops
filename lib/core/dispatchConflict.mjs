// ============================================================
//  core/dispatchConflict.mjs — server-side, thuần logic
//  Kiểm tra điều kiện gán xe/tài xế + phát hiện trùng lịch.
//  Ràng buộc cứng vẫn ở DB (exclusion constraint 0008); hàm này
//  cho phản hồi thân thiện TRƯỚC khi ghi.
// ============================================================

// Hai khoảng [s,e) giao nhau ⇔ new_start < existing_end AND new_end > existing_start
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

function isExpired(dateStr, ref = new Date()) {
  if (!dateStr) return false; // không có hạn => coi như không chặn
  return new Date(dateStr).getTime() < ref.getTime();
}

/**
 * @param params {
 *   vehicle {status, registrationExpiry, insuranceExpiry, plate},
 *   driver  {status, licenseExpiry, name},
 *   window  {startTime, endTime},
 *   existingAssignments [{vehicleId, driverId, startTime, endTime, orderId}],
 *   vehicleId, driverId, now?
 * }
 */
export function checkAssignment(params) {
  const { vehicle, driver, window: w, existingAssignments = [], vehicleId, driverId } = params;
  const now = params.now ? new Date(params.now) : new Date();

  if (!w || !w.startTime || !w.endTime) return { ok: false, reason: 'Thiếu khung giờ chuyến' };
  if (new Date(w.endTime) <= new Date(w.startTime)) return { ok: false, reason: 'Thời gian kết thúc phải sau thời gian bắt đầu' };

  // Điều kiện xe
  if (!vehicle) return { ok: false, reason: 'Không tìm thấy xe' };
  if (vehicle.status === 'MAINTENANCE') return { ok: false, reason: 'Xe đang bảo dưỡng, không thể gán' };
  if (vehicle.status === 'INACTIVE') return { ok: false, reason: 'Xe đã ngừng hoạt động' };
  if (isExpired(vehicle.registrationExpiry, now)) return { ok: false, reason: 'Xe đã hết hạn đăng kiểm' };
  if (isExpired(vehicle.insuranceExpiry, now)) return { ok: false, reason: 'Xe đã hết hạn bảo hiểm' };

  // Điều kiện tài xế
  if (!driver) return { ok: false, reason: 'Không tìm thấy tài xế' };
  if (driver.status === 'INACTIVE') return { ok: false, reason: 'Tài xế đã ngừng hoạt động' };
  if (isExpired(driver.licenseExpiry, now)) return { ok: false, reason: 'Bằng lái tài xế đã hết hạn' };

  // Trùng lịch
  for (const a of existingAssignments) {
    if (!overlaps(w.startTime, w.endTime, a.startTime, a.endTime)) continue;
    if (a.vehicleId === vehicleId)
      return { ok: false, reason: `Xe "${vehicle.plate || vehicleId}" đã được gán cho chuyến khác trùng khung giờ (đơn ${a.orderId})` };
    if (a.driverId === driverId)
      return { ok: false, reason: `Tài xế "${driver.name || driverId}" đã được gán cho chuyến khác trùng khung giờ (đơn ${a.orderId})` };
  }
  return { ok: true };
}
