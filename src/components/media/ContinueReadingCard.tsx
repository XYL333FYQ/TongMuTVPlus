'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

import ProxyImage from '@/components/ProxyImage';

import {
  BOOK_COVER_LIFT,
  BOOK_SPINE_OVERLAY,
  LIBRARY_BUTTON,
  LIBRARY_FOCUS,
  LIBRARY_MUTED,
  LIBRARY_PANEL,
  LIBRARY_SERIF,
} from './library';

/**
 * 进度可能来自 CFI 比例或章节下标，原样打印是一长串小数；
 * 小数位保留两位，整数则不加小数点尾巴。
 */
function formatProgressLabel(progress: number) {
  return Number.isInteger(progress) ? String(progress) : progress.toFixed(2);
}

/**
 * 书签台上摊开的那一本：书库首页顶部的大卡，一眼看到在读的书与进度。
 *
 * 整张卡是一个链接，右侧的「继续阅读」是链接内的视觉按钮（span），
 * 这样在触摸设备和键盘上都只有一次点击目标。
 */
export default function ContinueReadingCard({
  eyebrow = '正在读',
  title,
  image,
  meta,
  progress,
  href,
  onNavigate,
  ctaLabel = '继续阅读',
  className,
}: {
  eyebrow?: string;
  title: string;
  image?: string;
  /** 一行次要信息：来源 · 章节 · 页数 */
  meta?: string;
  /** 0..100，缺省则不渲染进度条 */
  progress?: number;
  href: string;
  onNavigate?: () => void;
  ctaLabel?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const cover =
      rootRef.current?.querySelector<HTMLImageElement>('.tm-media-image');
    if (!cover) return;
    delete cover.dataset.loaded;
    const frame = requestAnimationFrame(() => {
      if (cover.complete && cover.naturalWidth > 0)
        cover.dataset.loaded = 'true';
    });
    return () => cancelAnimationFrame(frame);
  }, [image]);

  return (
    <Link
      ref={rootRef}
      href={href}
      onClick={onNavigate}
      onLoadCapture={(event) => {
        if (event.target instanceof HTMLImageElement)
          event.target.dataset.loaded = 'true';
      }}
      aria-label={`${ctaLabel} ${title}`}
      className={cn(
        'tm-media-card group flex min-h-[44px] gap-4 p-4 hover:border-fg sm:gap-5 sm:p-5 tm-press',
        LIBRARY_PANEL,
        LIBRARY_FOCUS,
        className
      )}
    >
      <div
        className={cn(
          'relative aspect-[3/4] w-20 shrink-0 self-start overflow-hidden rounded-sm bg-raised sm:w-28',
          BOOK_COVER_LIFT
        )}
      >
        {image ? (
          <ProxyImage
            originalSrc={image}
            alt={title}
            draggable={false}
            className='tm-media-image h-full w-full object-cover'
          />
        ) : (
          <div
            className={cn(
              'flex h-full items-center justify-center text-sm',
              LIBRARY_MUTED
            )}
          >
            暂无封面
          </div>
        )}
        <span className={BOOK_SPINE_OVERLAY} aria-hidden />
      </div>

      <div className='flex min-w-0 flex-1 flex-col justify-between gap-3'>
        <div className='min-w-0'>
          <div className='text-[13px] font-medium text-fg'>{eyebrow}</div>
          <div
            className={cn(
              'mt-1.5 line-clamp-2 text-xl font-medium leading-snug text-fg sm:text-2xl',
              LIBRARY_SERIF
            )}
          >
            {title}
          </div>
          {meta && (
            <div className={cn('mt-2 truncate text-sm', LIBRARY_MUTED)}>
              {meta}
            </div>
          )}
        </div>

        <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
          {typeof progress === 'number' && (
            <div className='flex min-w-[8rem] flex-1 items-center gap-3'>
              <div
                className='h-1 flex-1 overflow-hidden rounded-full bg-line'
                role='progressbar'
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className='h-full rounded-full bg-fg'
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span
                className={cn(
                  'shrink-0 text-[13px] tabular-nums',
                  LIBRARY_MUTED
                )}
              >
                {formatProgressLabel(progress)}%
              </span>
            </div>
          )}
          <span className={cn(LIBRARY_BUTTON, 'pointer-events-none shrink-0')}>
            {ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
