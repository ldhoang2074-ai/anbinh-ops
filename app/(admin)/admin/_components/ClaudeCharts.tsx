'use client';

import { useId, useMemo, useState } from 'react';

type ActivitySeries = {
  key: 'orders' | 'leads' | 'traffic';
  label: string;
  color: string;
  data: number[];
};

type TrafficSource = {
  label: string;
  value: number;
};

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

export function ClaudeActivityChart({
  labels,
  orders,
  leads,
  traffic,
}: {
  labels: string[];
  orders: number[];
  leads: number[];
  traffic: number[];
}) {
  const series: ActivitySeries[] = useMemo(
    () => [
      { key: 'orders', label: 'Đơn mới', color: '#16A34A', data: orders },
      { key: 'leads', label: 'Lead mới', color: '#0284C7', data: leads },
      {
        key: 'traffic',
        label: 'Lượt truy cập',
        color: '#7C5CDB',
        data: traffic,
      },
    ],
    [leads, orders, traffic],
  );
  const [selectedKey, setSelectedKey] = useState<ActivitySeries['key']>('orders');
  const gradientId = useId().replace(/:/g, '');
  const current = series.find((item) => item.key === selectedKey) ?? series[0];
  const data = current.data.length ? current.data : [0];
  const hasData = series.some((item) => item.data.some((value) => value > 0));

  const width = 620;
  const height = 260;
  const padLeft = 42;
  const padBottom = 24;
  const padTop = 12;
  const innerWidth = width - padLeft - 10;
  const innerHeight = height - padTop - padBottom;
  const max = Math.max(1, ...data);
  const xAt = (index: number) =>
    padLeft +
    (data.length === 1 ? innerWidth : (index / (data.length - 1)) * innerWidth);
  const yAt = (value: number) => padTop + innerHeight - (value / max) * innerHeight;
  const linePath = data
    .map(
      (value, index) =>
        `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`,
    )
    .join(' ');
  const areaPath = `${linePath} L ${xAt(data.length - 1).toFixed(1)} ${
    padTop + innerHeight
  } L ${xAt(0).toFixed(1)} ${padTop + innerHeight} Z`;
  const yTicks = Array.from({ length: 5 }, (_, index) => (max / 4) * index);

  return (
    <div className="ab-dashboard-chart">
      <div className="ab-card-hd ab-dashboard-chart-head">
        <div>
          <h3>Tổng quan hoạt động</h3>
          <p>14 ngày gần nhất</p>
        </div>

        <div className="ab-tabs" aria-label="Dữ liệu biểu đồ">
          {series.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ab-tab${selectedKey === item.key ? ' on' : ''}`}
              aria-pressed={selectedKey === item.key}
              onClick={() => setSelectedKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ab-chart-box" aria-live="polite">
        {!hasData ? (
          <div className="ab-dashboard-chart-empty">
            Chưa có hoạt động trong 14 ngày gần nhất.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${current.label} trong 14 ngày gần nhất`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={current.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={current.color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => {
              const y = yAt(tick);

              return (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - 10}
                    y2={y}
                    stroke="#EEF2F0"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={padLeft - 7}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#66736B"
                  >
                    {compactNumber(tick)}
                  </text>
                </g>
              );
            })}

            {labels.map((label, index) =>
              index % 2 === 0 ? (
                <text
                  key={label}
                  x={xAt(index)}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#66736B"
                >
                  {label}
                </text>
              ) : null,
            )}

            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={current.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

const trafficColors = [
  '#16A34A',
  '#0284C7',
  '#7C5CDB',
  '#F59E0B',
  '#DC2626',
  '#0891B2',
];

export function ClaudeTrafficDonut({ entries }: { entries: TrafficSource[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <>
      <div className="ab-donut-box">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Phân bổ nguồn truy cập"
        >
          <g transform="rotate(-90 50 50)">
            {entries.map((entry, index) => {
              const segment = (entry.value / total) * circumference;
              const circle = (
                <circle
                  key={entry.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={trafficColors[index % trafficColors.length]}
                  strokeWidth="14"
                  strokeDasharray={`${segment} ${circumference - segment}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += segment;
              return circle;
            })}
          </g>
        </svg>
      </div>

      <div className="ab-legend">
        {entries.map((entry, index) => (
          <div className="lg" key={entry.label}>
            <span
              className="sw"
              style={{ background: trafficColors[index % trafficColors.length] }}
            />
            <span>{entry.label}</span>
            <b className="lg-val">{entry.value}</b>
            <span className="lg-pct">
              {Math.round((entry.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
