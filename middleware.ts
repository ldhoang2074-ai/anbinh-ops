// middleware.ts — refresh session + chặn thô route /admin khi chưa có session.
// Kiểm tra chi tiết (membership/permission) làm ở layout server + mỗi command.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith('/admin');
  const isLogin = pathname.startsWith('/login') || pathname.startsWith('/auth');

  // Chưa đăng nhập mà vào /admin → về /login
  if (isAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Trang Admin không được cache (chống xem lại nội dung bằng nút Back sau khi logout)
  if (isAdmin) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
  }

  // Đã đăng nhập mà vào /login → để layout quyết định (có thể chưa được cấp quyền)
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/auth/:path*'],
};
