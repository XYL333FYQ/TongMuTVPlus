import { Github } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  PROJECT_REPOSITORY_URL,
  PROJECT_STAR_MESSAGE,
} from '@/lib/brand';

import ReleaseVersion from '@/components/account/ReleaseVersion';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

export const metadata: Metadata = { title: '关于' };

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
        <p className='mt-8 text-[13px] font-medium uppercase tracking-normal text-muted'>
          关于项目
        </p>
        <h1 className='mt-3 text-3xl font-medium tracking-normal text-fg sm:text-5xl'>
          {BRAND_NAME}
        </h1>
        <p className='mt-4 text-lg text-muted'>{BRAND_DESCRIPTION}</p>
        <div className='mt-10 space-y-6 rounded-2xl border border-line bg-surface p-6 sm:p-8'>
          <section>
            <h2 className='text-lg font-medium text-fg'>本项目</h2>
            <p className='mt-2 text-sm leading-7 text-muted'>
              当前版本 <ReleaseVersion />
              。一起发现好内容，独自观看或与朋友同步观影。
            </p>
          </section>
          <section>
            <h2 className='text-lg font-medium text-fg'>一起看</h2>
            <p className='mt-2 text-sm leading-7 text-muted'>
              创建观影房间，与朋友分享片单、聊天并同步观看进度。
            </p>
          </section>
        </div>
        <div className='mt-8 flex flex-wrap gap-3'>
          <Link
            href='/'
            className='inline-flex min-h-[44px] items-center rounded-full border border-line bg-raised px-5 py-2.5 text-sm text-fg transition hover:bg-line'
          >
            返回影视
          </Link>
          <a
            href={PROJECT_REPOSITORY_URL}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={`${BRAND_NAME} 项目仓库（在新标签页打开）`}
            className='inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-line bg-raised px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg tm-press'
          >
            <Github className='h-4 w-4 shrink-0' aria-hidden='true' />
            {BRAND_NAME} 项目仓库
          </a>
        </div>
        <p className='mt-3 text-sm leading-6 text-muted'>
          {PROJECT_STAR_MESSAGE}
        </p>
      </PageContainer>
    </PageLayout>
  );
}
