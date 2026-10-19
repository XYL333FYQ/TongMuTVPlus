'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import '@/styles/auth.css';

import { fadeUp, useReducedMotionSetting } from '@/lib/motion';

import AuthVersion from '@/components/auth/AuthVersion';
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
      <div className='tm-auth'>
        <div
          role='status'
          aria-label='加载中'
          className='tm-auth-card tm-skeleton h-72'
        >
          <span className='sr-only'>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className='tm-auth'>
      <div className='tm-auth-theme'>
        <ThemeToggle />
      </div>
      <motion.div
        custom={reducedMotion}
        variants={fadeUp}
        initial='hidden'
        animate='visible'
        className='tm-auth-card'
      >
        <h1 className='tm-auth-title'>{siteName}</h1>
        <p className='tm-auth-sub'>完成 OIDC 注册</p>

        {/* OIDC信息显示 */}
        {oidcInfo && (
          <div className='tm-auth-note mb-6'>
            <p className='text-sm'>
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

        <form onSubmit={handleSubmit} className='tm-auth-form'>
          <div>
            <label htmlFor='username' className='tm-field-label'>
              选择用户名
            </label>
            <input
              id='username'
              type='text'
              autoComplete='username'
              className='tm-input tm-auth-input tm-auth-input-plain'
              placeholder='输入用户名（3-20位字母、数字、下划线）'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className='mt-2 text-[13px] leading-relaxed text-muted'>
              用户名只能包含字母、数字、下划线，长度3-20位
            </p>
          </div>

          {error && (
            <p role='alert' className='tm-auth-error'>
              {error}
            </p>
          )}

          <button
            type='submit'
            disabled={!username || loading}
            className='tm-btn tm-btn-primary tm-btn-lg w-full'
          >
            {loading ? '注册中...' : '完成注册'}
          </button>

          {/* 返回登录链接 */}
          <div className='text-center'>
            <button
              type='button'
              onClick={() => router.push('/login')}
              className='tm-auth-link'
            >
              返回登录
            </button>
          </div>
        </form>
      </motion.div>

      <AuthVersion />
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
