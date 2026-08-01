// lib/repositories/index.ts — Repository layer.
// UI CHỈ gọi repository, không gọi Supabase rải rác.
//  - READ đi qua Supabase client (RLS lọc dữ liệu theo quyền).
//  - WRITE đi qua server command (POST /api/commands/*), KHÔNG ghi trực tiếp.
// Đổi backend => chỉ thay file này, UI không đổi.
import { createClient } from '@/lib/supabase/client';

async function runCommand(name: string, input: unknown, idempotencyKey?: string) {
  const res = await fetch(`/api/commands/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify(input ?? {}),
  });

  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || 'Lỗi thao tác');
  }

  return json.data;
}

const leadSelect = `
  *,
  customer:customers (
    id,
    name,
    phone,
    email
  )
`;

export const LeadRepository = {
  async list() {
    const sb = createClient();

    const { data, error } = await sb
      .from('leads')
      .select(leadSelect)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  async get(id: string) {
    const sb = createClient();

    const { data, error } = await sb
      .from('leads')
      .select(leadSelect)
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  create: (input: unknown) => runCommand('create_lead', input),

  transition: (leadId: string, to: string, reason?: string) =>
    runCommand('lead_transition', { leadId, to, reason }),
};

export const OrderRepository = {
  async list() {
    const sb = createClient();

    const { data, error } = await sb
      .from('orders')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  async get(id: string) {
    const sb = createClient();

    const { data, error } = await sb
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  // transition/create đi qua command (Slice 2)
  transition: (orderId: string, to: string, reason?: string) =>
    runCommand('order_transition', { orderId, to, reason }),
};

export const DispatchRepository = {
  assign: (
    orderId: string,
    vehicleId: string,
    driverId: string,
    reason?: string,
  ) =>
    runCommand('assign_vehicle_driver', {
      orderId,
      vehicleId,
      driverId,
      reason,
    }),
};

export const QuoteRepository = {
  create: (input: unknown) => runCommand('create_quote', input),
  send: (leadId: string) => runCommand('send_quote', { leadId }),
};

export const FinanceRepository = {
  recordPayment: (
    input: {
      orderId: string;
      amount: number;
      type?: string;
      method?: string;
      reason?: string;
    },
    idempotencyKey: string,
  ) => runCommand('record_payment', input, idempotencyKey),

  recordExpense: (
    input: {
      orderId: string;
      amount: number;
      category: string;
      note?: string;
    },
    idempotencyKey: string,
  ) => runCommand('record_expense', input, idempotencyKey),

  async list(table: 'payments' | 'expenses', orderId: string) {
    const sb = createClient();

    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq('order_id', orderId);

    if (error) {
      throw error;
    }

    return data;
  },
};

export const AuditRepository = {
  async list(limit = 100) {
    const sb = createClient();

    const { data, error } = await sb
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  },
};

export const TrafficRepository = {
  async list(sinceDays = 30) {
    const sb = createClient();
    const since = new Date(Date.now() - sinceDays * 86400000).toISOString();

    const { data, error } = await sb
      .from('traffic_events')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },
};