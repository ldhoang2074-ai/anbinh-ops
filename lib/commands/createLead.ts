// lib/commands/createLead.ts
import 'server-only';
import { z } from 'zod';
import { type CommandDef, writeAudit } from './base';

const schema = z.object({
  name: z.string().min(1, 'Thiếu tên khách'),
  phone: z.string().min(6, 'Số điện thoại không hợp lệ'),
  email: z.string().email().optional().or(z.literal('')),
  serviceType: z.string().optional(),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  passengerCount: z.number().int().min(0).optional(),
  estimatedPrice: z.number().int().min(0).default(0),
  source: z.string().optional(),
});
type Input = z.infer<typeof schema>;

export const createLead: CommandDef<Input> = {
  name: 'create_lead',
  permission: 'lead.create',
  schema,
  async run(input, ctx) {
    const org = ctx.auth.organizationId;
    // upsert customer theo (org, phone)
    const { data: cust, error: cErr } = await ctx.db
      .from('customers')
      .upsert(
        { organization_id: org, name: input.name, phone: input.phone, email: input.email || null,
          created_by: ctx.auth.userId, updated_by: ctx.auth.userId },
        { onConflict: 'organization_id,phone', ignoreDuplicates: false }
      )
      .select()
      .single();
    if (cErr) throw new Error(cErr.message);

    const { data: lead, error: lErr } = await ctx.db
      .from('leads')
      .insert({
        organization_id: org,
        customer_id: cust.id,
        status: 'LEAD_NEW',
        service_type: input.serviceType ?? null,
        pickup_location: input.pickupLocation ?? null,
        dropoff_location: input.dropoffLocation ?? null,
        passenger_count: input.passengerCount ?? null,
        estimated_price: input.estimatedPrice,
        source: input.source ?? null,
        assigned_staff: ctx.auth.userId, // Sales tạo → tự phụ trách (RLS read_assigned)
        created_by: ctx.auth.userId,
        updated_by: ctx.auth.userId,
      })
      .select()
      .single();
    if (lErr) throw new Error(lErr.message);

    await writeAudit(ctx, 'CREATE', 'lead', lead.id, null, lead);
    return { leadId: lead.id, customerId: cust.id, status: lead.status };
  },
};
