'use client';

import { Loader2, Smartphone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import PageContainer from '@/components/PageContainer';
import TVLayout from '@/components/tv/TVLayout';

type QrState = { token: string; qrUrl: string; expiresAt: number; ttl: number };

export default function TVLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/tv';
  const [qr, setQr] = useState<QrState | null>(null);
  const [status, setStatus] = useState('正在生成二维码...');
  const [left, setLeft] = useState(0);

  const create = useCallback(async () => {
    setStatus('正在生成二维码...');
    const res = await fetch('/api/auth/qr/create', { method: 'POST' });
    const data = await res.json();
    const qrUrl =
      typeof window === 'undefined'
        ? data.qrUrl
        : `${window.location.origin}/qr-login?token=${encodeURIComponent(
            data.token
          )}`;
    setQr({ ...data, qrUrl });
    setLeft(Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000)));
    setStatus('请使用手机扫码登录');
  }, []);

  useEffect(() => {
    create();
  }, [create]);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((qr.expiresAt - Date.now()) / 1000)
      );
      setLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        create();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [create, qr]);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(
        `/api/auth/qr/status?token=${encodeURIComponent(qr.token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.status === 'scanned') setStatus('已扫码，请在手机上确认');
      if (data.status === 'confirmed') {
        setStatus('登录成功，正在进入电视端');
        window.clearInterval(timer);
        router.replace(redirect);
      }
      if (data.status === 'expired') setStatus('二维码已过期，请刷新');
      if (data.status === 'cancelled') setStatus('已取消，请刷新二维码');
    }, 2000);
    return () => window.clearInterval(timer);
  }, [qr, redirect, router]);

  const qrImg = qr
    ? `/api/auth/qr/image?data=${encodeURIComponent(qr.qrUrl)}`
    : '';

  return (
    <TVLayout showNav={false}>
      <PageContainer className='text-fg grid min-w-0 grid-cols-1 gap-6 rounded-md border border-line bg-surface py-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-10 lg:py-12 shadow-2xl shadow-ink/60'>
        <div className='flex min-w-0 flex-col justify-center'>
          <div className='inline-flex max-w-full w-fit items-center gap-3 rounded-md bg-raised px-4 py-3 text-sm lg:text-xl font-bold text-fg'>
            <Smartphone className='h-6 w-6' /> 手机确认 · 电视自动登录
          </div>
          <h1 className='mt-6 text-3xl sm:text-5xl lg:text-7xl font-black tracking-normal'>
            扫码登录
          </h1>
          <p className='mt-4 max-w-2xl text-base sm:text-xl lg:text-3xl leading-relaxed text-muted'>
            用已登录的手机浏览器扫描右侧二维码，在手机上确认后，电视端会自动进入。
          </p>
          <p className='mt-6 text-base lg:text-2xl font-bold text-fg'>
            {status}
          </p>
        </div>
        <div className='min-w-0 rounded-md border border-line bg-surface p-4 sm:p-7 text-center text-fg shadow-2xl shadow-ink/60'>
          {qrImg ? (
            <img
              src={qrImg}
              alt='扫码登录二维码'
              className='mx-auto aspect-square h-auto w-full max-w-[360px]'
            />
          ) : (
            <div className='flex h-[360px] items-center justify-center'>
              <Loader2 className='h-12 w-12 animate-spin' />
            </div>
          )}
          <div className='mt-5 text-2xl font-black'>剩余 {left} 秒</div>
        </div>
      </PageContainer>
    </TVLayout>
  );
}
