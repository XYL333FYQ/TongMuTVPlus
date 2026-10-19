import { Search } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { getConfig } from '@/lib/config';
import {
  SPECIAL_SOURCE_COOKIE,
  SPECIAL_SOURCE_PATH,
} from '@/lib/special-source.client';

import PageContainer from '@/components/PageContainer';

import SpecialSourceToggle from './SpecialSourceToggle';

export const dynamic = 'force-dynamic';

/**
 * 特殊源入口说明页（/sp）。
 * 开关是本机开关（cookie），任何用户都能自己打开，只对自己这台设备生效。
 */
export default async function SpecialPage() {
  const config = await getConfig();
  const enabled = cookies().get(SPECIAL_SOURCE_COOKIE)?.value === '1';
  const specialCount = (config.SpecialSourceApis || []).length;

  return (
    <main className='min-h-screen bg-[var(--tm-bg)] text-[color:var(--tm-text)]'>
      <PageContainer className='flex min-h-screen w-full items-center py-10'>
        <div className='w-full rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface)] p-6 shadow-xl sm:p-8'>
          <div className='space-y-3'>
            <h1 className='text-2xl font-medium tracking-normal text-[color:var(--tm-text)]'>
              特殊源
            </h1>
            <p className='text-sm leading-6 text-[color:var(--tm-muted)]'>
              特殊源只在 {SPECIAL_SOURCE_PATH}{' '}
              路径下可用，普通搜索不会出现特殊源的内容；
              {SPECIAL_SOURCE_PATH} 路径下也不会出现普通源的内容。
            </p>
          </div>

          <div className='mt-8 flex items-center justify-between rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
            <div>
              <div className='text-sm text-[color:var(--tm-muted)]'>
                本机状态
              </div>
              <div className='mt-1 text-lg font-medium text-[color:var(--tm-text)]'>
                {enabled ? '已开启' : '已关闭'}
              </div>
              <div className='mt-1 text-[13px] text-[color:var(--tm-muted)]'>
                已标记特殊源 {specialCount} 个
              </div>
            </div>

            <SpecialSourceToggle initialEnabled={enabled} />
          </div>

          {specialCount === 0 && (
            <p className='mt-4 rounded-lg bg-[var(--tm-surface-raised)] p-3 text-[13px] leading-5 text-[color:var(--tm-text)]'>
              没有任何采集源被标记为特殊源，此时普通搜索不会屏蔽任何源。请在后台
              「视频源管理 → 特殊源设置」勾选，或在配置文件里补上
              <code className='mx-1'>special_source_apis</code>
              后重新保存配置文件。
            </p>
          )}

          <p className='mt-4 text-[13px] leading-5 text-[color:var(--tm-muted)]'>
            这是本机开关（存在 cookie
            里），谁打开谁能用，只影响当前设备与浏览器， 不改动站点配置。关闭后{' '}
            {SPECIAL_SOURCE_PATH} 返回 404，特殊源的收藏与播放记录也不会出现在
            普通入口——记录仍在，重新打开即可看到。此开关对 TVBox、OrionTV、WebTV
            渠道无效，这些渠道始终无法使用特殊源。
          </p>

          <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
            {enabled ? (
              <Link
                href={SPECIAL_SOURCE_PATH}
                className='inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--tm-text)] px-4 py-3 text-sm font-medium text-[color:var(--tm-accent-contrast)] transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] tm-press'
              >
                <Search className='h-4 w-4' />
                前往里世界
              </Link>
            ) : (
              <button
                type='button'
                disabled
                aria-disabled='true'
                title='请先打开上方开关'
                className='inline-flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[var(--tm-surface-raised)] px-4 py-3 text-sm font-medium text-[color:var(--tm-muted)] opacity-60 min-h-[44px] tm-press'
              >
                <Search className='h-4 w-4' />
                前往里世界
              </button>
            )}
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
