// lib/commands/leadTransition.ts — chuyển trạng thái Lead (state machine chạy SERVER).
import 'server-only';
import { z } from 'zod';
import { type CommandDef, writeAudit } from './base';
import { canLeadTransition } from '@/lib/core/orderStateMachine.mjs';

const schema = z.object({
  leadId: z.string().uuid(),
  to: z.enum(['CONSULTING', 'QUOTE_SENT', 'WAITING_DEPOSIT', 'CONFIRMED', 'CANCELLED']),
  reason: z.string().optional(),
});
type Input = z.infer<typeof schema>;

export const leadTransition: CommandDef<Input> = {
  name: 'lead_transition',
  permission: 'lead.update',
  schema,
  async run(input, ctx) {
    const org = ctx.auth.organizationId;
    const { data: lead, error } = await ctx.db
      .from('leads').select('*').eq('id', input.leadId).eq('organization_id', org).single();
    if (error || !lead) throw new Error('Không tìm thấy Lead');

    // Tra facts từ DB (không tin client)
    const [{ count: sentQuotes }, { count: deposits }] = await Promise.all([
      ctx.db.from('quotes').select('id', { count: 'exact', head: true })
        .eq('lead_id', lead.id).neq('status', 'DRAFT'),
      ctx.db.from('payments').select('id', { count: 'exact', head: true })
        .eq('lead_id', lead.id).eq('type', 'DEPOSIT'),
    ]);

    const chk = canLeadTransition(
      { status: lead.status, id: lead.id },
      input.to,
      { hasSentQuote: (sentQuotes ?? 0) > 0, hasDeposit: (deposits ?? 0) > 0 }
    );
    if (!chk.ok) throw new Error(chk.reason);

    const patch: any = { status: input.to, updated_by: ctx.auth.userId };
    if (input.to === 'CANCELLED') patch.note = input.reason ?? lead.note;

    const { data: updated, error: uErr } = await ctx.db
      .from('leads').update(patch).eq('id', lead.id).eq('version', lead.version).select().single();
    if (uErr) throw new Error('Xung đột phiên bản, tải lại và thử lại');

    // Khi gửi báo giá: đánh dấu quote DRAFT mới nhất → SENT (giữ đúng logic đã fix ở bản localStorage)
    if (input.to === 'QUOTE_SENT') {
      const { data: q } = await ctx.db.from('quotes')
        .select('id,status,version_no').eq('lead_id', lead.id)
        .order('version_no', { ascending: false }).limit(1).maybeSingle();
      if (q && q.status === 'DRAFT') {
        await ctx.db.from('quotes').update({ status: 'SENT', updated_by: ctx.auth.userId }).eq('id', q.id);
      }
    }

    await writeAudit(ctx, 'STATUS_CHANGE', 'lead', lead.id, { status: lead.status }, { status: input.to });
    return { leadId: lead.id, status: input.to };
  },
};
