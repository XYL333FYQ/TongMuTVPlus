/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
'use client';

// 由 UserMenu 拆出（按需加载）：账号菜单打开某个面板时才下载这部分代码。
// 面板用到的状态与处理函数全部仍由 UserMenu 持有，这里只负责渲染，行为与拆分前一致。

import { Copy, Monitor, Rss, Sliders, Smartphone, X } from 'lucide-react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export interface UserMenuSubscribePanelProps {
  closeTvQrScanner: () => void;
  copySuccess: boolean;
  handleCloseSubscribe: () => void;
  handleCopySubscribeUrl: () => Promise<void>;
  handleResetToken: () => Promise<void>;
  isLoadingSubscribeUrl: boolean;
  isResettingToken: boolean;
  isTvQrScannerOpen: boolean;
  setIsSubscribeOpen: Dispatch<SetStateAction<boolean>>;
  setIsTVRemoteOpen: Dispatch<SetStateAction<boolean>>;
  setSubscribeAdFilterEnabled: Dispatch<SetStateAction<boolean>>;
  setSubscribeYellowFilterEnabled: Dispatch<SetStateAction<boolean>>;
  setTvAccessTab: Dispatch<SetStateAction<'tvbox' | 'web'>>;
  startTvQrScanner: () => Promise<void>;
  subscribeAdFilterEnabled: boolean;
  subscribeEnabled: boolean;
  subscribeUrl: string;
  subscribeYellowFilterEnabled: boolean;
  tvAccessTab: 'tvbox' | 'web';
  tvModeEnabled: boolean;
  tvQrScannerError: string;
  tvQrScannerStatus: string;
  tvQrVideoRef: MutableRefObject<HTMLVideoElement | null>;
}

