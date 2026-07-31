// app/auth/callback/route.ts — OAuth callback: đổi code lấy session thật,
// rồi kiểm tra membership. Nếu chưa được mời → về /login với thông báo.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthOrNull } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/admin';
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Thiếu mã xác thực.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Đăng nhập Google thất bại.')}`);
  }

  // Có session → kiểm tra membership. Chưa được mời/không ACTIVE thì đăng xuất + báo.
  const ctx = await getAuthOrNull();
  if (!ctx) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Tài khoản chưa được An Bình cấp quyền.')}`
    );
  }

  return NextResponse.redirect(`${origin}${safeNext(next)}`);
}

// Chống open redirect: chỉ chấp nhận path nội bộ bắt đầu bằng một '/'
// và KHÔNG phải '//' hay '/\' (protocol-relative → domain ngoài).
function safeNext(next: string): string {
  if (typeof next !== 'string') return '/admin';
  if (!next.startsWith('/')) return '/admin';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/admin';
  if (!next.startsWith('/admin')) return '/admin';
  return next;
}
