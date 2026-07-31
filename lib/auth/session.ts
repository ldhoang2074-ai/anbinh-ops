// lib/auth/session.ts — kiểm tra session + membership + org + role phía SERVER.
// Đây là "cửa" duy nhất quyết định ai được vào Admin.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  status: MembershipStatus;
  roleKeys: string[];
  permissions: Set<string>;
}

export class AuthError extends Error {
  code: 'NO_SESSION' | 'NOT_INVITED' | 'NOT_ACTIVE' | 'NO_ORG';
  constructor(code: AuthError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Lấy AuthContext hiện tại. Ném AuthError nếu không đủ điều kiện vào Admin.
 * Flow: session thật → membership → status ACTIVE → nạp role + permission.
 * Không tin bất cứ giá trị nào do client gửi (org/role...) — tất cả tra từ DB.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError('NO_SESSION', 'Chưa đăng nhập');

  // Dùng admin client để tra membership/role (bảng org bị RLS, tra chắc chắn từ server).
  const admin = createAdminClient();

  const { data: member } = await admin
    .from('organization_members')
    .select('organization_id, status')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!member) {
    // Chưa là thành viên: kiểm tra có invitation không để trả thông báo đúng.
    const { data: inv } = await admin
      .from('invitations')
      .select('status')
      .eq('email', user.email!)
      .maybeSingle();
    if (!inv) throw new AuthError('NOT_INVITED', 'Tài khoản chưa được An Bình cấp quyền.');
    throw new AuthError('NOT_ACTIVE', 'Lời mời chưa được kích hoạt. Liên hệ quản trị viên.');
  }

  if (member.status !== 'ACTIVE') {
    throw new AuthError('NOT_ACTIVE',
      member.status === 'SUSPENDED' ? 'Tài khoản đang bị tạm khóa.' : 'Tài khoản đã bị thu hồi quyền.');
  }

  const organizationId = member.organization_id;

  // Nạp role keys + permissions
  const { data: roleRows } = await admin
    .from('member_roles')
    .select('roles(key, role_permissions(permissions(key)))')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId);

  const roleKeys: string[] = [];
  const permissions = new Set<string>();
  for (const r of (roleRows ?? []) as any[]) {
    const role = r.roles;
    if (!role) continue;
    roleKeys.push(role.key);
    for (const rp of role.role_permissions ?? []) {
      if (rp.permissions?.key) permissions.add(rp.permissions.key);
    }
  }

  return {
    userId: user.id,
    email: user.email!,
    organizationId,
    status: member.status as MembershipStatus,
    roleKeys,
    permissions,
  };
}

/** Trả về AuthContext hoặc null (không ném) — dùng cho trang login/redirect. */
export async function getAuthOrNull(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
