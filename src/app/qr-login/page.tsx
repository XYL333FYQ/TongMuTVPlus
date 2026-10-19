'use client';

import { CheckCircle, Loader2, LogIn, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import '@/styles/auth.css';

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
    <PageContainer className='tm-auth'>
      <section className='tm-auth-card'>
        <h1 className='tm-auth-title'>确认登录电视端</h1>
        <p className='tm-auth-sub'>
          请确认电视屏幕上的二维码来自你正在使用的设备。
        </p>
        {!authed ? (
          <div className='tm-auth-note'>
            <LogIn size={28} aria-hidden />
            <p className='mt-3 text-[15px] font-medium'>
              当前手机未登录，请先登录后再确认电视登录。
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(
                `/qr-login?token=${token}`
              )}`}
              className='tm-btn tm-btn-primary tm-btn-lg mt-5 w-full'
            >
              去登录
            </Link>
          </div>
        ) : (
          <div className='grid gap-3'>
            <button
              onClick={confirm}
              disabled={loading || !token}
              className='tm-btn tm-btn-primary tm-btn-lg w-full'
            >
              {loading ? (
                <Loader2 className='h-5 w-5 animate-spin' />
              ) : (
                <CheckCircle className='h-5 w-5' />
              )}
              确认登录
            </button>
            <button
              onClick={cancel}
              className='tm-btn tm-btn-secondary tm-btn-lg w-full'
            >
              <XCircle className='h-5 w-5' />
              取消
            </button>
          </div>
        )}
        {message && (
          <p className='tm-auth-note mt-5 text-center text-[15px]'>{message}</p>
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
