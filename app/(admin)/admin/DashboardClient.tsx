'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClaudeActivityChart,
  ClaudeTrafficDonut,
} from './_components/ClaudeCharts';
import { DashboardRepository } from '@/lib/repositories';

type Relation<T> = T | T[] | null;

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

type DashboardOrder = {
  id: string;
  order_code: string;
  lead_id: string | null;
  customer_id: string | null;
  status: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  total_price: number | null;
  paid_amount: number | null;
  created_at: string;
  customer: Relation<CustomerSummary>;
  vehicle: Relation<VehicleSummary>;
};

type DashboardLead = {
  id: string;
  status: string;
  created_at: string;
};

type TrafficEvent = {
  id: string;
  event_name: string;
  source: string | null;
  utm_source: string | null;
  timestamp: string;
};

type DashboardData = {
  orders: DashboardOrder[];
  leads: DashboardLead[];
  traffic: TrafficEvent[];
};

type FollowUp = {
  href: string;
  label: string;
  description: string;
  tone: 'warn' | 'danger';
};

const activeOrderStatuses = new Set([
  'WAITING_ASSIGNMENT',
  'ASSIGNED',
  'PREPARING',
  'IN_PROGRESS',
  'WAITING_SETTLEMENT',
]);

const orderStatusLabels: Record<string, string> = {
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

function money(value: number | null | undefined): string {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value ?? 0))}đ`;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function dateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function fourteenDayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));

    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      }).format(date),
    };
  });
}

function sourceName(event: TrafficEvent): string {
  return event.utm_source?.trim() || event.source?.trim() || 'Trực tiếp';
}

function DashboardStat({
  label,
  value,
  meta,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  meta: string;
  tone: 'green' | 'blue' | 'violet' | 'amber';
  icon: string;
}) {
  return (
    <section className="ab-stat">
      <div className="st-top">
        <span className="st-label">{label}</span>
        <span className={`st-ico ${tone}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className="st-val">{value}</strong>
      <div className="st-meta">
        <span className="st-trend flat">{meta}</span>
      </div>
    </section>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const overview = await DashboardRepository.overview();
      setData(overview as unknown as DashboardData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = useMemo(() => {
    const orders = data?.orders ?? [];
    const leads = data?.leads ?? [];
    const traffic = data?.traffic ?? [];
    const days = fourteenDayRange();
    const ordersByDay = new Map<string, number>();
    const leadsByDay = new Map<string, number>();
    const visitsByDay = new Map<string, number>();
    const trafficBySource = new Map<string, number>();

    for (const order of orders) {
      const key = dateKey(order.created_at);
      ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    }

    for (const lead of leads) {
      const key = dateKey(lead.created_at);
      leadsByDay.set(key, (leadsByDay.get(key) ?? 0) + 1);
    }

    for (const event of traffic) {
      if (event.event_name !== 'PAGE_VIEW') continue;

      const key = dateKey(event.timestamp);
      visitsByDay.set(key, (visitsByDay.get(key) ?? 0) + 1);
      const source = sourceName(event);
      trafficBySource.set(source, (trafficBySource.get(source) ?? 0) + 1);
    }

    const totalRevenue = orders.reduce(
      (total, order) => total + Number(order.paid_amount ?? 0),
      0,
    );
    const activeOrders = orders.filter((order) =>
      activeOrderStatuses.has(order.status),
    ).length;
    const convertedLeadIds = new Set(
      orders.map((order) => order.lead_id).filter((leadId): leadId is string => Boolean(leadId)),
    );
    const conversionRate = leads.length
      ? Math.round((convertedLeadIds.size / leads.length) * 100)
      : 0;
    const trafficSources = [...trafficBySource.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const followUps: FollowUp[] = [];
    const waitingAssignment = orders.filter(
      (order) => order.status === 'WAITING_ASSIGNMENT',
    ).length;
    const newLeads = leads.filter((lead) => lead.status === 'LEAD_NEW').length;

    if (waitingAssignment) {
      followUps.push({
        href: '/admin/orders',
        label: `${waitingAssignment} đơn chờ điều phối`,
        description: 'Cần gán xe và tài xế trước khi chuyến chạy.',
        tone: 'warn',
      });
    }

    if (newLeads) {
      followUps.push({
        href: '/admin/leads',
        label: `${newLeads} Lead mới`,
        description: 'Cần bắt đầu tư vấn khách hàng.',
        tone: 'danger',
      });
    }

    return {
      totalRevenue,
      activeOrders,
      totalOrders: orders.length,
      totalLeads: leads.length,
      pageViews: traffic.filter((event) => event.event_name === 'PAGE_VIEW').length,
      conversionRate,
      recentOrders: [...orders]
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        )
        .slice(0, 6),
      chart: {
        labels: days.map((day) => day.label),
        orders: days.map((day) => ordersByDay.get(day.key) ?? 0),
        leads: days.map((day) => leadsByDay.get(day.key) ?? 0),
        traffic: days.map((day) => visitsByDay.get(day.key) ?? 0),
      },
      trafficSources,
      followUps,
    };
  }, [data]);

  return (
    <div className="ab-dashboard-page">
      <header className="ab-dashboard-header">
        <div>
          <p className="ab-dashboard-eyebrow">An Bình OPS</p>
          <h1 className="ab-h1">Tổng quan vận hành</h1>
          <p className="ab-sub">
            Số liệu đọc trực tiếp từ dữ liệu đang được phép xem.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="ab-card ab-dashboard-state">Đang tải dữ liệu tổng quan…</div>
      ) : error ? (
        <div className="ab-card ab-dashboard-state ab-dashboard-error" role="alert">
          Không thể tải dữ liệu tổng quan. Vui lòng thử lại.
          <button type="button" className="ab-btn sm" onClick={loadDashboard}>
            Tải lại
          </button>
        </div>
      ) : (
        <>
          <div className="ab-statrow ab-dashboard-stats">
            <DashboardStat
              label="Tổng doanh thu đã thu"
              value={money(summary.totalRevenue)}
              meta="Từ số tiền đã thu trên đơn"
              tone="green"
              icon="₫"
            />
            <DashboardStat
              label="Đơn đang hoạt động"
              value={summary.activeOrders}
              meta={`${summary.totalLeads} Lead đang đọc được`}
              tone="blue"
              icon="↗"
            />
            <DashboardStat
              label="Tổng số đơn hàng"
              value={summary.totalOrders}
              meta={
                summary.totalLeads
                  ? `${summary.conversionRate}% Lead → đơn`
                  : 'Chưa có Lead để tính tỷ lệ'
              }
              tone="violet"
              icon="▣"
            />
            <DashboardStat
              label="Lượt truy cập website"
              value={summary.pageViews}
              meta="14 ngày gần nhất"
              tone="amber"
              icon="◎"
            />
          </div>

          <div className="ab-dash ab-dashboard-grid">
            <div className="ab-dash-col">
              <section className="ab-card ab-dashboard-chart-card">
                <ClaudeActivityChart {...summary.chart} />
              </section>

              <section className="ab-card ab-dashboard-recent-card">
                <div className="ab-card-hd">
                  <h3>Đơn gần nhất</h3>
                  <Link className="ab-btn sm" href="/admin/orders">
                    Tất cả →
                  </Link>
                </div>

                {summary.recentOrders.length ? (
                  <div className="ab-table-wrap">
                    <table className="ab-table ab-dashboard-table">
                      <thead>
                        <tr>
                          <th>Mã đơn</th>
                          <th>Khách</th>
                          <th>Tuyến</th>
                          <th>Xe</th>
                          <th>Giá trị</th>
                          <th>Trạng thái</th>
                          <th aria-label="Thao tác" />
                        </tr>
                      </thead>
                      <tbody>
                        {summary.recentOrders.map((order) => {
                          const customer = firstRelation(order.customer);
                          const vehicle = firstRelation(order.vehicle);

                          return (
                            <tr key={order.id}>
                              <td>
                                <b>{order.order_code || '—'}</b>
                                <div className="ab-dashboard-created">
                                  {dateTime(order.created_at)}
                                </div>
                              </td>
                              <td>
                                {customer?.name ||
                                  (order.customer_id
                                    ? 'Không có quyền xem khách hàng'
                                    : '—')}
                              </td>
                              <td className="ab-dashboard-route">
                                {order.pickup_location || '—'} →{' '}
                                {order.dropoff_location || '—'}
                              </td>
                              <td>{vehicle?.plate || '—'}</td>
                              <td>
                                <b>{money(order.total_price)}</b>
                              </td>
                              <td>
                                <span className={`ab-badge st-${order.status}`}>
                                  {orderStatusLabels[order.status] ?? order.status}
                                </span>
                              </td>
                              <td>
                                <Link
                                  className="ab-btn sm"
                                  href={`/admin/orders/${order.id}`}
                                >
                                  Xem
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ab-empty">Chưa có đơn hàng nào.</div>
                )}
              </section>
            </div>

            <div className="ab-dash-col">
              <section className="ab-card">
                <h3>Nguồn truy cập</h3>
                {summary.trafficSources.length ? (
                  <ClaudeTrafficDonut entries={summary.trafficSources} />
                ) : (
                  <div className="ab-empty">
                    Chưa có dữ liệu truy cập trong 14 ngày gần nhất.
                  </div>
                )}
              </section>

              <section className="ab-card ab-dashboard-goals">
                <h3>Mục tiêu tháng</h3>
                <div className="ab-dashboard-goal-empty">
                  <span aria-hidden="true">◌</span>
                  <div>
                    <b>Chưa cấu hình mục tiêu</b>
                    <p>Hệ thống chưa có dữ liệu mục tiêu tháng để so sánh.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="ab-card ab-dashboard-followups">
            <div className="ab-card-hd">
              <h3>Việc cần xử lý ngay</h3>
              <span className={`ab-chip ${summary.followUps.length ? 'warn' : 'good'}`}>
                {summary.followUps.length} việc
              </span>
            </div>

            {summary.followUps.length ? (
              <div className="ab-tasks">
                {summary.followUps.map((item) => (
                  <Link className={`ab-task ${item.tone}`} href={item.href} key={item.label}>
                    <span className="t-ico" aria-hidden="true">
                      {item.tone === 'danger' ? '!' : '↗'}
                    </span>
                    <span className="t-body">
                      <span className="t-title">{item.label}</span>
                      <span className="t-sub">{item.description}</span>
                    </span>
                    <span className="t-go" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ab-empty">Không có việc tồn đọng cần theo dõi.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
