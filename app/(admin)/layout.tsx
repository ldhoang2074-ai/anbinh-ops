import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AuthError, requireAuth } from '@/lib/auth/session';
import AdminShell from './admin/_components/AdminShell';
import './admin/admin-design.css';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let ctx;

  try {
    ctx = await requireAuth();
  } catch (error) {
    const message =
      error instanceof AuthError ? error.message : 'Không thể xác thực.';

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  return (
    <AdminShell
      email={ctx.email}
      roleLabel={ctx.roleKeys.join(', ') || 'Admin'}
    >
      {children}
    </AdminShell>
  );
}