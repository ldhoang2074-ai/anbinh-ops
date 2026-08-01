'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OrderRepository } from '@/lib/repositories';

type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
};

type VehicleSummary = {
  id: string;
  plate: string;
  model: string | null;
};

type DriverSummary = {
  id: string;
  name: string;
  phone: string | null;
};

type Relation<T> = T | T[] | null;

type OrderRow = {
  id: string;
  order_code: string;
  customer_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  status: string;
  service_type: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  start_time: string | null;
  end_time: string | null;
  total_price: number | null;
  remaining_amount: number | null;
  created_at: string;
  customer: Relation<CustomerSummary>;
  vehicle: Relation<VehicleSummary>;
  driver: Relation<DriverSummary>;
};

const statusLabels: Record<string, string> = {
  WAITING_ASSIGNMENT: 'Chờ điều xe',
  ASSIGNED: 'Đã gán xe',
  PREPARING: 'Chuẩn bị chuyến',
  IN_PROGRESS: 'Đang chạy',
  WAITING_SETTLEMENT: 'Chờ đối soát',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  INCIDENT: 'Sự cố',
};

function firstRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null;

  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function money(value: number | null): string {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value ?? 0))}đ`;
}

function dateTime(value: string | null): string {
  if (!value) return '—';

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function schedule(order: OrderRow): string {
  if (!order.start_time && !order.end_time) return '—';
  if (!order.end_time) return dateTime(order.start_time);
  if (!order.start_time) return dateTime(order.end_time);

  return `${dateTime(order.start_time)} — ${dateTime(order.end_time)}`;
}

function customerText(order: OrderRow, customer: CustomerSummary | null): string {
  if (customer) return customer.name || customer.phone || 'Không rõ';
  if (order.customer_id) return 'Không có quyền xem khách hàng';
  return '—';
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await OrderRepository.list();
      setOrders((data ?? []) as unknown as OrderRow[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải danh sách đơn hàng.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return orders;

    return orders.filter((order) => {
      const customer = firstRelation(order.customer);
      const vehicle = firstRelation(order.vehicle);
      const driver = firstRelation(order.driver);

      return [
        order.order_code,
        customer?.name,
        customer?.phone,
        order.pickup_location,
        order.dropoff_location,
        order.service_type,
        statusLabels[order.status] ?? order.status,
        vehicle?.plate,
        driver?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [orders, search]);

  return (
    <>
      <div className="ab-h1">Đơn hàng</div>
      <div className="ab-sub">{orders.length} đơn đang đọc được.</div>

      <div className="ab-row" style={{ marginBottom: 14 }}>
        <div className="ab-search" style={{ maxWidth: 420, margin: 0 }}>
          <span aria-hidden="true">⌕</span>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã đơn, khách hàng, tuyến, xe hoặc tài xế..."
            aria-label="Tìm kiếm đơn hàng"
          />
        </div>
      </div>

      {error && (
        <div
          className="ab-card"
          style={{ borderColor: '#FCA5A5', color: '#B91C1C', marginBottom: 14 }}
        >
          {error}
        </div>
      )}

      <div className="ab-card">
        {loading ? (
          <div className="ab-empty">Đang tải dữ liệu đơn hàng…</div>
        ) : (
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Tuyến</th>
                  <th>Dịch vụ</th>
                  <th>Lịch chạy</th>
                  <th>Tổng giá</th>
                  <th>Còn lại</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>

              <tbody>
                {filteredOrders.length ? (
                  filteredOrders.map((order) => {
                    const customer = firstRelation(order.customer);

                    return (
                      <tr key={order.id}>
                        <td>
                          <b>{order.order_code || '—'}</b>
                        </td>
                        <td>
                          <b>{customerText(order, customer)}</b>
                          {customer?.phone && (
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--muted)',
                                marginTop: 3,
                              }}
                            >
                              {customer.phone}
                            </div>
                          )}
                        </td>
                        <td>
                          {order.pickup_location || '—'} →{' '}
                          {order.dropoff_location || '—'}
                        </td>
                        <td>{order.service_type || '—'}</td>
                        <td>{schedule(order)}</td>
                        <td>{money(order.total_price)}</td>
                        <td>{money(order.remaining_amount)}</td>
                        <td>
                          <span className={`ab-badge st-${order.status}`}>
                            {statusLabels[order.status] ?? order.status}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="ab-btn sm"
                            href={`/admin/orders/${order.id}`}
                          >
                            Xem →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9}>
                      <div className="ab-empty">
                        {search
                          ? 'Không tìm thấy đơn hàng phù hợp.'
                          : 'Chưa có đơn hàng nào.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
