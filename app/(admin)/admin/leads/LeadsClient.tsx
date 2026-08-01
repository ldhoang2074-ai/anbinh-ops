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

const statusFilters = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'LEAD_NEW', label: 'Lead mới' },
  { value: 'CONSULTING', label: 'Đang tư vấn' },
  { value: 'QUOTE_SENT', label: 'Đã gửi báo giá' },
  { value: 'WAITING_DEPOSIT', label: 'Chờ đặt cọc' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

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
  const [statusFilter, setStatusFilter] = useState('ALL');
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

  const leadSummary = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((lead) => lead.status === 'LEAD_NEW').length,
      consulting: leads.filter((lead) => lead.status === 'CONSULTING').length,
      waitingDeposit: leads.filter((lead) => lead.status === 'WAITING_DEPOSIT')
        .length,
    }),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return leads.filter((lead) => {
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) {
        return false;
      }

      if (!keyword) return true;

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
  }, [leads, search, statusFilter]);

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
      <section className="ab-lead-page" aria-labelledby="leads-heading">
        <header className="ab-lead-header">
          <div>
            <p className="ab-lead-eyebrow">Quản lý khách hàng</p>
            <h1 id="leads-heading" className="ab-h1">
              Khách hàng &amp; Lead
            </h1>
            <p className="ab-sub">
              Theo dõi khách hàng tiềm năng và tiến trình tư vấn.
            </p>
          </div>

          <button
            type="button"
            className="ab-btn primary ab-lead-create"
            onClick={() => setModalOpen(true)}
          >
            <span aria-hidden="true">＋</span>
            Tạo Lead mới
          </button>
        </header>

        <div className="ab-lead-summary" aria-label="Tổng quan Lead">
          <div className="ab-lead-summary-card">
            <span>Tổng Lead</span>
            <strong>{leadSummary.total}</strong>
          </div>
          <div className="ab-lead-summary-card">
            <span>Lead mới</span>
            <strong>{leadSummary.new}</strong>
          </div>
          <div className="ab-lead-summary-card">
            <span>Đang tư vấn</span>
            <strong>{leadSummary.consulting}</strong>
          </div>
          <div className="ab-lead-summary-card">
            <span>Chờ đặt cọc</span>
            <strong>{leadSummary.waitingDeposit}</strong>
          </div>
        </div>

        <div className="ab-lead-toolbar">
          <label className="ab-lead-search">
            <span className="sr-only">Tìm kiếm Lead</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên khách, số điện thoại hoặc tuyến..."
            />
          </label>

          <div className="ab-lead-filterbar" aria-label="Lọc trạng thái Lead">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`ab-lead-filter${
                  statusFilter === filter.value ? ' on' : ''
                }`}
                aria-pressed={statusFilter === filter.value}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="ab-alert danger ab-lead-alert" role="alert">
            {error}
          </div>
        )}

        <div className="ab-card ab-lead-table-card">
          <div className="ab-lead-table-head">
            <div>
              <h2>Danh sách Lead</h2>
              <p>{filteredLeads.length} Lead đang hiển thị</p>
            </div>
          </div>

          {loading ? (
            <div className="ab-empty ab-lead-state">Đang tải dữ liệu Lead…</div>
          ) : (
            <div className="ab-table-wrap">
              <table className="ab-table ab-lead-table">
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
                        <td className="ab-lead-customer">
                          <b>{customer?.name || 'Không rõ'}</b>
                          <div>
                            {customer?.phone || '—'}
                          </div>
                        </td>

                        <td className="ab-lead-route">
                          <span>{lead.pickup_location || '—'}</span>
                          <span aria-hidden="true">→</span>
                          <span>{lead.dropoff_location || '—'}</span>
                        </td>

                        <td>{lead.service_type || '—'}</td>
                        <td>{lead.source || '—'}</td>
                        <td>{money(lead.estimated_price)}</td>

                        <td>
                          <span
                            className={`ab-badge st-${lead.status}`}
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
                        {search || statusFilter !== 'ALL'
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
      </section>

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
