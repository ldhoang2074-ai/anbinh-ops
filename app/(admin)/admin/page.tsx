// app/(admin)/admin/page.tsx — điểm vào Admin (placeholder Slice 1).
// Slice 2+ sẽ render dashboard SaaS đầy đủ (tái dùng UI từ web-anbinh-flat/admin).
import { requireAuth } from '@/lib/auth/session';

export default async function AdminHome() {
  const ctx = await requireAuth();
  return (
    <main style={{ padding: 40, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, color: '#17201B' }}>Admin Vận Hành — An Bình</h1>
      <p style={{ color: '#66736B', fontSize: 14 }}>
        Đăng nhập thành công với <b>{ctx.email}</b>.
      </p>
      <div style={{ background: '#fff', border: '1px solid #E5EAE7', borderRadius: 14, padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 13, color: '#66736B' }}>Tổ chức</div>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{ctx.organizationId}</div>
        <div style={{ fontSize: 13, color: '#66736B' }}>Vai trò</div>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{ctx.roleKeys.join(', ') || '—'}</div>
        <div style={{ fontSize: 13, color: '#66736B' }}>Số quyền</div>
        <div style={{ fontWeight: 700 }}>{ctx.permissions.size}</div>
      </div>
      <form action="/auth/logout" method="post" style={{ marginTop: 20 }}>
        <button style={{ background: '#fff', border: '1px solid #E5EAE7', borderRadius: 10,
          padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>Đăng xuất</button>
      </form>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 24 }}>
        Slice 1 (Auth + Org + RBAC + RLS). Giao diện SaaS đầy đủ được gắn ở Slice 2+.
      </p>
    </main>
  );
}
