'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { fadeUp, useReducedMotionSetting } from '@/lib/motion';
import { CURRENT_VERSION } from '@/lib/version';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function OIDCRegisterPageClient() {
  const router = useRouter();
  const reducedMotion = useReducedMotionSetting();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oidcInfo, setOidcInfo] = useState<any>(null);

  const { siteName } = useSite();

  // 检查OIDC session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/oidc/session-info');
        if (res.ok) {
          const data = await res.json();
          setOidcInfo(data);
        } else {
          // session无效,跳转到登录页
          router.replace(
            '/login?error=' + encodeURIComponent('OIDC会话已过期')
          );
        }
      } catch (error) {
        console.error('检查session失败:', error);
        router.replace('/login');
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!username) {
      setError('请输入用户名');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/oidc/complete-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        // 注册成功，接口已写入认证 cookie，这里用整页跳转确保权限配置和登录态完全重建
        window.location.replace('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '注册失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!oidcInfo) {
    return (
      <div className='relative min-h-screen flex items-center justify-center px-4'>
        <div
          role='status'
          aria-label='加载中'
          className='tm-skeleton h-48 w-full max-w-md rounded-3xl'
        >
          <span className='sr-only'>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className='relative min-h-dvh flex items-center justify-center px-[var(--tm-content-gutter)] py-20 bg-[var(--tm-bg)] text-[color:var(--tm-text)]'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <motion.div
        custom={reducedMotion}
        variants={fadeUp}
        initial='hidden'
        animate='visible'
        className='tm-enter relative z-10 w-full max-w-md rounded-3xl bg-[var(--tm-surface)] shadow-xl p-6 sm:p-10 dark:border border-[var(--tm-line)]'
      >
        <h1 className='text-[color:var(--tm-text)] tracking-normal text-center text-[28px] md:text-[32px] font-bold mb-2'>
          {siteName}
        </h1>
        <p className='text-center text-sm text-[color:var(--tm-muted)] mb-8'>
          完成OIDC注册
        </p>

        {/* OIDC信息显示 */}
        {oidcInfo && (
          <div className='mb-6 p-4 bg-[var(--tm-surface-raised)] border border-[var(--tm-line)] rounded-lg'>
            <p className='text-sm text-[color:var(--tm-text)]'>
              {oidcInfo.email && (
                <>
                  邮箱: <strong>{oidcInfo.email}</strong>
                  <br />
                </>
              )}
              {oidcInfo.name && (
                <>
                  名称: <strong>{oidcInfo.name}</strong>
                  <br />
                </>
              )}
              {oidcInfo.trust_level !== undefined && (
                <>
                  信任等级: <strong>{oidcInfo.trust_level}</strong>
                </>
              )}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <label
              htmlFor='username'
              className='block text-sm font-medium text-[color:var(--tm-muted)] mb-2'
            >
              选择用户名
            </label>
            <input
              id='username'
              type='text'
              autoComplete='username'
              className='block min-h-[44px] w-full rounded-lg border-0 py-3 px-4 text-base text-[color:var(--tm-text)] shadow-sm ring-1 ring-[var(--tm-line)] placeholder:text-[color:var(--tm-muted)] focus:ring-2 focus:ring-[var(--tm-text)] focus:outline-none bg-[var(--tm-surface-raised)]'
              placeholder='输入用户名（3-20位字母、数字、下划线）'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className='mt-2 text-[13px] leading-relaxed text-[color:var(--tm-muted)]'>
              用户名只能包含字母、数字、下划线，长度3-20位
            </p>
          </div>

          {error && (
            <p role='alert' className='text-sm text-[color:var(--tm-text)]'>
              {error}
            </p>
          )}

          <button
            type='submit'
            disabled={!username || loading}
            className='inline-flex w-full justify-center rounded-lg bg-[var(--tm-text)] py-3 text-base font-medium text-[color:var(--tm-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] tm-press'
          >
            {loading ? '注册中...' : '完成注册'}
          </button>

          {/* 返回登录链接 */}
          <div className='text-center'>
            <button
              type='button'
              onClick={() => router.push('/login')}
              className='text-sm text-[color:var(--tm-text)] hover:text-[color:var(--tm-text)] transition-colors min-h-[44px] tm-press'
            >
              返回登录
            </button>
          </div>
        </form>
      </motion.div>

      {/* 版本信息 */}
      <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[13px] text-[color:var(--tm-muted)]'>
        <span>v{CURRENT_VERSION}</span>
      </div>
    </div>
  );
}

export default function OIDCRegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OIDCRegisterPageClient />
    </Suspense>
  );
}
