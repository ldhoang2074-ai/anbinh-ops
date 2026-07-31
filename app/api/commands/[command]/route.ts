// app/api/commands/[command]/route.ts — endpoint duy nhất chạy server command.
// Frontend KHÔNG bao giờ ghi trực tiếp status/tài chính — chỉ gọi command tại đây.
import { NextResponse, type NextRequest } from 'next/server';
import { COMMANDS, execute } from '@/lib/commands';

export async function POST(req: NextRequest, { params }: { params: { command: string } }) {
  const def = COMMANDS[params.command];
  if (!def) return NextResponse.json({ ok: false, error: 'Command không tồn tại' }, { status: 404 });

  let body: unknown = {};
  try { body = await req.json(); } catch { /* body rỗng */ }

  const idempotencyKey = req.headers.get('x-idempotency-key') || undefined;
  const result = await execute(def, body, { idempotencyKey });

  const status = result.ok ? 200
    : result.code === 'NO_SESSION' ? 401
    : result.code === 'FORBIDDEN' ? 403
    : result.code === 'VALIDATION' ? 422
    : result.code === 'CONFLICT' ? 409
    : 400;
  return NextResponse.json(result, { status });
}
