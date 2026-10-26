/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { motion } from 'framer-motion';
import { Check, Eye, EyeOff, Lock, Send, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import '@/styles/auth.css';

import { useReducedMotionSetting } from '@/lib/motion';
import { decodeQueryText, getSafeRedirect } from '@/lib/safe-redirect';

import AuthVersion from '@/components/auth/AuthVersion';
import PageContainer from '@/components/PageContainer';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// 根据按钮文本识别OIDC提供商并返回对应的图标
function getOIDCProviderIcon(buttonText: string) {
  const text = buttonText.toLowerCase();

  const providers = [
    { keywords: ['linuxdo'], icon: '/icons/linuxdo.png', alt: 'LinuxDo' },
    { keywords: ['github'], icon: '/icons/github.png', alt: 'GitHub' },
    { keywords: ['google'], icon: '/icons/google.png', alt: 'Google' },
    {
      keywords: ['microsoft', 'azure', 'entra'],
      icon: '/icons/microsoft.png',
      alt: 'Microsoft',
    },
    { keywords: ['gitlab'], icon: '/icons/gitlab.png', alt: 'GitLab' },
  ];

  for (const provider of providers) {
    if (provider.keywords.some((keyword) => text.includes(keyword))) {
      return <img src={provider.icon} alt={provider.alt} className='h-5 w-5' />;
    }
  }

  // 默认图标
  return (
    <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 20 20'>
      <path
        fillRule='evenodd'
        d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z'
        clipRule='evenodd'
      />
    </svg>
  );
}

function LoginPageClient() {
  const reduced = useReducedMotionSetting();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [siteConfig, setSiteConfig] = useState<any>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(
    null
  );
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [telegramLoginEnabled, setTelegramLoginEnabled] = useState(false);
  const [telegramLoginLoading, setTelegramLoginLoading] = useState(false);
  const [telegramLoginHint, setTelegramLoginHint] = useState<string | null>(
    null
  );

  const { siteName } = useSite();
  // Telegram 确认轮询；离开页面时必须停掉，否则迟到的“已确认”会把人从别的页面拉走
  const telegramTimerRef = useRef<number | null>(null);
  const stopTelegramPolling = () => {
    if (telegramTimerRef.current !== null) {
      window.clearInterval(telegramTimerRef.current);
      telegramTimerRef.current = null;
    }
  };
  useEffect(() => stopTelegramPolling, []);

  // 处理URL中的error参数
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeQueryText(errorParam));
    }
  }, [searchParams]);

  // 在客户端挂载后设置配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      const storageType = runtimeConfig?.STORAGE_TYPE;
      const shouldAsk = storageType && storageType !== 'localstorage';
      setShouldAskUsername(shouldAsk);

      // 设置背景图（支持多张随机选择）
      const loginBg = runtimeConfig?.LOGIN_BACKGROUND_IMAGE;
      if (loginBg) {
        const urls = loginBg
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
      setSiteConfig({
        LoginRequireTurnstile: runtimeConfig?.LOGIN_REQUIRE_TURNSTILE || false,
        TurnstileSiteKey: runtimeConfig?.TURNSTILE_SITE_KEY || '',
        EnableRegistration: runtimeConfig?.ENABLE_REGISTRATION || false,
        EnableOIDCLogin: runtimeConfig?.ENABLE_OIDC_LOGIN || false,
        OIDCButtonText: runtimeConfig?.OIDC_BUTTON_TEXT || '',
      });
      setTelegramLoginEnabled(Boolean(runtimeConfig?.ENABLE_TELEGRAM_LOGIN));

      // 从localStorage读取记住的密码信息
      const rememberedCredentials = localStorage.getItem(
        'rememberedCredentials'
      );
      if (rememberedCredentials) {
        try {
          const credentials = JSON.parse(rememberedCredentials);
          if (credentials.password) {
            setPassword(credentials.password);
          }
          if (credentials.username && shouldAsk) {
            setUsername(credentials.username);
          }
          setRememberPassword(true);
        } catch (error) {
          // 清除无效的数据
          localStorage.removeItem('rememberedCredentials');
        }
      }
    }
  }, []);

  // 加载Cloudflare Turnstile脚本
  useEffect(() => {
    if (!siteConfig?.LoginRequireTurnstile || !siteConfig?.TurnstileSiteKey) {
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

    if (!password || (shouldAskUsername && !username)) return;

    // 检查Turnstile验证
    if (siteConfig?.LoginRequireTurnstile && !turnstileToken) {
      setError('请完成人机验证');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
          ...(siteConfig?.LoginRequireTurnstile ? { turnstileToken } : {}),
        }),
      });

      if (res.ok) {
        // 处理记住密码逻辑
        if (rememberPassword) {
          const credentials: any = { password };
          // 如果需要用户名且有用户名，就保存用户名
          if (shouldAskUsername && username) {
            credentials.username = username;
          }
          localStorage.setItem(
            'rememberedCredentials',
            JSON.stringify(credentials)
          );
        } else {
          // 如果不记住密码，清除已存储的信息
          localStorage.removeItem('rememberedCredentials');
        }

        const redirect = getSafeRedirect(searchParams.get('redirect'));
        window.location.replace(redirect);
      } else {
        // 登录失败，重置Turnstile
        if (
          siteConfig?.LoginRequireTurnstile &&
          turnstileWidgetId !== null &&
          (window as any).turnstile
        ) {
          (window as any).turnstile.reset(turnstileWidgetId);
          setTurnstileToken(null);
        }

        // 服务器会说明具体原因（用户名或密码错误 / 账号被封 / 被临时限制及剩余时间），
        // 原样显示；读不到时才用兜底文案
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ?? (res.status === 401 ? '密码错误' : '服务器错误')
        );
      }
    } catch (error) {
      // 网络错误，重置Turnstile
      if (
        siteConfig?.LoginRequireTurnstile &&
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

  const handleTelegramLogin = async () => {
    setError(null);
    setTelegramLoginHint(null);

    try {
      setTelegramLoginLoading(true);
      const createRes = await fetch('/api/telegram/login/create', {
        method: 'POST',
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        const configDetail = createData.config
          ? `（enabled=${String(
              createData.config.enabled
            )}, loginEnabled=${String(
              createData.config.loginEnabled
            )}, hasBotToken=${String(
              createData.config.hasBotToken
            )}, hasBotUsername=${String(
              createData.config.hasBotUsername
            )}, botUsername=${createData.config.botUsername || '-'}）`
          : `（HTTP ${createRes.status}）`;
        setError(
          `${createData.error || 'Telegram 登录接口不可用'}${configDetail}`
        );
        return;
      }

      setTelegramLoginHint('请在 Telegram 中确认登录');
      window.open(createData.deepLink, '_blank', 'noopener,noreferrer');

      const startedAt = Date.now();
      stopTelegramPolling();
      const timer = window.setInterval(async () => {
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          stopTelegramPolling();
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('Telegram 登录已超时，请重试');
          return;
        }

        // 单次网络抖动不终止登录，下一轮继续查询
        let statusData: { status?: string } = {};
        try {
          const statusRes = await fetch(
            `/api/telegram/login/status?token=${encodeURIComponent(
              createData.token
            )}`
          );
          statusData = await statusRes.json().catch(() => ({}));
        } catch {
          return;
        }
        // 轮询已被停止（离开页面或重新发起）时，忽略这次迟到的结果
        if (telegramTimerRef.current !== timer) return;
        if (statusData.status === 'confirmed') {
          stopTelegramPolling();
          const redirect = getSafeRedirect(searchParams.get('redirect'));
          window.location.replace(redirect);
        } else if (statusData.status === 'denied') {
          stopTelegramPolling();
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('已拒绝 Telegram 登录');
        } else if (statusData.status === 'expired') {
          stopTelegramPolling();
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('Telegram 登录已过期');
        }
      }, 2000);
      telegramTimerRef.current = timer;
    } catch (error) {
      setError('Telegram 登录请求失败，请稍后重试');
      setTelegramLoginLoading(false);
      setTelegramLoginHint(null);
    }
  };

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
        <form onSubmit={handleSubmit} className='tm-auth-form'>
          {shouldAskUsername && (
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
          )}

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
                autoComplete='current-password'
                className='tm-input tm-auth-input'
                placeholder='输入访问密码'
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

          {/* Cloudflare Turnstile */}
          {siteConfig?.LoginRequireTurnstile &&
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

          {/* 记住密码复选框 */}
          <div className='relative flex min-h-[44px] items-center'>
            <input
              id='remember-password'
              type='checkbox'
              className='peer absolute left-0 top-0 z-10 m-0 h-11 w-11 cursor-pointer opacity-0'
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            <span
              aria-hidden
              className='pointer-events-none ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-muted bg-transparent text-transparent peer-checked:border-fg peer-checked:bg-fg peer-checked:text-inverse peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg'
            >
              <Check className='h-4 w-4' />
            </span>
            <label
              htmlFor='remember-password'
              className='ml-5 flex min-h-[44px] flex-1 items-center text-sm text-muted'
            >
              记住密码
            </label>
          </div>

          {/* 登录按钮 */}
          <button
            type='submit'
            disabled={
              !password ||
              loading ||
              (shouldAskUsername && !username) ||
              (siteConfig?.LoginRequireTurnstile && !turnstileToken)
            }
            className='tm-btn tm-btn-primary tm-btn-lg w-full'
          >
            {loading ? '登录中...' : '登录'}
          </button>

          {/* 注册按钮 */}
          {siteConfig?.EnableRegistration && shouldAskUsername && (
            <div className='text-center'>
              <button
                type='button'
                onClick={() => router.push('/register')}
                className='tm-auth-link'
              >
                还没有账号？立即注册
              </button>
            </div>
          )}
        </form>

        {/* 第三方登录区域 */}
        {shouldAskUsername &&
          (telegramLoginEnabled || siteConfig?.EnableOIDCLogin) && (
            <div className='tm-auth-alt'>
              <div className='tm-auth-divider'>
                <span>或</span>
              </div>
              <div className='space-y-3'>
                {/* Telegram登录按钮 */}
                {telegramLoginEnabled && (
                  <button
                    type='button'
                    disabled={telegramLoginLoading}
                    onClick={handleTelegramLogin}
                    className='tm-btn tm-btn-secondary tm-btn-lg w-full'
                  >
                    <Send size={18} aria-hidden />
                    {telegramLoginLoading
                      ? '等待 Telegram 确认...'
                      : '使用 Telegram 登录'}
                  </button>
                )}
                {telegramLoginHint && (
                  <p className='text-center text-[13px] text-muted'>
                    {telegramLoginHint}
                  </p>
                )}
                {/* OIDC登录按钮 */}
                {siteConfig?.EnableOIDCLogin && (
                  <button
                    type='button'
                    onClick={() =>
                      (window.location.href = '/api/auth/oidc/login')
                    }
                    className='tm-btn tm-btn-secondary tm-btn-lg w-full'
                  >
                    {getOIDCProviderIcon(siteConfig?.OIDCButtonText || '')}
                    {siteConfig?.OIDCButtonText || '使用OIDC登录'}
                  </button>
                )}
              </div>
            </div>
          )}
      </motion.div>

      {/* 版本信息显示 */}
      <AuthVersion />
    </PageContainer>
  );
}

export default function LoginPage() {
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
      <LoginPageClient />
    </Suspense>
  );
}
