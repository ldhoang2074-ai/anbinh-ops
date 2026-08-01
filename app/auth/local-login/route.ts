import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LOCAL_EMAIL = 'local-admin@anbinh.test';

function isAllowedLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  if (
    process.env.NODE_ENV !== 'development' ||
    !isAllowedLocalHost(request.nextUrl.hostname)
  ) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        'Đăng nhập local không được phép.',
      )}`,
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        'Thiếu cấu hình Supabase local.',
      )}`,
    );
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: usersData, error: usersError } =
    await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (usersError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(usersError.message)}`,
    );
  }

  const localUser = usersData.users.find(
    (user) => user.email?.toLowerCase() === LOCAL_EMAIL,
  );

  if (!localUser) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        'Không tìm thấy tài khoản quản trị local.',
      )}`,
    );
  }

  const temporaryPassword = `Local-${randomUUID()}`;

  const { error: updateError } =
    await admin.auth.admin.updateUserById(localUser.id, {
      password: temporaryPassword,
      email_confirm: true,
    });

  if (updateError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(updateError.message)}`,
    );
  }

  const supabase = await createClient();

  const { error: signInError } =
    await supabase.auth.signInWithPassword({
      email: LOCAL_EMAIL,
      password: temporaryPassword,
    });

  if (signInError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(signInError.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/admin`, {
    status: 303,
  });
}