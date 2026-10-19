'use client';

import {
  BadgeCheck,
  Clock3,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Volume2,
  Wifi,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { clearAuthCookie, getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  type TVPlayerUpDownAction,
  DEFAULT_TV_PLAYER_UP_DOWN_ACTION,
  loadTVPlayerUpDownAction,
  saveTVPlayerUpDownAction,
} from '@/lib/tv-preferences';

import TVLayout from '@/components/tv/TVLayout';

const LOCAL_REMOTE_URL_KEY = 'moontv_local_remote_url';

type MoonTVLocalRemoteBridge = {
  getRemoteUrl?: () => string;
};

declare global {
  interface Window {
    MoonTVLocalRemote?: MoonTVLocalRemoteBridge;
    __MOONTV_LOCAL_REMOTE_URL?: string;
  }
}

type AuthInfo = {
  username?: string;
  role?: 'owner' | 'admin' | 'user';
  timestamp?: number;
  refreshExpires?: number;
};

function getRoleText(role?: AuthInfo['role']) {
  switch (role) {
    case 'owner':
      return '站长';
    case 'admin':
      return '管理员';
    case 'user':
      return '用户';
    default:
      return '访客';
  }
}

function formatDateTime(value?: number) {
  if (!value) return '当前会话';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '当前会话';
  }
}

