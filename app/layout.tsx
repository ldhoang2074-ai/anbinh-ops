import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Vận Hành — An Bình',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, fontFamily: "'Inter', system-ui, sans-serif", background: '#F5F7FA' }}>
        {children}
      </body>
    </html>
  );
}
