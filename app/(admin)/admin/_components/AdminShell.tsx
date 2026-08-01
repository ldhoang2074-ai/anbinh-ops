'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

type AdminShellProps = {
  children: ReactNode;
  email: string;
  roleLabel: string;
};

const navigation = [
  { label: 'Tổng quan', symbol: '▦', href: '/admin' },
  { label: 'Khách hàng & Lead', symbol: '◎', href: '/admin/leads' },
  { label: 'Đơn hàng', symbol: '▤' },
  { label: 'Điều phối', symbol: '↝' },
  { label: 'Xe', symbol: '▣' },
  { label: 'Tài xế', symbol: '♙' },
  { label: 'Tài chính', symbol: '₫' },
  { label: 'Lưu lượng', symbol: '⌁' },
  { label: 'Nhật ký hệ thống', symbol: '≡' },
  { label: 'Cấu hình', symbol: '⚙' },
];

export default function AdminShell({
  children,
  email,
  roleLabel,
}: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLeads = pathname.startsWith('/admin/leads');
  const title = isLeads ? 'Khách hàng & Lead' : 'Tổng quan';
  const avatarLetter = email.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="ab-shell">
      <button
        type="button"
        aria-label="Đóng menu"
        className={`ab-backdrop ${mobileOpen ? 'on' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`ab-side ${mobileOpen ? 'open' : ''}`}>
        <div className="ab-side-brand">
          <div className="brand-logo">AB</div>

          <div>
            <b>AN BÌNH</b>
            <span>Vận Tải 360</span>
          </div>
        </div>

        <div className="ab-side-status">
          <span className="live" />
          Hệ thống vận hành
        </div>

        <div className="ab-nav-label">Điều hành</div>

        <nav className="ab-nav">
          {navigation.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : Boolean(item.href && pathname.startsWith(item.href));

            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={active ? 'on' : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="ic" aria-hidden="true">
                    {item.symbol}
                  </span>

                  <span className="lb">{item.label}</span>
                </Link>
              );
            }

            return (
              <a
                key={item.label}
                href="#"
                title="Màn hình này sẽ được kết nối ở bước tiếp theo"
                onClick={(event) => event.preventDefault()}
              >
                <span className="ic" aria-hidden="true">
                  {item.symbol}
                </span>

                <span className="lb">{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="ab-side-foot">
          <div className="ava">{avatarLetter}</div>

          <div className="who">
            <b>Quản trị viên</b>
            <span>{roleLabel} · An Bình</span>
          </div>

          <form action="/auth/logout" method="post">
            <button type="submit" title="Đăng xuất" aria-label="Đăng xuất">
              ⇥
            </button>
          </form>
        </div>
      </aside>

      <div className="ab-content">
        <header className="ab-topbar">
          <button
            type="button"
            className="ab-burger"
            aria-label="Mở menu"
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>

          <div className="tb-title">
            <b>{title}</b>
            <span>An Bình OPS · Vận Tải 360</span>
          </div>

          <div className="ab-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="text"
              placeholder="Tìm khách hàng, đơn hàng, biển số, tài xế..."
              aria-label="Tìm kiếm"
            />
          </div>

          <div className="ab-topbar-actions">
            <Link className="ab-btn primary" href="/admin/leads?new=1">
              ＋ Tạo Lead mới
            </Link>

            <Link
              className="ab-icon-btn"
              href="/admin"
              title="Cảnh báo"
              aria-label="Cảnh báo"
            >
              ♢
            </Link>

            <div className="ava">{avatarLetter}</div>
          </div>
        </header>

        <main className="ab-main">{children}</main>
      </div>
    </div>
  );
}