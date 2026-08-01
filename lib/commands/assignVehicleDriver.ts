// lib/commands/assignVehicleDriver.ts — điều phối: kiểm tra điều kiện + chống trùng lịch.
// Lớp phòng thủ kép: check ở app (thân thiện) + exclusion constraint ở DB (chắc chắn).
import 'server-only';
import { z } from 'zod';
import { type CommandDef } from './base';
import { checkAssignment } from '@/lib/core/dispatchConflict.mjs';

const schema = z.object({
  orderId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  reason: z.string().optional(),
});
type Input = z.infer<typeof schema>;

const rpcErrors: Record<string, string> = {
  ORDER_NOT_FOUND: 'Không tìm thấy đơn hoặc đơn đã bị xóa.',
  ORDER_NOT_ASSIGNABLE: 'Đơn không còn ở trạng thái Chờ điều xe.',
  ORDER_INVALID_WINDOW: 'Khung giờ đơn không hợp lệ.',
  ORDER_ALREADY_ASSIGNED: 'Đơn đã được gán xe và tài xế bởi yêu cầu khác.',
  VEHICLE_NOT_FOUND: 'Không tìm thấy xe hoặc xe đã bị xóa.',
  DRIVER_NOT_FOUND: 'Không tìm thấy tài xế hoặc tài xế đã bị xóa.',
  VEHICLE_MAINTENANCE: 'Xe đang bảo dưỡng, không thể gán.',
  VEHICLE_INACTIVE: 'Xe đã ngừng hoạt động.',
  VEHICLE_REGISTRATION_EXPIRED: 'Xe đã hết hạn đăng kiểm.',
  VEHICLE_INSURANCE_EXPIRED: 'Xe đã hết hạn bảo hiểm.',
  DRIVER_INACTIVE: 'Tài xế đã ngừng hoạt động.',
  DRIVER_LICENSE_EXPIRED: 'Bằng lái tài xế đã hết hạn.',
};

function rpcErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === '23505') {
    return 'Đơn đã được gán xe và tài xế bởi yêu cầu khác.';
  }

  return rpcErrors[error.message ?? ''] ?? 'Không thể điều phối xe và tài xế.';
}

export const assignVehicleDriver: CommandDef<Input> = {
  name: 'assign_vehicle_driver',
  permission: 'dispatch.assign',
  schema,
  async run(input, ctx) {
    const org = ctx.auth.organizationId;
    const { data: order, error: orderError } = await ctx.db
      .from('orders')
      .select('*')
      .eq('id', input.orderId)
      .eq('organization_id', org)
      .is('deleted_at', null)
      .maybeSingle();

    if (orderError) {
      throw new Error('Không thể kiểm tra đơn trước khi điều phối.');
    }

    if (!order) throw new Error('Không tìm thấy đơn');
    if (order.status !== 'WAITING_ASSIGNMENT')
      throw new Error('Chỉ gán được đơn ở trạng thái Chờ điều xe');

    const [vehicleResult, driverResult] = await Promise.all([
      ctx.db
        .from('vehicles')
        .select('*')
        .eq('id', input.vehicleId)
        .eq('organization_id', org)
        .is('deleted_at', null)
        .maybeSingle(),
      ctx.db
        .from('drivers')
        .select('*')
        .eq('id', input.driverId)
        .eq('organization_id', org)
        .is('deleted_at', null)
        .maybeSingle(),
    ]);

    if (vehicleResult.error || driverResult.error) {
      throw new Error('Không thể kiểm tra xe hoặc tài xế trước khi điều phối.');
    }

    const vehicle = vehicleResult.data;
    const driver = driverResult.data;

    // Lịch đang ACTIVE giao nhau khung giờ đơn (chỉ để báo lỗi thân thiện)
    const { data: existing, error: assignmentsError } = await ctx.db
      .from('assignments')
      .select('vehicle_id,driver_id,start_time,end_time,order_id')
      .eq('organization_id', org)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null);

    if (assignmentsError) {
      throw new Error('Không thể kiểm tra lịch điều phối hiện tại.');
    }

    const chk = checkAssignment({
      vehicle: vehicle && { status: vehicle.status, registrationExpiry: vehicle.registration_expiry,
        insuranceExpiry: vehicle.insurance_expiry, plate: vehicle.plate },
      driver: driver && { status: driver.status, licenseExpiry: driver.license_expiry, name: driver.name },
      window: { startTime: order.start_time, endTime: order.end_time },
      existingAssignments: (existing ?? []).map((a: any) => ({
        vehicleId: a.vehicle_id, driverId: a.driver_id, startTime: a.start_time, endTime: a.end_time, orderId: a.order_id })),
      vehicleId: input.vehicleId,
      driverId: input.driverId,
    });
    if (!chk.ok) throw new Error(chk.reason);

    const { data, error: rpcError } = await ctx.db.rpc(
      'assign_vehicle_driver_atomic',
      {
        p_organization_id: org,
        p_order_id: order.id,
        p_vehicle_id: input.vehicleId,
        p_driver_id: input.driverId,
        p_actor_id: ctx.auth.userId,
        p_reason: input.reason ?? null,
        p_actor_role: ctx.auth.roleKeys[0] ?? null,
        p_request_id: ctx.requestId,
      },
    );

    if (rpcError) {
      if (rpcError.code === '23P01') {
        throw rpcError;
      }

      throw new Error(rpcErrorMessage(rpcError));
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.order_id || !result.status) {
      throw new Error('Không thể xác nhận kết quả điều phối.');
    }

    return { orderId: result.order_id, status: result.status };
  },
};
