/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Send,
  User,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';
import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import PageContainer from '@/components/PageContainer';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// 版本显示组件
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <button
      onClick={() => window.open('/about', '_self')}
      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-sm text-[color:var(--tm-muted)] transition-colors cursor-pointer min-h-[44px] active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] '
    >
      <span className='[font-family:var(--tm-font-sans)]'>
        v{CURRENT_VERSION}
      </span>
      {!isChecking &&
        updateStatus !== UpdateStatus.FETCH_FAILED &&
        updateStatus !== UpdateStatus.NOT_CONFIGURED && (
          <div
            className={`flex items-center gap-1.5 ${
              updateStatus === UpdateStatus.HAS_UPDATE
                ? 'text-[color:var(--tm-text)]'
                : updateStatus === UpdateStatus.NO_UPDATE
                ? 'text-[color:var(--tm-text)]'
                : ''
            }`}
          >
            {updateStatus === UpdateStatus.HAS_UPDATE && (
              <>
                <AlertCircle className='w-3.5 h-3.5' />
                <span className='font-medium text-[13px]'>有新版本</span>
              </>
            )}
            {updateStatus === UpdateStatus.NO_UPDATE && (
              <>
                <CheckCircle className='w-3.5 h-3.5' />
                <span className='font-medium text-[13px]'>已是最新</span>
              </>
            )}
          </div>
        )}
    </button>
  );
}

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
      return (
        <img src={provider.icon} alt={provider.alt} className='w-5 h-5 mr-2' />
      );
    }
  }

  // 默认图标
  return (
    <svg className='w-5 h-5 mr-2' fill='currentColor' viewBox='0 0 20 20'>
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

  // 处理URL中的error参数
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
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

        const redirect = searchParams.get('redirect') || '/';
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

        if (res.status === 401) {
          setError('密码错误');
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? '服务器错误');
        }
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
      const timer = window.setInterval(async () => {
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          window.clearInterval(timer);
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('Telegram 登录已超时，请重试');
          return;
        }

        const statusRes = await fetch(
          `/api/telegram/login/status?token=${encodeURIComponent(
            createData.token
          )}`
        );
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.status === 'confirmed') {
          window.clearInterval(timer);
          const redirect = searchParams.get('redirect') || '/';
          window.location.replace(redirect);
        } else if (statusData.status === 'denied') {
          window.clearInterval(timer);
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('已拒绝 Telegram 登录');
        } else if (statusData.status === 'expired') {
          window.clearInterval(timer);
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('Telegram 登录已过期');
        }
      }, 2000);
    } catch (error) {
      setError('Telegram 登录请求失败，请稍后重试');
      setTelegramLoginLoading(false);
      setTelegramLoginHint(null);
    }
  };

  return (
    <PageContainer
      className='relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--tm-bg)] text-[color:var(--tm-text)]'
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
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <motion.div
        className='tm-enter relative z-10 w-full max-w-md rounded-3xl bg-[var(--tm-surface)] shadow-2xl p-10 dark:border border-[var(--tm-line)]'
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduced ? 0.12 : 0.36,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <h1 className='text-[color:var(--tm-text)] tracking-normal text-center text-[28px] font-bold mb-8 bg-clip-text drop-shadow-sm md:text-[32px]'>
          {siteName}
        </h1>
        <form onSubmit={handleSubmit} className='space-y-8'>
          {shouldAskUsername && (
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
                  <User className='h-5 w-5 text-[color:var(--tm-muted)]' />
                </div>
                <input
                  id='username'
                  type='text'
                  autoComplete='username'
                  className='block min-h-[48px] w-full rounded-[10px] border-0 bg-[var(--tm-surface-raised)] py-3 pl-10 pr-4 text-base text-[color:var(--tm-text)] shadow-sm ring-1 ring-[var(--tm-line)] placeholder:text-[color:var(--tm-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--tm-text)] focus:ring-[var(--tm-line)]'
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
              <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
                <Lock className='h-5 w-5 text-[color:var(--tm-muted)]' />
              </div>
              <input
                id='password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                className='block min-h-[48px] w-full rounded-[10px] border-0 bg-[var(--tm-surface-raised)] py-3 pl-10 pr-12 text-base text-[color:var(--tm-text)] shadow-sm ring-1 ring-[var(--tm-line)] placeholder:text-[color:var(--tm-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--tm-text)] focus:ring-[var(--tm-line)]'
                placeholder='输入访问密码'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type='button'
                className='absolute inset-y-0 right-0 flex min-h-[44px] w-11 items-center justify-center text-[color:var(--tm-muted)] hover:text-[color:var(--tm-text)] tm-press'
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
            <p role='alert' className='text-sm text-[color:var(--tm-text)]'>
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
              className='pointer-events-none ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--tm-line)] bg-[var(--tm-bg)] text-[color:var(--tm-bg)] peer-checked:border-[var(--tm-text)] peer-checked:bg-[var(--tm-text)] peer-checked:text-[color:var(--tm-accent-contrast)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--tm-text)]'
            >
              <Check className='h-4 w-4' />
            </span>
            <label
              htmlFor='remember-password'
              className='ml-5 flex min-h-[44px] flex-1 items-center text-sm text-[color:var(--tm-muted)]'
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
            className='inline-flex w-full justify-center rounded-lg bg-[var(--tm-text)] py-3 text-base font-medium text-[color:var(--tm-accent-contrast)] shadow-lg transition-[transform,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] tm-press'
          >
            {loading ? '登录中...' : '登录'}
          </button>

          {/* 注册按钮 */}
          {siteConfig?.EnableRegistration && shouldAskUsername && (
            <div className='text-center'>
              <button
                type='button'
                onClick={() => router.push('/register')}
                className='text-sm text-[color:var(--tm-text)] hover:text-[color:var(--tm-text)] transition-colors min-h-[44px] tm-press'
              >
                还没有账号？立即注册
              </button>
            </div>
          )}
        </form>

        {/* 第三方登录区域 */}
        {shouldAskUsername &&
          (telegramLoginEnabled || siteConfig?.EnableOIDCLogin) && (
            <div className='mt-6'>
              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <div className='w-full border-t border-[var(--tm-line)]'></div>
                </div>
                <div className='relative flex justify-center text-sm'>
                  <span className='px-2 text-[color:var(--tm-muted)]'>或</span>
                </div>
              </div>
              <div className='mt-4 space-y-3'>
                {/* Telegram登录按钮 */}
                {telegramLoginEnabled && (
                  <button
                    type='button'
                    disabled={telegramLoginLoading}
                    onClick={handleTelegramLogin}
                    className='w-full inline-flex justify-center items-center rounded-lg border-2 border-[var(--tm-line)] bg-[var(--tm-surface-raised)] py-3 text-base font-medium text-[color:var(--tm-text)] shadow-sm transition-[transform,opacity] duration-200 hover:bg-[var(--tm-line)] disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] tm-press'
                  >
                    <Send className='w-5 h-5 mr-2' />
                    {telegramLoginLoading
                      ? '等待 Telegram 确认...'
                      : '使用 Telegram 登录'}
                  </button>
                )}
                {telegramLoginHint && (
                  <p className='text-center text-[13px] text-[color:var(--tm-muted)]'>
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
                    className='w-full inline-flex justify-center items-center rounded-lg border-2 border-[var(--tm-line)] bg-[var(--tm-surface-raised)] py-3 text-base font-medium text-[color:var(--tm-muted)] text-[color:var(--tm-text)] shadow-sm transition-[transform,opacity] duration-200 hover:bg-[var(--tm-line)] min-h-[44px] tm-press'
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
      <VersionDisplay />
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
