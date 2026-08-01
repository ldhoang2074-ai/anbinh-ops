'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LeadRepository } from '@/lib/repositories';

type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

type LeadDetail = {
  id: string;
  status: string;
  service_type: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  passenger_count: number | null;
  estimated_price: number | null;
  source: string | null;
  created_at: string;
  customer: CustomerSummary | CustomerSummary[] | null;
};

const statusLabels: Record<string, string> = {
  LEAD_NEW: 'Lead mới',
  CONSULTING: 'Đang tư vấn',
  QUOTE_SENT: 'Đã gửi báo giá',
  WAITING_DEPOSIT: 'Chờ đặt cọc',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

function getCustomer(lead: LeadDetail): CustomerSummary | null {
  if (Array.isArray(lead.customer)) {
    return lead.customer[0] ?? null;
  }

  return lead.customer;
}

function money(value: number | null): string {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value ?? 0))}đ`;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function LeadDetailClient({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await LeadRepository.get(leadId);
      setLead(data as unknown as LeadDetail);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải chi tiết Lead.',
      );
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  async function startConsulting() {
    setProcessing(true);
    setError('');

    try {
      await LeadRepository.transition(leadId, 'CONSULTING');
      await loadLead();
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : 'Không thể bắt đầu tư vấn cho Lead này.',
      );
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <div className="ab-empty">Đang tải chi tiết Lead…</div>;
  }

  if (!lead) {
    return (
      <>
        <Link className="ab-btn" href="/admin/leads">
          ← Danh sách Lead
        </Link>

        <div
          className="ab-card"
          style={{ borderColor: '#FCA5A5', color: '#B91C1C', marginTop: 16 }}
        >
          {error || 'Không tìm thấy Lead.'}
        </div>
      </>
    );
  }

  const customer = getCustomer(lead);

  return (
    <>
      <div className="ab-row between" style={{ marginBottom: 20 }}>
        <div>
          <div className="ab-h1">Chi tiết Lead</div>
          <div className="ab-sub">Theo dõi thông tin và tiến trình tư vấn.</div>
        </div>

        <Link className="ab-btn" href="/admin/leads">
          ← Danh sách Lead
        </Link>
      </div>

      {error && (
        <div
          className="ab-card"
          style={{ borderColor: '#FCA5A5', color: '#B91C1C', marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      <div className="ab-detail-grid">
        <section className="ab-card">
          <div className="ab-card-hd">
            <h3>Thông tin khách hàng</h3>
            <span className={`ab-badge st-${lead.status}`}>
              {statusLabels[lead.status] ?? lead.status}
            </span>
          </div>

          <div className="ab-kv">
            <b>Tên khách hàng</b>
            <span>{customer?.name || 'Không rõ'}</span>
          </div>
          <div className="ab-kv">
            <b>Số điện thoại</b>
            <span>{customer?.phone || '—'}</span>
          </div>
          <div className="ab-kv">
            <b>Dịch vụ</b>
            <span>{lead.service_type || '—'}</span>
          </div>
          <div className="ab-kv">
            <b>Điểm đón → điểm trả</b>
            <span>
              {lead.pickup_location || '—'} → {lead.dropoff_location || '—'}
            </span>
          </div>
          <div className="ab-kv">
            <b>Số người</b>
            <span>{lead.passenger_count ?? '—'}</span>
          </div>
          <div className="ab-kv">
            <b>Nguồn khách</b>
            <span>{lead.source || '—'}</span>
          </div>
          <div className="ab-kv">
            <b>Giá dự kiến</b>
            <span>{money(lead.estimated_price)}</span>
          </div>
          <div className="ab-kv">
            <b>Thời gian tạo</b>
            <span>{dateTime(lead.created_at)}</span>
          </div>
        </section>

        <aside className="ab-card">
          <h3>Thao tác</h3>

          <div className="ab-sub" style={{ marginBottom: 16 }}>
            Trạng thái hiện tại: {statusLabels[lead.status] ?? lead.status}.
          </div>

          {lead.status === 'LEAD_NEW' ? (
            <button
              type="button"
              className="ab-btn primary"
              onClick={startConsulting}
              disabled={processing}
            >
              {processing ? 'Đang bắt đầu tư vấn…' : 'Bắt đầu tư vấn'}
            </button>
          ) : (
            <span className={`ab-badge st-${lead.status}`}>
              {statusLabels[lead.status] ?? lead.status}
            </span>
          )}
        </aside>
      </div>
    </>
  );
}
