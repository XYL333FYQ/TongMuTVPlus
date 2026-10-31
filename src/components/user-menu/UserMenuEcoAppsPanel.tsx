/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
'use client';

// 由 UserMenu 拆出（按需加载）：账号菜单打开某个面板时才下载这部分代码。
// 面板用到的状态与处理函数全部仍由 UserMenu 持有，这里只负责渲染，行为与拆分前一致。

import { Download, Monitor, Rss, Smartphone, X } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import { BRAND_NAME } from '@/lib/brand';
import type { ClientPlatform } from '@/lib/client-downloads';
import { CLIENT_PACKAGES, clientDownloadUrl } from '@/lib/client-downloads';

export interface UserMenuEcoAppsPanelProps {
  clientBase: unknown;
  clientGroups: { platform: ClientPlatform; title: string }[];
  detectedPlatform: ClientPlatform | null;
  handleSubscribe: () => Promise<void>;
  setIsEcoAppsOpen: Dispatch<SetStateAction<boolean>>;
}

export default function UserMenuEcoAppsPanel(props: UserMenuEcoAppsPanelProps) {
  const {
    clientBase,
    clientGroups,
    detectedPlatform,
    handleSubscribe,
    setIsEcoAppsOpen,
  } = props;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-ink/50 backdrop-blur-sm z-[1000]'
        onClick={() => setIsEcoAppsOpen(false)}
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

      {/* 客户端安装指南面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-surface rounded-xl shadow-xl z-[1001] overflow-hidden border border-line'>
        <div
          className='h-full max-h-[85vh] flex flex-col'
          data-panel-content
          onTouchMove={(e) => {
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto',
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between p-6 border-b border-line'>
            <div>
              <h3 className='text-xl font-bold text-fg'>客户端安装指南</h3>
              <p className='mt-1 text-sm text-muted'>
                优先使用原生客户端；没有对应安装包的系统，可以用浏览器安装到主屏幕
              </p>
            </div>
            <button
              onClick={() => setIsEcoAppsOpen(false)}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 平台安装说明列表 */}
          <div className='flex-1 overflow-y-auto p-6'>
            <div className='grid gap-4'>
              {/* 原生客户端安装包 */}
              <div className='bg-raised rounded-lg p-5 border border-line'>
                <div className='flex flex-wrap items-center gap-2 mb-1.5'>
                  <h4 className='text-base font-bold text-fg'>原生客户端</h4>
                  <span className='shrink-0 whitespace-nowrap px-2 py-0.5 bg-surface border border-line text-fg text-[12px] font-medium rounded-full'>
                    推荐
                  </span>
                </div>
                <p className='text-sm text-muted leading-6 mb-4'>
                  首次打开时填写本站地址即可，之后网站更新会自动同步，不用重新安装。
                </p>
                <div className='grid gap-4'>
                  {clientGroups.map((group) => (
                    <div key={group.platform}>
                      <div className='mb-2 flex items-center gap-2 text-sm font-medium text-fg'>
                        {group.title}
                        {detectedPlatform === group.platform && (
                          <span className='px-2 py-0.5 border border-line text-muted text-[12px] rounded-full'>
                            你的设备
                          </span>
                        )}
                      </div>
                      <div className='grid gap-2'>
                        {CLIENT_PACKAGES.filter(
                          (item) => item.platform === group.platform
                        ).map((item) => (
                          <a
                            key={item.file}
                            href={clientDownloadUrl(item.file, clientBase)}
                            download
                            rel='noopener'
                            className='flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 min-h-[44px] hover:border-fg transition-colors tm-press'
                          >
                            <Download className='w-5 h-5 shrink-0 text-fg' />
                            <span className='min-w-0 flex-1'>
                              <span className='block text-sm font-medium text-fg'>
                                {item.label}
                              </span>
                              <span className='block text-[13px] text-muted'>
                                {item.hint}
                              </span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className='mt-4 text-[13px] text-muted leading-6'>
                  iPhone、iPad 和 Mac
                  暂无原生客户端，请用下面的浏览器方式添加到主屏幕。
                </p>
              </div>

              {/* 电脑桌面端 */}
              <div className='bg-raised rounded-lg p-5 border border-line'>
                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center text-fg'>
                    <Monitor className='w-6 h-6' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 mb-1.5'>
                      <h4 className='text-base font-bold text-fg'>
                        浏览器安装：电脑（Windows / macOS）
                      </h4>
                      <span className='shrink-0 whitespace-nowrap px-2 py-0.5 bg-surface border border-line text-fg text-[12px] font-medium rounded-full'>
                        推荐
                      </span>
                    </div>
                    <p className='text-sm text-muted leading-6'>
                      使用 Chrome 或 Edge 浏览器打开本站，点击浏览器地址栏右侧的
                      <strong className='text-fg font-medium'>
                        「安装 {BRAND_NAME}」
                      </strong>
                      图标，即可生成独立的桌面应用窗口与快捷方式，完整支持「一起看」同步观影房间与全部功能。
                    </p>
                  </div>
                </div>
              </div>

              {/* 手机与平板端 */}
              <div className='bg-raised rounded-lg p-5 border border-line'>
                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center text-fg'>
                    <Smartphone className='w-6 h-6' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <h4 className='text-base font-bold text-fg mb-1.5'>
                      浏览器安装：手机与平板（iOS / Android）
                    </h4>
                    <div className='space-y-1.5 text-sm text-muted leading-6'>
                      <p>
                        <strong className='text-fg font-medium'>
                          iPhone / iPad：
                        </strong>
                        使用 Safari 浏览器打开本站，点击底部「分享」按钮，选择
                        <strong className='text-fg font-medium'>
                          「添加到主屏幕」
                        </strong>
                        即可生成独立全屏应用。
                      </p>
                      <p>
                        <strong className='text-fg font-medium'>
                          Android 设备：
                        </strong>
                        使用 Chrome 或 Edge 浏览器打开本站，点击菜单选择
                        <strong className='text-fg font-medium'>
                          「安装应用」或「添加到主屏幕」
                        </strong>
                        。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 电视大屏端 */}
              <div className='bg-raised rounded-lg p-5 border border-line'>
                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center text-fg'>
                    <Rss className='w-6 h-6' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <h4 className='text-base font-bold text-fg mb-1.5'>
                      电视大屏端（Web 电视 / TVBox）
                    </h4>
                    <p className='text-sm text-muted leading-6 mb-3'>
                      智能电视浏览器可直接访问本站{' '}
                      <code className='px-1.5 py-0.5 rounded bg-surface text-fg text-[13px]'>
                        /tv
                      </code>{' '}
                      路径进入大屏遥控模式，并用手机扫码登录；或通过「电视访问」复制专属订阅地址到
                      TVBox 使用。
                    </p>
                    <button
                      type='button'
                      onClick={() => {
                        setIsEcoAppsOpen(false);
                        void handleSubscribe();
                      }}
                      className='inline-flex items-center gap-2 px-4 py-2 bg-fg hover:opacity-90 text-inverse text-sm font-medium rounded-lg transition-colors min-h-[44px] tm-press'
                    >
                      <Monitor className='w-4 h-4' />
                      打开电视访问
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部说明 */}
          <div className='p-6 pt-4 border-t border-line'>
            <p className='text-[13px] text-muted text-center'>
              安装后可获得无浏览器地址栏的沉浸式全屏观影体验
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