export default function UserMenuSubscribePanel(
  props: UserMenuSubscribePanelProps
) {
  const {
    closeTvQrScanner,
    copySuccess,
    handleCloseSubscribe,
    handleCopySubscribeUrl,
    handleResetToken,
    isLoadingSubscribeUrl,
    isResettingToken,
    isTvQrScannerOpen,
    setIsSubscribeOpen,
    setIsTVRemoteOpen,
    setSubscribeAdFilterEnabled,
    setSubscribeYellowFilterEnabled,
    setTvAccessTab,
    startTvQrScanner,
    subscribeAdFilterEnabled,
    subscribeEnabled,
    subscribeUrl,
    subscribeYellowFilterEnabled,
    tvAccessTab,
    tvModeEnabled,
    tvQrScannerError,
    tvQrScannerStatus,
    tvQrVideoRef,
  } = props;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-ink/60 backdrop-blur-sm z-[1000]'
        onClick={handleCloseSubscribe}
        onTouchMove={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 电视访问面板 */}
      <div className='fixed top-1/2 left-1/2 z-[1001] max-h-[92vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl shadow-ink/30'>
        <div
          className='max-h-[92vh] overflow-y-auto p-6 sm:p-7'
          data-panel-content
          onTouchMove={(e) => {
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto',
          }}
        >
          {isTvQrScannerOpen ? (
            <div className='relative -m-6 min-h-[72vh] overflow-hidden bg-surface sm:-m-7'>
              <video
                ref={tvQrVideoRef}
                className='absolute inset-0 h-full w-full object-cover'
                muted
                playsInline
              />
              <div className='pointer-events-none absolute inset-0 grid place-items-center'>
                <div className='h-64 w-64 rounded-xl border-4 border-line [box-shadow:0_0_0_9999px_rgba(0,0,0,0.58),0_0_30px_color-mix(in_srgb,var(--tm-text)_55%,transparent)] sm:h-80 sm:w-80' />
              </div>
              <div className='absolute left-0 right-0 top-0 flex items-start justify-between gap-4 bg-surface to-transparent p-5 text-fg sm:p-7'>
                <div>
                  <div className='inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-[13px] font-bold text-fg ring-1 ring-[color-mix(in_srgb,var(--tm-text)_20%,transparent)]'>
                    <Smartphone className='h-4 w-4' />
                    手机相机扫码
                  </div>
                  <h3 className='mt-3 text-2xl font-bold'>扫描电视二维码</h3>
                  <p className='mt-1 text-sm text-[color:color-mix(in_srgb,var(--tm-text)_75%,transparent)]'>
                    支持扫码登录，也支持打开局域网遥控器
                  </p>
                </div>
                <button
                  type='button'
                  onClick={closeTvQrScanner}
                  className='flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-raised text-fg backdrop-blur transition hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tm-text)_70%,transparent)] min-h-[44px] tm-press'
                  aria-label='关闭扫码'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='absolute bottom-0 left-0 right-0 bg-surface to-transparent p-5 sm:p-7'>
                {tvQrScannerStatus && (
                  <p className='rounded-2xl bg-raised px-4 py-3 text-center text-sm font-bold text-fg backdrop-blur'>
                    {tvQrScannerStatus}
                  </p>
                )}
                {tvQrScannerError && (
                  <p className='mt-3 rounded-2xl bg-raised px-4 py-3 text-center text-sm font-bold text-fg ring-1 ring-[color-mix(in_srgb,var(--tm-text)_20%,transparent)] backdrop-blur'>
                    {tvQrScannerError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 标题栏 */}
              <div className='mb-6 flex items-start justify-between gap-4'>
                <div>
                  <div className='inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-[13px] font-bold text-fg'>
                    <Monitor className='h-4 w-4' />
                    TV ACCESS
                  </div>
                  <h3 className='mt-3 text-2xl font-bold text-fg'>电视访问</h3>
                </div>
                <button
                  onClick={handleCloseSubscribe}
                  className='flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted transition hover:bg-line hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg min-h-[44px] tm-press'
                  aria-label='Close'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='mb-5 grid grid-cols-2 rounded-2xl bg-raised p-1'>
                {[
                  { key: 'tvbox' as const, label: 'TVBox 订阅', icon: Rss },
                  { key: 'web' as const, label: 'Web 电视', icon: Monitor },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = tvAccessTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type='button'
                      onClick={() => {
                        setTvAccessTab(item.key);
                        if (item.key !== 'web') closeTvQrScanner();
                      }}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tm-text)_70%,transparent)] ${
                        active
                          ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press'
                          : 'text-muted hover:text-fg min-h-[44px] tm-press'
                      }`}
                    >
                      <Icon className='h-4 w-4' />
                      <span className='hidden sm:inline'>{item.label}</span>
                      <span className='sm:hidden'>
                        {item.key === 'tvbox' ? 'TVBox' : 'Web'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {tvAccessTab === 'tvbox' && (
                <section className='rounded-2xl border border-line bg-raised p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                      <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-raised text-fg shadow-lg shadow-ink/25'>
                        <Rss className='h-5 w-5' />
                      </div>
                      <div>
                        <h4 className='text-lg font-bold text-fg'>
                          TVBox 订阅
                        </h4>
                        <p className='mt-1 text-sm text-muted'>
                          复制订阅链接到 TVBox 使用
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold ${
                        subscribeEnabled
                          ? 'bg-raised text-fg'
                          : 'bg-raised text-muted'
                      }`}
                    >
                      {subscribeEnabled ? '已启用' : '未启用'}
                    </span>
                  </div>

                  {!subscribeEnabled ? (
                    <div className='mt-5 rounded-xl border border-dashed border-line bg-raised px-4 py-3 text-sm font-medium text-muted'>
                      TVBox 订阅功能未启用
                    </div>
                  ) : isLoadingSubscribeUrl ? (
                    <div className='mt-5 space-y-3'>
                      <div className='h-14 tm-skeleton rounded-xl bg-raised' />
                      <div className='h-14 tm-skeleton rounded-xl bg-raised' />
                      <div className='h-10 tm-skeleton rounded-xl bg-raised' />
                    </div>
                  ) : (
                    <div className='mt-5 space-y-4'>
                      <div className='grid gap-3 sm:grid-cols-2'>
                        <button
                          type='button'
                          onClick={() =>
                            setSubscribeAdFilterEnabled((prev) => !prev)
                          }
                          className='flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-line min-h-[44px] tm-press'
                        >
                          <div>
                            <div className='text-sm font-bold text-fg'>
                              去广告
                            </div>
                            <div className='mt-1 text-[13px] text-muted'>
                              开启后通过代理处理播放链接
                            </div>
                          </div>
                          <span
                            className={`h-5 w-9 rounded-full p-0.5 transition ${
                              subscribeAdFilterEnabled ? 'bg-fg' : 'bg-surface'
                            }`}
                          >
                            <span
                              className={`block h-4 w-4 rounded-full bg-surface transition ${
                                subscribeAdFilterEnabled ? 'translate-x-4' : ''
                              }`}
                            />
                          </span>
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            setSubscribeYellowFilterEnabled((prev) => !prev)
                          }
                          className='flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-line min-h-[44px] tm-press'
                        >
                          <div>
                            <div className='text-sm font-bold text-fg'>
                              黄色过滤
                            </div>
                            <div className='mt-1 text-[13px] text-muted'>
                              过滤代理搜索中的黄色内容
                            </div>
                          </div>
                          <span
                            className={`h-5 w-9 rounded-full p-0.5 transition ${
                              subscribeYellowFilterEnabled
                                ? 'bg-fg'
                                : 'bg-surface'
                            }`}
                          >
                            <span
                              className={`block h-4 w-4 rounded-full bg-surface transition ${
                                subscribeYellowFilterEnabled
                                  ? 'translate-x-4'
                                  : ''
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      <div>
                        <h4 className='mb-2 text-sm font-medium text-muted'>
                          订阅链接
                        </h4>
                        <div className='flex gap-2'>
                          <input
                            type='text'
                            className='min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fg text-fg'
                            value={subscribeUrl}
                            readOnly
                          />
                          <button
                            onClick={handleCopySubscribeUrl}
                            className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-sm font-bold text-inverse transition hover:opacity-90 min-h-[44px] tm-press'
                          >
                            <Copy className='h-4 w-4' />
                            {copySuccess ? '已复制' : '复制'}
                          </button>
                        </div>
                        {(subscribeAdFilterEnabled ||
                          subscribeYellowFilterEnabled) && (
                          <p className='mt-2 rounded-xl border border-line bg-raised px-3 py-2 text-[13px] font-medium text-fg'>
                            💡
                            代理模式已开启，某些源可能因为区域或兼容问题无法播放
                          </p>
                        )}
                      </div>

                      <div className='pt-1'>
                        <button
                          onClick={handleResetToken}
                          disabled={isResettingToken}
                          className='w-full cursor-pointer rounded-xl bg-fg px-4 py-2.5 text-sm font-bold text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] tm-press'
                        >
                          {isResettingToken ? '重置中...' : '重置订阅Token'}
                        </button>
                        <p className='mt-2 text-center text-[13px] text-muted'>
                          ⚠️ 重置后旧链接将失效
                        </p>
                        <p
                          id='tvbox-token-message'
                          className='hidden text-center text-[13px]'
                        ></p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {tvAccessTab === 'web' && (
                <section className='rounded-2xl border border-line bg-raised p-5'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-raised text-fg shadow-lg shadow-ink/25'>
                      <Monitor className='h-5 w-5' />
                    </div>
                    <div>
                      <h4 className='text-lg font-bold text-fg'>Web 电视</h4>
                      <p className='mt-1 text-sm text-muted'>
                        手机扫描电视屏幕二维码并确认登录
                      </p>
                    </div>
                  </div>
                  <p className='mt-5 text-sm leading-6 text-muted'>
                    {tvModeEnabled
                      ? '电视端打开 /tv 后可扫码登录；在电视端“我的”页也可扫描局域网遥控二维码。'
                      : '当前部署未开启 TV 模式，/tv 页面和 Web 电视遥控不可用。'}
                  </p>
                  {!tvModeEnabled && (
                    <div className='mt-5 rounded-2xl border border-line bg-raised px-4 py-3 text-sm font-bold text-fg'>
                      TV 模式未开启。请在环境变量中设置 ENABLE_TV_MODE=true
                      后重启服务。
                    </div>
                  )}
                  <div className='mt-5 grid gap-2 sm:grid-cols-2'>
                    <button
                      type='button'
                      onClick={startTvQrScanner}
                      disabled={!tvModeEnabled}
                      className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-fg px-4 py-3 text-sm font-bold text-inverse transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tm-text)_70%,transparent)] disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted min-h-[44px] tm-press'
                    >
                      打开相机扫码
                      <Smartphone className='h-4 w-4' />
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        if (!tvModeEnabled) return;
                        setIsSubscribeOpen(false);
                        setIsTVRemoteOpen(true);
                      }}
                      disabled={!tvModeEnabled}
                      className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-raised px-4 py-3 text-sm font-bold text-fg transition hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tm-text)_70%,transparent)] disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted min-h-[44px] tm-press'
                    >
                      <Sliders className='h-4 w-4' />
                      远程电视遥控器
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
