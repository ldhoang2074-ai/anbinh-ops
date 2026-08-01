'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LeadRepository } from '@/lib/repositories';

type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

type LeadRow = {
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

type LeadForm = {
  name: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType: string;
  source: string;
  passengerCount: string;
  estimatedPrice: string;
};

const emptyForm: LeadForm = {
  name: '',
  phone: '',
  pickupLocation: '',
  dropoffLocation: '',
  serviceType: 'Xe ghép',
  source: 'Nhập thủ công',
  passengerCount: '1',
  estimatedPrice: '300000',
};

const serviceOptions = [
  'Xe ghép',
  'Bao xe theo giờ',
  'Bao xe theo ngày',
  'Xe hợp đồng',
];

const sourceOptions = [
  'Website',
  'Facebook',
  'Facebook Ads',
  'TikTok',
  'Google',
  'Zalo',
  'Điện thoại',
  'Khách cũ',
  'Cộng tác viên',
  'Nhập thủ công',
  'Khác',
];

const statusLabels: Record<string, string> = {
  LEAD_NEW: 'Lead mới',
  CONSULTING: 'Đang tư vấn',
  QUOTE_SENT: 'Đã gửi báo giá',
  WAITING_DEPOSIT: 'Chờ đặt cọc',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

function getCustomer(lead: LeadRow): CustomerSummary | null {
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
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: string): string {
  if (status === 'CONFIRMED') return 'good';
  if (status === 'CANCELLED') return 'danger';
  return 'warn';
}

export default function LeadsClient({
  openCreateOnLoad,
}: {
  openCreateOnLoad: boolean;
}) {
  const router = useRouter();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(openCreateOnLoad);
  const [form, setForm] = useState<LeadForm>(emptyForm);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await LeadRepository.list();
      setLeads((data ?? []) as unknown as LeadRow[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải danh sách Lead.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (openCreateOnLoad) {
      setModalOpen(true);
    }
  }, [openCreateOnLoad]);

  const filteredLeads = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return leads;

    return leads.filter((lead) => {
      const customer = getCustomer(lead);

      return [
        customer?.name,
        customer?.phone,
        lead.pickup_location,
        lead.dropoff_location,
        lead.service_type,
        lead.source,
        statusLabels[lead.status] ?? lead.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [leads, search]);

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setForm(emptyForm);
    router.replace('/admin/leads');
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Vui lòng nhập tên khách hàng.');
      return;
    }

    if (form.phone.trim().length < 6) {
      setError('Số điện thoại không hợp lệ.');
      return;
    }

    setSaving(true);

    try {
      await LeadRepository.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: '',
        serviceType: form.serviceType,
        pickupLocation: form.pickupLocation.trim(),
        dropoffLocation: form.dropoffLocation.trim(),
        passengerCount: Number(form.passengerCount || 0),
        estimatedPrice: Number(form.estimatedPrice || 0),
        source: form.source,
      });

      setModalOpen(false);
      setForm(emptyForm);
      router.replace('/admin/leads');

      await loadLeads();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không thể tạo Lead.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="ab-h1">Khách hàng &amp; Lead</div>

      <div className="ab-sub">
        {leads.length} Lead đang được lưu trong Supabase.
      </div>

      <div className="ab-row between" style={{ marginBottom: 14 }}>
        <div className="ab-search" style={{ maxWidth: 380 }}>
          <span aria-hidden="true">⌕</span>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên khách, số điện thoại hoặc tuyến..."
          />
        </div>

        <button
          type="button"
          className="ab-btn primary"
          onClick={() => setModalOpen(true)}
        >
          ＋ Tạo Lead mới
        </button>
      </div>

      {error && (
        <div
          className="ab-card"
          style={{
            borderColor: '#FCA5A5',
            color: '#B91C1C',
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div className="ab-card">
        {loading ? (
          <div className="ab-empty">Đang tải dữ liệu Lead…</div>
        ) : (
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Tuyến</th>
                  <th>Dịch vụ</th>
                  <th>Nguồn</th>
                  <th>Giá dự kiến</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>

              <tbody>
                {filteredLeads.length ? (
                  filteredLeads.map((lead) => {
                    const customer = getCustomer(lead);

                    return (
                      <tr key={lead.id}>
                        <td>
                          <b>{customer?.name || 'Không rõ'}</b>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--muted)',
                              marginTop: 3,
                            }}
                          >
                            {customer?.phone || '—'}
                          </div>
                        </td>

                        <td>
                          {lead.pickup_location || '—'} →{' '}
                          {lead.dropoff_location || '—'}
                        </td>

                        <td>{lead.service_type || '—'}</td>
                        <td>{lead.source || '—'}</td>
                        <td>{money(lead.estimated_price)}</td>

                        <td>
                          <span
                            className={`ab-chip ${statusClass(lead.status)}`}
                          >
                            {statusLabels[lead.status] ?? lead.status}
                          </span>
                        </td>

                        <td>{dateTime(lead.created_at)}</td>

                        <td>
                          <Link
                            className="ab-btn sm"
                            href={`/admin/leads/${lead.id}`}
                          >
                            Xem →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="ab-empty">
                        {search
                          ? 'Không tìm thấy Lead phù hợp.'
                          : 'Chưa có Lead nào.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="ab-modal-ov"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="ab-modal" onSubmit={submitLead}>
            <h3>Tạo Lead mới</h3>

            <div id="abModalFields">
              <div className="ab-field">
                <label htmlFor="lead-name">Tên khách hàng *</label>
                <input
                  id="lead-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  autoFocus
                />
              </div>

              <div className="ab-field">
                <label htmlFor="lead-phone">Số điện thoại *</label>
                <input
                  id="lead-phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  inputMode="tel"
                />
              </div>

              <div className="ab-field">
                <label htmlFor="lead-pickup">Điểm đón</label>
                <input
                  id="lead-pickup"
                  value={form.pickupLocation}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      pickupLocation: event.target.value,
                    })
                  }
                />
              </div>

              <div className="ab-field">
                <label htmlFor="lead-dropoff">Điểm trả</label>
                <input
                  id="lead-dropoff"
                  value={form.dropoffLocation}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      dropoffLocation: event.target.value,
                    })
                  }
                />
              </div>

              <div className="ab-field">
                <label htmlFor="lead-service">Dịch vụ</label>
                <select
                  id="lead-service"
                  value={form.serviceType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      serviceType: event.target.value,
                    })
                  }
                >
                  {serviceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ab-field">
                <label htmlFor="lead-source">Nguồn khách</label>
                <select
                  id="lead-source"
                  value={form.source}
                  onChange={(event) =>
                    setForm({ ...form, source: event.target.value })
                  }
                >
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ab-field">
                <label htmlFor="lead-passengers">Số người</label>
                <input
                  id="lead-passengers"
                  type="number"
                  min="0"
                  value={form.passengerCount}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      passengerCount: event.target.value,
                    })
                  }
                />
              </div>

              <div className="ab-field">
                <label htmlFor="lead-price">Giá dự kiến</label>
                <input
                  id="lead-price"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.estimatedPrice}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      estimatedPrice: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="ab-modal-actions">
              <button
                type="button"
                className="ab-btn"
                onClick={closeModal}
                disabled={saving}
              >
                Hủy
              </button>

              <button
                type="submit"
                className="ab-btn primary"
                disabled={saving}
              >
                {saving ? 'Đang lưu…' : 'Lưu Lead'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
