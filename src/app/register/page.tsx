/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Eye, EyeOff, Lock, Send, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import '@/styles/auth.css';

import { useReducedMotionSetting } from '@/lib/motion';

import AuthVersion from '@/components/auth/AuthVersion';
import PageContainer from '@/components/PageContainer';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function RegisterPageClient() {
  const reduced = useReducedMotionSetting();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [siteConfig, setSiteConfig] = useState<any>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(
    null
  );
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [telegramBind, setTelegramBind] = useState<{
    code: string;
    deepLink?: string;
  } | null>(null);

  const { siteName } = useSite();

  // 在客户端挂载后设置配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).RUNTIME_CONFIG;

      // 设置背景图（支持多张随机选择）
      const registerBg = runtimeConfig?.REGISTER_BACKGROUND_IMAGE;
      if (registerBg) {
        const urls = registerBg
          .split('\n')
          .map((url: string) => url.trim())
          .filter((url: string) => url !== '');

        if (urls.length > 0) {
          // 随机选择一张背景图
          const randomIndex = Math.floor(Math.random() * urls.length);
          setBackgroundImage(urls[randomIndex]);
        }
      }

      // 设置站点配置
      const config = {
        EnableRegistration: runtimeConfig?.ENABLE_REGISTRATION || false,
        RequireRegistrationInviteCode:
          runtimeConfig?.REQUIRE_REGISTRATION_INVITE_CODE || false,
        RegistrationRequireTurnstile:
          runtimeConfig?.REGISTRATION_REQUIRE_TURNSTILE || false,
        TurnstileSiteKey: runtimeConfig?.TURNSTILE_SITE_KEY || '',
      };
      setSiteConfig(config);

      // 如果未开启注册，重定向到登录页
      if (!config.EnableRegistration) {
        router.replace('/login');
      }
    }
  }, [router]);

  // 加载Cloudflare Turnstile脚本
  useEffect(() => {
    if (
      !siteConfig?.RegistrationRequireTurnstile ||
      !siteConfig?.TurnstileSiteKey
    ) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setTurnstileLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [siteConfig]);

  // 渲染Turnstile组件
  useEffect(() => {
    if (!turnstileLoaded || !siteConfig?.TurnstileSiteKey) {
      return;
    }

    const container = document.getElementById('turnstile-container');
    if (container && (window as any).turnstile) {
      const widgetId = (window as any).turnstile.render(
        '#turnstile-container',
        {
          sitekey: siteConfig.TurnstileSiteKey,
          callback: (token: string) => {
            setTurnstileToken(token);
          },
        }
      );
      setTurnstileWidgetId(widgetId);
    }
  }, [turnstileLoaded, siteConfig]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!username || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (siteConfig?.RequireRegistrationInviteCode && !inviteCode.trim()) {
      setError('请输入邀请码');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    // 检查Turnstile验证
    if (siteConfig?.RegistrationRequireTurnstile && !turnstileToken) {
      setError('请完成人机验证');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          inviteCode: siteConfig?.RequireRegistrationInviteCode
            ? inviteCode.trim()
            : undefined,
          turnstileToken: siteConfig?.RegistrationRequireTurnstile
            ? turnstileToken
            : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.telegramBind?.code) {
          setTelegramBind({
            code: data.telegramBind.code,
            deepLink: data.telegramBind.deepLink || '',
          });
          setRegisterSuccess(true);
          return;
        }

        // 注册成功，跳转到登录页
        const redirect = searchParams.get('redirect') || '/login';
        router.replace(redirect);
      } else {
        // 注册失败，重置Turnstile
        if (
          siteConfig?.RegistrationRequireTurnstile &&
          turnstileWidgetId !== null &&
          (window as any).turnstile
        ) {
          (window as any).turnstile.reset(turnstileWidgetId);
          setTurnstileToken(null);
        }

        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || '注册失败');
        } else if (res.status === 409) {
          setError('用户名已存在');
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? '服务器错误');
        }
      }
    } catch (error) {
      // 网络错误，重置Turnstile
      if (
        siteConfig?.RegistrationRequireTurnstile &&
        turnstileWidgetId !== null &&
        (window as any).turnstile
      ) {
        (window as any).turnstile.reset(turnstileWidgetId);
        setTurnstileToken(null);
      }
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 如果配置未加载或未开启注册，显示加载中
  if (!siteConfig) {
    return (
      <PageContainer className='relative flex min-h-screen items-center justify-center'>
        <div
          className='tm-skeleton h-8 w-32 rounded-lg'
          role='status'
          aria-label='正在加载'
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      className='tm-auth'
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : undefined
      }
    >
      <div className='tm-auth-theme'>
        <ThemeToggle />
      </div>
      <motion.div
        className='tm-auth-card'
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduced ? 0.12 : 0.36,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <h1 className='tm-auth-title'>{siteName}</h1>
        <p className='tm-auth-sub'>创建新账号</p>
        {registerSuccess ? (
          <div className='space-y-5'>
            <div className='tm-auth-note'>
              <div className='mb-2 flex items-center gap-2 font-medium'>
                <CheckCircle className='h-5 w-5' />
                注册成功
              </div>
              <p className='text-sm'>
                账号已创建。你可以现在绑定
                Telegram，用于接收通知和后续快捷登录。
              </p>
            </div>

            {telegramBind && (
              <div className='tm-auth-note'>
                <div className='mb-3 flex items-center gap-2 font-medium'>
                  <Send className='h-5 w-5' />
                  Telegram 绑定
                </div>
                <p className='text-sm'>在 Bot 中发送：</p>
                <div className='tm-auth-code'>/bind {telegramBind.code}</div>
                {telegramBind.deepLink && (
                  <button
                    type='button'
                    onClick={() =>
                      window.open(
                        telegramBind.deepLink,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                    className='tm-btn tm-btn-primary mb-3 w-full'
                  >
                    打开 Telegram
                  </button>
                )}
                <p className='text-[13px] text-muted'>
                  绑定码 10 分钟内有效，也可稍后登录后在通知设置中重新生成。
                </p>
              </div>
            )}

            <button
              type='button'
              onClick={() =>
                router.replace(searchParams.get('redirect') || '/login')
              }
              className='tm-btn tm-btn-primary tm-btn-lg w-full'
            >
              前往登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='tm-auth-form'>
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <div className='relative'>
                <div className='tm-auth-field-icon'>
                  <User size={18} />
                </div>
                <input
                  id='username'
                  type='text'
                  autoComplete='username'
                  className='tm-input tm-auth-input'
                  placeholder='输入用户名'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor='password' className='sr-only'>
                密码
              </label>
              <div className='relative'>
                <div className='tm-auth-field-icon'>
                  <Lock size={18} />
                </div>
                <input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  autoComplete='new-password'
                  className='tm-input tm-auth-input'
                  placeholder='输入密码（至少6位）'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type='button'
                  className='tm-auth-reveal'
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? (
                    <EyeOff className='h-5 w-5' />
                  ) : (
                    <Eye className='h-5 w-5' />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor='confirmPassword' className='sr-only'>
                确认密码
              </label>
              <div className='relative'>
                <div className='tm-auth-field-icon'>
                  <Lock size={18} />
                </div>
                <input
                  id='confirmPassword'
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete='new-password'
                  className='tm-input tm-auth-input'
                  placeholder='再次输入密码'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type='button'
                  className='tm-auth-reveal'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? '隐藏确认密码' : '显示确认密码'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className='h-5 w-5' />
                  ) : (
                    <Eye className='h-5 w-5' />
                  )}
                </button>
              </div>
            </div>

            {siteConfig?.RequireRegistrationInviteCode && (
              <div>
                <label htmlFor='inviteCode' className='sr-only'>
                  邀请码
                </label>
                <div className='relative'>
                  <div className='tm-auth-field-icon'>
                    <User size={18} />
                  </div>
                  <input
                    id='inviteCode'
                    type='text'
                    className='tm-input tm-auth-input'
                    placeholder='输入邀请码'
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Cloudflare Turnstile */}
            {siteConfig?.RegistrationRequireTurnstile &&
              siteConfig?.TurnstileSiteKey && (
                <div
                  id='turnstile-container'
                  className='flex justify-center'
                ></div>
              )}

            {error && (
              <p role='alert' className='tm-auth-error'>
                {error}
              </p>
            )}

            {/* 注册按钮 */}
            <button
              type='submit'
              disabled={
                !username ||
                !password ||
                !confirmPassword ||
                loading ||
                (siteConfig?.RequireRegistrationInviteCode &&
                  !inviteCode.trim()) ||
                (siteConfig?.RegistrationRequireTurnstile && !turnstileToken)
              }
              className='tm-btn tm-btn-primary tm-btn-lg w-full'
            >
              {loading ? '注册中...' : '注册'}
            </button>

            {/* 返回登录链接 */}
            <div className='text-center'>
              <button
                type='button'
                onClick={() => router.push('/login')}
                className='tm-auth-link'
              >
                已有账号？返回登录
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* 版本信息显示 */}
      <AuthVersion />
    </PageContainer>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className='flex min-h-screen items-center justify-center'>
          <div
            className='tm-skeleton h-8 w-32 rounded-lg'
            role='status'
            aria-label='正在加载'
          />
        </PageContainer>
      }
    >
      <RegisterPageClient />
    </Suspense>
  );
}