export default function TVMePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [localRemoteUrl, setLocalRemoteUrl] = useState('');
  const [upDownAction, setUpDownAction] = useState<TVPlayerUpDownAction>(
    DEFAULT_TV_PLAYER_UP_DOWN_ACTION
  );
  const wakeMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const volumeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    setAuthInfo(auth);
    setUpDownAction(loadTVPlayerUpDownAction());
    setReady(true);
  }, []);

  useEffect(() => {
    const readLocalRemoteUrl = () => {
      const bridgeUrl = window.MoonTVLocalRemote?.getRemoteUrl?.() || '';
      setLocalRemoteUrl(
        bridgeUrl ||
          window.__MOONTV_LOCAL_REMOTE_URL ||
          localStorage.getItem(LOCAL_REMOTE_URL_KEY) ||
          ''
      );
    };

    const onLocalRemoteInfo = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      setLocalRemoteUrl(detail?.url || '');
    };

    readLocalRemoteUrl();
    window.addEventListener('moontv:local-remote-info', onLocalRemoteInfo);
    const timer = window.setInterval(readLocalRemoteUrl, 1500);

    return () => {
      window.removeEventListener('moontv:local-remote-info', onLocalRemoteInfo);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (ready && !authInfo) {
      router.replace('/tv/login?redirect=/tv/me');
    }
  }, [authInfo, ready, router]);

  const username = authInfo?.username || 'default';
  const roleText = getRoleText(authInfo?.role || 'user');
  const avatarText = useMemo(
    () => username.trim().charAt(0).toUpperCase() || 'D',
    [username]
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    setError('');
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      setError('登出请求失败，已清理本地登录状态。');
    } finally {
      clearAuthCookie();
      router.replace('/tv/login');
    }
  };

  const handleUpDownActionChange = (action: TVPlayerUpDownAction) => {
    setUpDownAction(action);
    saveTVPlayerUpDownAction(action);
  };

  const handleUpDownActionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    event.stopPropagation();

    const nextAction: TVPlayerUpDownAction =
      event.key === 'ArrowRight' ? 'volume' : 'wake-menu';
    handleUpDownActionChange(nextAction);
    window.requestAnimationFrame(() => {
      const target =
        nextAction === 'wake-menu'
          ? wakeMenuButtonRef.current
          : volumeButtonRef.current;
      target?.focus({ preventScroll: true });
    });
  };

  if (!ready || !authInfo) {
    return (
      <TVLayout>
        <section
          role='status'
          aria-label='正在读取登录信息'
          className='tm-skeleton h-48 rounded-[42px] border border-[var(--tm-line)] p-12 text-center'
        >
          <h1 className='sr-only'>正在读取登录信息</h1>
          <p className='sr-only'>请稍候，电视端会自动跳转。</p>
        </section>
      </TVLayout>
    );
  }

  return (
    <TVLayout>
      <section className='tm-glass overflow-hidden rounded-[42px] border border-[var(--tm-line)] shadow-lg'>
        <div className='relative p-4 md:p-12'>
          <div className='pointer-events-none absolute inset-0 bg-transparent' />
          <div className='relative grid gap-10 lg:grid-cols-[1fr_340px]'>
            <div>
              <div className='inline-flex items-center gap-3 rounded-full border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] px-5 py-2 text-base font-medium text-[color:var(--tm-text)]'>
                <BadgeCheck className='h-6 w-6' />
                已登录电视端
              </div>
              <div className='mt-8 flex items-center gap-7'>
                <div className='flex h-28 w-28 shrink-0 items-center justify-center rounded-[32px] bg-[var(--tm-surface)] text-[24px] font-medium text-[color:var(--tm-text)] shadow-lg'>
                  {avatarText}
                </div>
                <div>
                  <h1 className='break-words text-[28px] md:text-[32px] font-bold tracking-normal text-[color:var(--tm-text)]'>
                    {username}
                  </h1>
                  <p className='mt-3 text-base text-[color:var(--tm-muted)]'>
                    查看账号和电视设置
                  </p>
                </div>
              </div>

              <div className='mt-10 grid gap-4 md:grid-cols-2'>
                <div className='rounded-[28px] border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-6'>
                  <div className='flex items-center gap-3 text-base font-medium text-[color:var(--tm-muted)]'>
                    <ShieldCheck className='h-6 w-6 text-[color:var(--tm-text)]' />
                    账号角色
                  </div>
                  <div className='mt-4 text-[24px] font-medium text-[color:var(--tm-text)]'>
                    {roleText}
                  </div>
                </div>
                <div className='rounded-[28px] border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-6'>
                  <div className='flex items-center gap-3 text-base font-medium text-[color:var(--tm-muted)]'>
                    <Clock3 className='h-6 w-6 text-[color:var(--tm-text)]' />
                    登录时间
                  </div>
                  <div className='mt-4 text-base font-medium text-[color:var(--tm-text)]'>
                    {formatDateTime(authInfo.timestamp)}
                  </div>
                </div>
              </div>
            </div>

            <aside className='flex flex-col justify-between rounded-[34px] border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-7'>
              <div>
                <div className='flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--tm-surface-raised)]'>
                  <User className='h-9 w-9 text-[color:var(--tm-text)]' />
                </div>
                <h2 className='mt-6 text-[20px] md:text-[24px] font-medium'>
                  我的账号
                </h2>
                <p className='mt-4 text-base leading-relaxed text-[color:var(--tm-muted)]'>
                  此设备已登录该账号。登出后返回扫码登录页。
                </p>
              </div>

              <div className='mt-10'>
                {error && (
                  <p
                    role='alert'
                    className='mb-4 rounded-2xl border border-[var(--tm-danger)] bg-[var(--tm-surface-raised)] p-4 text-base text-[color:var(--tm-text)]'
                  >
                    {error}
                  </p>
                )}
                <button
                  type='button'
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className='tv-focusable flex w-full cursor-pointer items-center justify-center gap-3 rounded-3xl bg-[var(--tm-text)] px-7 py-5 text-base font-medium text-[color:var(--tm-accent-contrast)] outline-none transition duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 min-h-[44px] tm-press'
                >
                  {loggingOut ? (
                    <span
                      aria-hidden='true'
                      className='tm-skeleton h-8 w-8 rounded-full'
                    />
                  ) : (
                    <LogOut className='h-8 w-8' />
                  )}
                  {loggingOut ? '正在登出' : '登出'}
                </button>
              </div>
            </aside>
          </div>

          <div className='relative mt-10 overflow-hidden rounded-[34px] border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-7'>
            <div className='pointer-events-none absolute inset-0 bg-transparent' />
            <div className='relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between'>
              <div className='max-w-2xl'>
                <div className='inline-flex items-center gap-3 rounded-full border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] px-4 py-2 text-sm font-medium text-[color:var(--tm-text)]'>
                  <Wifi className='h-6 w-6' />
                  局域网直连
                </div>
                <h2 className='mt-5 flex items-center gap-3 text-[20px] md:text-[24px] font-medium tracking-normal text-[color:var(--tm-text)]'>
                  <QrCode className='h-10 w-10 text-[color:var(--tm-text)]' />
                  手机扫码遥控
                </h2>
                <p className='mt-4 text-base leading-relaxed text-[color:var(--tm-muted)]'>
                  在同一 Wi‑Fi 下用手机扫描二维码或打开遥控地址。
                </p>

                {localRemoteUrl ? (
                  <div className='mt-6 rounded-3xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-5'>
                    <div className='text-base font-medium text-[color:var(--tm-text)]'>
                      遥控地址
                    </div>
                    <div className='mt-2 break-all text-sm font-medium text-[color:var(--tm-text)]'>
                      {localRemoteUrl}
                    </div>
                  </div>
                ) : (
                  <div className='mt-6 rounded-3xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-5 text-sm leading-relaxed text-[color:var(--tm-text)]'>
                    当前页面未检测到 APK 内置局域网遥控服务。请使用新版 APK
                    打开电视端。
                  </div>
                )}
              </div>

              {localRemoteUrl && (
                <div
                  tabIndex={0}
                  role='img'
                  aria-label='局域网遥控地址二维码，手机扫码打开遥控器'
                  className='tv-focusable tv-focusable-light shrink-0 rounded-[32px] border border-[var(--tm-line)] bg-[var(--tm-surface)] p-4 shadow-lg outline-none'
                >
                  <img
                    src={`/api/auth/qr/image?data=${encodeURIComponent(
                      localRemoteUrl
                    )}`}
                    alt='局域网遥控地址二维码'
                    className='pointer-events-none h-64 w-64 rounded-2xl'
                    draggable={false}
                  />
                  <div className='mt-3 text-center text-base font-medium text-[color:var(--tm-text)]'>
                    手机扫码打开遥控器
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className='relative mt-10 rounded-[34px] border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-7'>
            <div className='flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'>
              <div className='max-w-2xl'>
                <div className='flex items-center gap-3 text-base font-medium text-[color:var(--tm-text)]'>
                  <SlidersHorizontal className='h-9 w-9 text-[color:var(--tm-text)]' />
                  偏好设置
                </div>
                <p className='mt-3 text-base leading-relaxed text-[color:var(--tm-muted)]'>
                  这些设置保存在当前电视设备上。
                </p>
              </div>

              <div className='w-full rounded-[28px] border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-6 lg:max-w-[560px]'>
                <div className='flex items-start justify-between gap-5'>
                  <div>
                    <h3 className='text-[18px] font-medium text-[color:var(--tm-text)]'>
                      播放页上下键功能
                    </h3>
                    <p className='mt-2 text-sm leading-relaxed text-[color:var(--tm-muted)]'>
                      播放页遥控器 ↑ / ↓ 键执行的操作。
                    </p>
                  </div>
                  <div className='shrink-0 rounded-2xl bg-[var(--tm-surface)] px-4 py-2 text-sm font-medium text-[color:var(--tm-text)]'>
                    {upDownAction === 'wake-menu' ? '唤醒菜单' : '音量控制'}
                  </div>
                </div>

                <div
                  data-tv-preference-up-down-action
                  onKeyDownCapture={handleUpDownActionKeyDown}
                  className='mt-5 grid gap-3 sm:grid-cols-2'
                >
                  <button
                    ref={wakeMenuButtonRef}
                    aria-pressed={upDownAction === 'wake-menu'}
                    type='button'
                    onClick={() => handleUpDownActionChange('wake-menu')}
                    className={`tv-focusable flex cursor-pointer items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-medium outline-none transition ${
                      upDownAction === 'wake-menu'
                        ? 'bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] shadow-lg shadow-[color-mix(in_srgb,var(--tm-room-cinema-bg)_40%,transparent)] min-h-[44px] tm-press'
                        : 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] hover:bg-[var(--tm-line)] min-h-[44px] tm-press'
                    }`}
                  >
                    <Menu className='h-6 w-6' />
                    唤醒菜单
                  </button>
                  <button
                    ref={volumeButtonRef}
                    aria-pressed={upDownAction === 'volume'}
                    type='button'
                    onClick={() => handleUpDownActionChange('volume')}
                    className={`tv-focusable flex cursor-pointer items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-medium outline-none transition ${
                      upDownAction === 'volume'
                        ? 'bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] shadow-lg shadow-[color-mix(in_srgb,var(--tm-room-cinema-bg)_40%,transparent)] min-h-[44px] tm-press'
                        : 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] hover:bg-[var(--tm-line)] min-h-[44px] tm-press'
                    }`}
                  >
                    <Volume2 className='h-6 w-6' />
                    音量控制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </TVLayout>
  );
}
