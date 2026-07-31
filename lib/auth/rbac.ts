// lib/auth/rbac.ts — helper kiểm tra quyền (dùng chung server command + guard).
import type { AuthContext } from './session';

export class ForbiddenError extends Error {
  code = 'FORBIDDEN' as const;
  constructor(message = 'Không có quyền thực hiện thao tác này') {
    super(message);
  }
}

export function has(ctx: AuthContext, permission: string): boolean {
  return ctx.permissions.has(permission);
}

export function hasAny(ctx: AuthContext, permissions: string[]): boolean {
  return permissions.some((p) => ctx.permissions.has(p));
}

/** Ném ForbiddenError nếu thiếu quyền. Gọi trong mọi server command. */
export function requirePerm(ctx: AuthContext, permission: string): void {
  if (!ctx.permissions.has(permission)) {
    throw new ForbiddenError(`Thiếu quyền: ${permission}`);
  }
}
