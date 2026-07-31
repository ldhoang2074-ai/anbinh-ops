// lib/supabase/admin.ts — service-role client (SERVER ONLY)
// Dùng trong server command để ghi transaction (bypass RLS có kiểm soát).
// TUYỆT ĐỐI không import file này từ code chạy ở client.
import 'server-only';
import { createClient as createRawClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY hoặc NEXT_PUBLIC_SUPABASE_URL trong server env');
  }
  return createRawClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
