// app/auth/logout/route.ts — logout thật (xóa session Supabase + cookie).
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
