// lib/supabase/client.ts — browser client (publishable/anon key)
// CHỈ dùng cho đọc dữ liệu (RLS bảo vệ). Không bao giờ nhúng service role key ở đây.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
