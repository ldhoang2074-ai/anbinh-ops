// app/login/page.tsx — đăng nhập Google thật + email local khi phát triển.
'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const params = useSearchParams();

  const err = params.get('error');
  const next = params.get('next') || '/admin';
  const isLocalDevelopment = process.env.NODE_ENV === 'development';

  async function signInWithGoogle() {
    setLoading(true);

    const supabase = createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      setLoading(false);
      setLocalMessage(error.message);
    }
  }

  async function sendLocalLoginLink() {
    setLocalLoading(true);
    setLocalMessage('');

    const supabase = createClient();
    const appUrl = window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email: 'local-admin@anbinh.test',
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });

    if (error) {
      setLocalMessage(`Không gửi được link: ${error.message}`);
      setLocalLoading(false);
      return;
    }

    setLocalMessage(
      'Đã gửi link đăng nhập vào hộp thư local. Hãy mở hộp thư bên dưới.',
    );
    setLocalLoading(false);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background:
          'radial-gradient(1200px 600px at 50% -10%, #0c1712, #08110D)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 18,
          padding: '40px 34px',
          boxShadow: '0 24px 48px rgba(8,17,13,.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#16A34A',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              fontSize: 17,
            }}
          >
            AB
          </div>

          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
                color: '#17201B',
              }}
            >
              AN BÌNH
            </div>

            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: '#66736B',
              }}
            >
              Vận Tải 360
            </div>
          </div>
        </div>

        <h1
          style={{
            fontSize: 20,
            margin: '0 0 6px',
            color: '#17201B',
          }}
        >
          Đăng nhập hệ thống vận hành
        </h1>

        <p
          style={{
            fontSize: 13,
            color: '#66736B',
            margin: '0 0 24px',
          }}
        >
          Chỉ tài khoản được An Bình cấp quyền mới truy cập được.
        </p>

        {err && (
          <div
            style={{
              background: '#FDECEC',
              color: '#B91C1C',
              fontSize: 13,
              borderRadius: 10,
              padding: '11px 14px',
              marginBottom: 16,
            }}
          >
            {decodeURIComponent(err)}
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#fff',
            border: '1px solid #E5EAE7',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: '#17201B',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C39.999 35.638 44 30.34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>

          {loading ? 'Đang chuyển tới Google…' : 'Tiếp tục với Google'}
        </button>

        {isLocalDevelopment && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '18px 0',
                color: '#94a3b8',
                fontSize: 11,
              }}
            >
              <span
                style={{
                  height: 1,
                  background: '#E5EAE7',
                  flex: 1,
                }}
              />

              KIỂM TRA LOCAL

              <span
                style={{
                  height: 1,
                  background: '#E5EAE7',
                  flex: 1,
                }}
              />
            </div>

            <button
              type="button"
              onClick={sendLocalLoginLink}
              disabled={localLoading}
              style={{
                width: '100%',
                background: '#ECFDF3',
                border: '1px solid #BBF7D0',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 700,
                color: '#15803D',
                cursor: localLoading ? 'wait' : 'pointer',
              }}
            >
              {localLoading
                ? 'Đang gửi link…'
                : 'Gửi link đăng nhập local'}
            </button>

            {localMessage && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 9,
                  background: '#F8FAFC',
                  color: '#475569',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {localMessage}
              </div>
            )}

            <a
              href="http://127.0.0.1:54324"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                marginTop: 12,
                textAlign: 'center',
                color: '#15803D',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Mở hộp thư local
            </a>
          </>
        )}

        <p
          style={{
            fontSize: 11,
            color: '#94a3b8',
            margin: '20px 0 0',
            textAlign: 'center',
          }}
        >
          Bằng việc đăng nhập, bạn đồng ý với quy định sử dụng nội bộ của
          An Bình.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}