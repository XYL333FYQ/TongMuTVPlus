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

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

export const metadata: Metadata = { title: `关于 ${BRAND_NAME}` };

export default function AboutPage() {
  return (
    <PageLayout activePath='/about'>
      <PageContainer className='py-12 sm:py-20'>
        <Image
          src='/brand/tm-mark.svg'
          width={80}
          height={80}
          alt={`${BRAND_NAME} 标志`}
          priority
        />
        <p className='mt-8 text-[13px] font-medium uppercase tracking-normal text-[color:var(--tm-muted)]'>
          关于项目
        </p>
        <h1 className='mt-3 text-3xl font-medium tracking-normal text-[color:var(--tm-text)] sm:text-5xl'>
          {BRAND_NAME}
        </h1>
        <p className='mt-4 text-lg text-[color:var(--tm-muted)]'>
          {BRAND_DESCRIPTION}
        </p>
        <div className='mt-10 space-y-6 rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface)] p-6 sm:p-8'>
          <section>
            <h2 className='text-lg font-medium text-[color:var(--tm-text)]'>
              本项目
            </h2>
            <p className='mt-2 text-sm leading-7 text-[color:var(--tm-muted)]'>
              当前版本 v{PROJECT_VERSION}
              。本项目在原有影视浏览与播放基础上改造房间体验、内容选择和品牌视觉，使用独立版本维护。尚未配置本项目的在线发行地址。
            </p>
          </section>
          <section>
            <h2 className='text-lg font-medium text-[color:var(--tm-text)]'>
              来源与致谢
            </h2>
            <p className='mt-2 text-sm leading-7 text-[color:var(--tm-muted)]'>
              基于{' '}
              <a
                className='inline-flex min-h-[44px] items-center text-[color:var(--tm-text)] underline underline-offset-4 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
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
            <h2 className='text-lg font-medium text-[color:var(--tm-text)]'>
              许可记录
            </h2>
            <p className='mt-2 text-sm leading-7 text-[color:var(--tm-muted)]'>
              源码快照根 LICENSE 为 CC BY-NC-SA 4.0，原 README 同时标注
              MIT，两者存在不一致，现保留原始记录并明确标注待核实。第三方组件保留各自许可与归属；更换产品名称不改变原有许可。
            </p>
          </section>
        </div>
        <Link
          href='/'
          className='mt-8 inline-flex min-h-[44px] items-center rounded-full border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] px-5 py-2.5 text-sm text-[color:var(--tm-text)] transition hover:bg-[var(--tm-line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
        >
          返回影视
        </Link>
      </PageContainer>
    </PageLayout>
  );
}
