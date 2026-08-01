'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  DispatchRepository,
  DriverRepository,
  OrderRepository,
  VehicleRepository,
} from '@/lib/repositories';

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

type DispatchVehicle = {
  id: string;
  plate: string;
  model: string | null;
  status: string;
  registration_expiry: string | null;
  insurance_expiry: string | null;
};

type DispatchDriver = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  license_expiry: string | null;
};

type Relation<T> = T | T[] | null;

type OrderDetail = {
  id: string;
  order_code: string;
  customer_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  status: string;
  service_type: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  passenger_count: number | null;
  start_time: string | null;
  end_time: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  actual_cost: number | null;
  actual_profit: number | null;
  debt_approved: boolean | null;
  cancel_reason: string | null;
  incident_reason: string | null;
  created_at: string;
  updated_at: string;
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
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function customerFallback(order: OrderDetail): string {
  return order.customer_id
    ? 'Không có quyền xem thông tin khách hàng'
    : 'Chưa liên kết khách hàng';
}

export default function OrderDetailClient({
  orderId,
  canAssign,
}: {
  orderId: string;
  canAssign: boolean;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>([]);
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState('');
  const [dispatchSuccess, setDispatchSuccess] = useState('');

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await OrderRepository.get(orderId);
      setOrder(data as unknown as OrderDetail);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải chi tiết đơn hàng.',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const loadDispatchOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError('');

    try {
      const [vehicleData, driverData] = await Promise.all([
        VehicleRepository.listDispatchable(),
        DriverRepository.listDispatchable(),
      ]);
      setVehicles(vehicleData as DispatchVehicle[]);
      setDrivers(driverData as DispatchDriver[]);
    } catch {
      setOptionsError('Không thể tải danh sách xe hoặc tài xế phù hợp.');
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAssign && order?.status === 'WAITING_ASSIGNMENT') {
      void loadDispatchOptions();
    }
  }, [canAssign, loadDispatchOptions, order?.status]);

  async function submitDispatch() {
    if (!order || order.status !== 'WAITING_ASSIGNMENT') return;

    setSubmitting(true);
    setDispatchError('');
    setDispatchSuccess('');

    try {
      await DispatchRepository.assign(
        order.id,
        selectedVehicleId,
        selectedDriverId,
      );
      setDispatchSuccess('Đã điều phối xe và tài xế thành công.');
      await loadOrder();
    } catch (submitError) {
      setDispatchError(
        submitError instanceof Error
          ? submitError.message
          : 'Không thể điều phối xe và tài xế.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="ab-empty">Đang tải chi tiết đơn hàng…</div>;
  }

  if (!order) {
    return (
      <>
        <Link className="ab-btn" href="/admin/orders">
          ← Danh sách đơn hàng
        </Link>

        <div
          className="ab-card"
          style={{ borderColor: '#FCA5A5', color: '#B91C1C', marginTop: 16 }}
        >
          {error || 'Không tìm thấy đơn hàng.'}
        </div>
      </>
    );
  }

  const customer = firstRelation(order.customer);
  const vehicle = firstRelation(order.vehicle);
  const driver = firstRelation(order.driver);
  const isDispatched = Boolean(order.vehicle_id || order.driver_id);

  return (
    <>
      <div className="ab-row between" style={{ marginBottom: 20 }}>
        <div>
          <div className="ab-h1">Đơn {order.order_code || '—'}</div>
          <div className="ab-sub">
            {order.pickup_location || '—'} → {order.dropoff_location || '—'}
          </div>
        </div>

        <Link className="ab-btn" href="/admin/orders">
          ← Danh sách đơn hàng
        </Link>
      </div>

      <div className="ab-detail-grid">
        <div>
          <section className="ab-card">
            <div className="ab-card-hd">
              <h3>Thông tin đơn hàng</h3>
              <span className={`ab-badge st-${order.status}`}>
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>

            <div className="ab-kv">
              <b>Mã đơn</b>
              <span>{order.order_code || '—'}</span>
            </div>
            <div className="ab-kv">
              <b>Dịch vụ</b>
              <span>{order.service_type || '—'}</span>
            </div>
            <div className="ab-kv">
              <b>Điểm đón → điểm trả</b>
              <span>
                {order.pickup_location || '—'} → {order.dropoff_location || '—'}
              </span>
            </div>
            <div className="ab-kv">
              <b>Số khách</b>
              <span>{order.passenger_count ?? '—'}</span>
            </div>
            <div className="ab-kv">
              <b>Thời gian bắt đầu</b>
              <span>{dateTime(order.start_time)}</span>
            </div>
            <div className="ab-kv">
              <b>Thời gian kết thúc</b>
              <span>{dateTime(order.end_time)}</span>
            </div>
            <div className="ab-kv">
              <b>Ngày tạo</b>
              <span>{dateTime(order.created_at)}</span>
            </div>
            <div className="ab-kv">
              <b>Cập nhật gần nhất</b>
              <span>{dateTime(order.updated_at)}</span>
            </div>
          </section>

          <section className="ab-card">
            <h3>Thông tin tài chính</h3>

            <div className="ab-kv">
              <b>Tổng giá</b>
              <span>{money(order.total_price)}</span>
            </div>
            <div className="ab-kv">
              <b>Tiền cọc</b>
              <span>{money(order.deposit_amount)}</span>
            </div>
            <div className="ab-kv">
              <b>Đã thu</b>
              <span>{money(order.paid_amount)}</span>
            </div>
            <div className="ab-kv">
              <b>Còn lại</b>
              <span>{money(order.remaining_amount)}</span>
            </div>
            <div className="ab-kv">
              <b>Chi phí thực tế</b>
              <span>{money(order.actual_cost)}</span>
            </div>
            <div className="ab-kv">
              <b>Lợi nhuận thực tế</b>
              <span>{money(order.actual_profit)}</span>
            </div>
            <div className="ab-kv">
              <b>Duyệt công nợ</b>
              <span>{order.debt_approved ? 'Đã duyệt' : 'Chưa duyệt'}</span>
            </div>
          </section>

          {(order.cancel_reason || order.incident_reason) && (
            <section className="ab-card">
              <h3>Thông tin bổ sung</h3>

              {order.cancel_reason && (
                <div className="ab-kv">
                  <b>Lý do hủy</b>
                  <span>{order.cancel_reason}</span>
                </div>
              )}
              {order.incident_reason && (
                <div className="ab-kv">
                  <b>Lý do sự cố</b>
                  <span>{order.incident_reason}</span>
                </div>
              )}
            </section>
          )}
        </div>

        <div>
          <section className="ab-card">
            <h3>Thông tin khách</h3>

            <div className="ab-kv">
              <b>Tên</b>
              <span>{customer?.name || customerFallback(order)}</span>
            </div>
            <div className="ab-kv">
              <b>Số điện thoại</b>
              <span>
                {customer
                  ? customer.phone || '—'
                  : order.customer_id
                    ? 'Không có quyền xem thông tin khách hàng'
                    : '—'}
              </span>
            </div>
          </section>

          <section className="ab-card">
            <h3>Thông tin điều phối</h3>

            {!isDispatched ? (
              <div className="ab-empty">Chưa điều phối</div>
            ) : (
              <>
                <div className="ab-kv">
                  <b>Xe</b>
                  <span>
                    {vehicle
                      ? vehicle.model || vehicle.plate
                      : order.vehicle_id
                        ? 'Không có quyền xem thông tin xe'
                        : 'Chưa gán'}
                  </span>
                </div>
                <div className="ab-kv">
                  <b>Biển số</b>
                  <span>
                    {vehicle
                      ? vehicle.plate
                      : order.vehicle_id
                        ? 'Không có quyền xem thông tin xe'
                        : 'Chưa gán'}
                  </span>
                </div>
                <div className="ab-kv">
                  <b>Tài xế</b>
                  <span>
                    {driver
                      ? driver.name
                      : order.driver_id
                        ? 'Không có quyền xem thông tin tài xế'
                        : 'Chưa gán'}
                  </span>
                </div>
                <div className="ab-kv">
                  <b>Số điện thoại tài xế</b>
                  <span>
                    {driver
                      ? driver.phone || '—'
                      : order.driver_id
                        ? 'Không có quyền xem thông tin tài xế'
                        : 'Chưa gán'}
                  </span>
                </div>
              </>
            )}
          </section>

          <section className="ab-card">
            <h3>Điều phối xe và tài xế</h3>

            {dispatchSuccess && (
              <div className="ab-alert" style={{ marginBottom: 14 }}>
                {dispatchSuccess}
              </div>
            )}

            {order.status !== 'WAITING_ASSIGNMENT' ? (
              <div className="ab-sub">
                Trạng thái hiện tại: {statusLabels[order.status] ?? order.status}.
                Không thể tạo điều phối mới cho đơn này.
              </div>
            ) : !canAssign ? (
              <div className="ab-sub">
                Bạn không có quyền điều phối xe và tài xế cho đơn này.
              </div>
            ) : (
              <>
                <div className="ab-kv" style={{ marginBottom: 14 }}>
                  <b>Thời gian chuyến</b>
                  <span>
                    {dateTime(order.start_time)} → {dateTime(order.end_time)}
                  </span>
                </div>

                {(optionsError || dispatchError) && (
                  <div className="ab-alert danger">
                    {dispatchError || optionsError}
                  </div>
                )}

                {optionsLoading ? (
                  <div className="ab-sub">Đang tải xe và tài xế phù hợp…</div>
                ) : (
                  <>
                    <div className="ab-field">
                      <label htmlFor="dispatch-vehicle">Xe</label>
                      <select
                        id="dispatch-vehicle"
                        value={selectedVehicleId}
                        onChange={(event) => setSelectedVehicleId(event.target.value)}
                        disabled={submitting || Boolean(optionsError)}
                      >
                        <option value="">Chọn xe</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.plate}{vehicle.model ? ` — ${vehicle.model}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="ab-field">
                      <label htmlFor="dispatch-driver">Tài xế</label>
                      <select
                        id="dispatch-driver"
                        value={selectedDriverId}
                        onChange={(event) => setSelectedDriverId(event.target.value)}
                        disabled={submitting || Boolean(optionsError)}
                      >
                        <option value="">Chọn tài xế</option>
                        {drivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}{driver.phone ? ` — ${driver.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!optionsError && (!vehicles.length || !drivers.length) && (
                      <div className="ab-sub" style={{ marginBottom: 14 }}>
                        Chưa có xe hoặc tài xế phù hợp để điều phối.
                      </div>
                    )}

                    <button
                      type="button"
                      className="ab-btn primary"
                      onClick={submitDispatch}
                      disabled={
                        !selectedVehicleId ||
                        !selectedDriverId ||
                        submitting ||
                        Boolean(optionsError)
                      }
                    >
                      {submitting ? 'Đang điều phối…' : 'Xác nhận điều phối'}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
