'use client';

import { CheckCircle, Loader2, LogIn, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageContainer from '@/components/PageContainer';

function QrLoginClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const authed = Boolean(getAuthInfoFromBrowserCookie());

  const confirm = async () => {
    setLoading(true);
    setMessage('');
    const res = await fetch('/api/auth/qr/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMessage('确认成功，正在返回上一页...');
      window.setTimeout(() => {
        window.history.back();
      }, 700);
      return;
    }
    setMessage(data.error || '确认失败');
  };

  const cancel = async () => {
    await fetch('/api/auth/qr/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    setMessage('已取消本次电视登录，正在返回上一页...');
    window.setTimeout(() => {
      window.history.back();
    }, 500);
  };

  return (
    <PageContainer className='min-h-screen bg-[var(--tm-bg)] py-10 text-[color:var(--tm-text)]'>
      <section className='mx-auto max-w-md rounded-[32px] border border-[var(--tm-line)] bg-[var(--tm-surface)] p-7 shadow-2xl shadow-[var(--tm-room-cinema-bg)]'>
        <h1 className='text-3xl font-black'>确认登录电视端</h1>
        <p className='mt-3 text-[color:var(--tm-muted)]'>
          请确认电视屏幕上的二维码来自你正在使用的设备。
        </p>
        {!authed ? (
          <div className='mt-8 rounded-3xl bg-[var(--tm-surface-raised)] p-5'>
            <LogIn className='h-12 w-12 text-[color:var(--tm-text)]' />
            <p className='mt-4 text-lg font-bold'>
              当前手机未登录，请先登录后再确认电视登录。
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(
                `/qr-login?token=${token}`
              )}`}
              className='mt-5 block rounded-2xl bg-[var(--tm-text)] px-5 py-4 text-center text-lg font-black text-[color:var(--tm-accent-contrast)] min-h-[44px] tm-press'
            >
              去登录
            </Link>
          </div>
        ) : (
          <div className='mt-8 grid gap-3'>
            <button
              onClick={confirm}
              disabled={loading || !token}
              className='flex items-center justify-center gap-2 rounded-2xl bg-[var(--tm-text)] px-5 py-4 text-lg font-black disabled:opacity-60 text-[color:var(--tm-accent-contrast)] min-h-[44px] tm-press'
            >
              {loading ? (
                <Loader2 className='h-5 w-5 animate-spin' />
              ) : (
                <CheckCircle className='h-5 w-5' />
              )}{' '}
              确认登录
            </button>
            <button
              onClick={cancel}
              className='flex items-center justify-center gap-2 rounded-2xl bg-[var(--tm-surface-raised)] px-5 py-4 text-lg font-bold min-h-[44px] tm-press'
            >
              <XCircle className='h-5 w-5' /> 取消
            </button>
          </div>
        )}
        {message && (
          <p className='mt-5 rounded-2xl bg-[var(--tm-surface-raised)] p-4 text-center text-lg font-bold'>
            {message}
          </p>
        )}
      </section>
    </PageContainer>
  );
}

export default function QrLoginPage() {
  return (
    <Suspense fallback={null}>
      <QrLoginClient />
    </Suspense>
  );
}
