// lib/commands/assignVehicleDriver.ts — điều phối: kiểm tra điều kiện + chống trùng lịch.
// Lớp phòng thủ kép: check ở app (thân thiện) + exclusion constraint ở DB (chắc chắn).
import 'server-only';
import { z } from 'zod';
import { type CommandDef, writeAudit } from './base';
import { checkAssignment } from '@/lib/core/dispatchConflict.mjs';

const schema = z.object({
  orderId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  reason: z.string().optional(),
});
type Input = z.infer<typeof schema>;

export const assignVehicleDriver: CommandDef<Input> = {
  name: 'assign_vehicle_driver',
  permission: 'dispatch.assign',
  schema,
  async run(input, ctx) {
    const org = ctx.auth.organizationId;
    const { data: order } = await ctx.db.from('orders')
      .select('*').eq('id', input.orderId).eq('organization_id', org).single();
    if (!order) throw new Error('Không tìm thấy đơn');
    if (order.status !== 'WAITING_ASSIGNMENT')
      throw new Error('Chỉ gán được đơn ở trạng thái Chờ điều xe');

    const [{ data: vehicle }, { data: driver }] = await Promise.all([
      ctx.db.from('vehicles').select('*').eq('id', input.vehicleId).eq('organization_id', org).single(),
      ctx.db.from('drivers').select('*').eq('id', input.driverId).eq('organization_id', org).single(),
    ]);

    // Lịch đang ACTIVE giao nhau khung giờ đơn (chỉ để báo lỗi thân thiện)
    const { data: existing } = await ctx.db.from('assignments')
      .select('vehicle_id,driver_id,start_time,end_time,order_id')
      .eq('organization_id', org).eq('status', 'ACTIVE').is('deleted_at', null);

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

    // Ghi assignment — nếu 2 điều phối viên chạy song song, exclusion constraint (23P01)
    // sẽ chặn cái thứ hai; base.execute map thành lỗi CONFLICT.
    const { error: aErr } = await ctx.db.from('assignments').insert({
      organization_id: org, order_id: order.id, vehicle_id: input.vehicleId, driver_id: input.driverId,
      start_time: order.start_time, end_time: order.end_time, status: 'ACTIVE',
      created_by: ctx.auth.userId, updated_by: ctx.auth.userId,
    });
    if (aErr) throw aErr; // giữ nguyên code (23P01) để base map CONFLICT

    await ctx.db.from('orders').update({
      status: 'ASSIGNED', vehicle_id: input.vehicleId, driver_id: input.driverId, updated_by: ctx.auth.userId,
    }).eq('id', order.id);

    await ctx.db.from('order_status_history').insert({
      organization_id: org, order_id: order.id, from_status: order.status, to_status: 'ASSIGNED',
      reason: input.reason ?? 'Điều phối', created_by: ctx.auth.userId,
    });
    await writeAudit(ctx, 'ASSIGN', 'order', order.id,
      { status: order.status }, { status: 'ASSIGNED', vehicleId: input.vehicleId, driverId: input.driverId });

    return { orderId: order.id, status: 'ASSIGNED' };
  },
};
