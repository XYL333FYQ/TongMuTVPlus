import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  PROJECT_VERSION,
  UPSTREAM_BASE_VERSION,
  UPSTREAM_NAME,
  UPSTREAM_URL,
} from '@/lib/brand';

import PageLayout from '@/components/PageLayout';

export const metadata: Metadata = { title: `关于 ${BRAND_NAME}` };

export default function AboutPage() {
  return (
    <PageLayout activePath='/about'>
      <main className='mx-auto max-w-3xl px-6 py-12 sm:py-20'>
        <Image
          src='/brand/tm-mark.svg'
          width={80}
          height={80}
          alt={`${BRAND_NAME} 标志`}
          priority
        />
        <p className='mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-amber-500'>
          Shared moments
        </p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight sm:text-5xl'>
          {BRAND_NAME}
        </h1>
        <p className='mt-4 text-lg text-gray-500 dark:text-gray-400'>
          {BRAND_DESCRIPTION}
        </p>
        <div className='mt-10 space-y-6 rounded-2xl border border-gray-200 p-6 dark:border-white/10 dark:bg-white/[0.03] sm:p-8'>
          <section>
            <h2 className='text-lg font-semibold'>本项目</h2>
            <p className='mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300'>
              当前版本 v{PROJECT_VERSION}
              。本项目在原有影视浏览与播放基础上改造房间体验、内容选择和品牌视觉，使用独立版本维护。尚未配置本项目的在线发行地址。
            </p>
          </section>
          <section>
            <h2 className='text-lg font-semibold'>来源与致谢</h2>
            <p className='mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300'>
              基于{' '}
              <a
                className='underline underline-offset-4'
                href={UPSTREAM_URL}
                target='_blank'
                rel='noopener noreferrer'
              >
                {UPSTREAM_NAME}
              </a>{' '}
              v{UPSTREAM_BASE_VERSION} 的本地源码快照改造。感谢原项目、MoonTV /
              LunaTV
              及所有贡献者。原项目的改动供维护者审阅参考，不会自动覆盖本项目。
            </p>
          </section>
          <section>
            <h2 className='text-lg font-semibold'>许可记录</h2>
            <p className='mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300'>
              源码快照根 LICENSE 为 CC BY-NC-SA 4.0，原 README 同时标注
              MIT，两者存在不一致，现保留原始记录并明确标注待核实。第三方组件保留各自许可与归属；更换产品名称不改变原有许可。
            </p>
          </section>
        </div>
        <Link
          href='/'
          className='mt-8 inline-flex rounded-full border border-gray-300 px-5 py-2.5 text-sm transition hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10'
        >
          返回影视
        </Link>
      </main>
    </PageLayout>
  );
}
