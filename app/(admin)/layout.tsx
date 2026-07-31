// app/(admin)/layout.tsx — GUARD server-side cho toàn bộ Admin.
// Kiểm tra session + membership ACTIVE + org + nạp permission TRƯỚC khi render.
// User SUSPENDED/REVOKED/chưa mời sẽ bị đẩy về /login (kể cả khi còn cookie session).
import { redirect } from 'next/navigation';
import { requireAuth, AuthError } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : 'Không thể xác thực.';
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  return (
    <div data-org={ctx.organizationId} data-roles={ctx.roleKeys.join(',')}>
      {/* Shell SaaS (sidebar/topbar) sẽ được gắn ở đây — tái dùng giao diện hiện có.
          ctx.permissions dùng để ẩn/hiện menu (chỉ là UX; bảo mật thật ở server + RLS). */}
      {children}
    </div>
  );
}
