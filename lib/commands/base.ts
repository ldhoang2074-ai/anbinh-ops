// lib/commands/base.ts — khung chạy server command.
// Mỗi command đi qua đủ 10 bước: session → membership ACTIVE → org →
// permission → validate → transaction → history → audit → lỗi an toàn → idempotency.
import 'server-only';
import { z } from 'zod';
import { requireAuth, type AuthContext } from '@/lib/auth/session';
import { requirePerm, ForbiddenError } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export interface CommandCtx {
  auth: AuthContext;
  db: ReturnType<typeof createAdminClient>;
  requestId: string;
}

export interface CommandResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  code?: string;
}

export interface CommandDef<I> {
  name: string;
  permission: string;             // quyền bắt buộc
  schema: z.ZodType<I, z.ZodTypeDef, any>;           // validate input phía server
  idempotent?: boolean;          // dùng idempotency_key nếu true
  run: (input: I, ctx: CommandCtx) => Promise<unknown>;
}

/** Ghi audit event (append-only). Gọi bên trong command sau khi ghi dữ liệu. */
export async function writeAudit(
  ctx: CommandCtx,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown
) {
  await ctx.db.from('audit_events').insert({
    organization_id: ctx.auth.organizationId,
    actor_id: ctx.auth.userId,
    actor_role: ctx.auth.roleKeys[0] ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_data: before ?? null,
    after_data: after ?? null,
    request_id: ctx.requestId,
  });
}

export async function execute<I>(
  def: CommandDef<I>,
  rawInput: unknown,
  opts: { idempotencyKey?: string } = {}
): Promise<CommandResult> {
  try {
    // 1) session + 2) membership ACTIVE + 3) org (đều nằm trong requireAuth)
    const auth = await requireAuth();
    // 4) permission
    requirePerm(auth, def.permission);
    // 5) validate
    const parsed = def.schema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, code: 'VALIDATION', error: parsed.error.issues.map(i => i.message).join('; ') };
    }
    const db = createAdminClient();
    const requestId = crypto.randomUUID();
    const ctx: CommandCtx = { auth, db, requestId };

    // 10) idempotency (trả lại response cũ nếu key đã dùng)
    if (def.idempotent && opts.idempotencyKey) {
      const { data: existing } = await db
        .from('idempotency_keys')
        .select('response')
        .eq('key', opts.idempotencyKey)
        .maybeSingle();
      if (existing) return { ok: true, data: existing.response };
    }

    // 6-8) transaction + history + audit nằm trong def.run (dùng RPC/nhiều bước)
    const data = await def.run(parsed.data, ctx);

    if (def.idempotent && opts.idempotencyKey) {
      await db.from('idempotency_keys').insert({
        key: opts.idempotencyKey,
        organization_id: auth.organizationId,
        command: def.name,
        response: data ?? null,
      }).select().maybeSingle();
    }

    return { ok: true, data };
  } catch (e: any) {
    // 9) lỗi an toàn — không lộ chi tiết nội bộ
    if (e instanceof ForbiddenError) return { ok: false, code: 'FORBIDDEN', error: e.message };
    if (e?.code === 'NO_SESSION') return { ok: false, code: 'NO_SESSION', error: 'Chưa đăng nhập' };
    const msg = typeof e?.message === 'string' ? e.message : 'Lỗi hệ thống';
    // Chặn double-assign do exclusion constraint (23P01) → thông báo thân thiện
    if (e?.code === '23P01') return { ok: false, code: 'CONFLICT', error: 'Xe hoặc tài xế đã được gán cho chuyến khác trùng khung giờ' };
    return { ok: false, code: 'ERROR', error: msg };
  }
}
