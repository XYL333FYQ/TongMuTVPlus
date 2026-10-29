'use client';

import { motion, useAnimationControls } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';
import { useReducedMotionSetting } from '@/lib/motion';

import ProxyImage from '@/components/ProxyImage';

import {
  BOOK_COVER_LIFT,
  BOOK_SPINE_OVERLAY,
  LIBRARY_FOCUS,
  LIBRARY_MUTED,
  LIBRARY_SERIF,
} from './library';
import { MediaCardProps } from './media-card.types';
import RippleCountBadge from './RippleCountBadge';

/**
 * 漫画与小说共用的媒体卡片，保留领域封面比例并复用全站 token 与动效。
 *
 * 只做渲染，不认识任何领域类型——数据映射见 adapters.ts。
 * 差异通过三处收敛：progress 是标量、封面上的操作走 overlayAction 槽位，
 * 其余全部塞进 meta / subtitle 两个文本行。
 */
export default function MediaCard({
  item,
  href,
  onNavigate,
  aspect = '3/4',
  overlayAction,
  interactive = 'link',
  onPress,
  className,
}: MediaCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionSetting();
  const reveal = useAnimationControls();
  const entered = useRef(false);
  useEffect(() => {
    const image =
      rootRef.current?.querySelector<HTMLImageElement>('.tm-media-image');
    if (!image) return;
    delete image.dataset.loaded;
    const frame = requestAnimationFrame(() => {
      if (image.complete && image.naturalWidth > 0)
        image.dataset.loaded = 'true';
    });
    return () => cancelAnimationFrame(frame);
  }, [item.image]);

  useEffect(() => {
    if (!reduced || !entered.current) return;
    reveal.stop();
    void reveal.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.12, delay: 0 },
    });
  }, [reduced, reveal]);

  const shellClass = cn(
    'tm-media-card group block min-h-[44px] overflow-hidden rounded-md bg-surface shadow-[var(--tm-shadow-sm)]',
    LIBRARY_FOCUS,
    className
  );

  const content = (
    <>
      <div
        className={cn(
          'relative overflow-hidden bg-raised',
          BOOK_COVER_LIFT,
          aspect === '3/4' ? 'aspect-[3/4]' : 'aspect-[2/3]'
        )}
      >
        {item.image ? (
          <ProxyImage
            originalSrc={item.image}
            alt={item.title}
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
        {item.badge && (
          <span className='tm-library-hud absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[13px] font-medium'>
            {item.badge}
          </span>
        )}
        {typeof item.count === 'number' && item.count > 0 && (
          <RippleCountBadge count={item.count} />
        )}
      </div>

      <div className='space-y-1 px-2.5 pb-2.5 pt-2'>
        <div
          className={cn(
            'line-clamp-2 break-words text-sm font-medium leading-[1.5] text-fg',
            LIBRARY_SERIF
          )}
        >
          {item.title}
        </div>
        {item.meta && (
          <div
            className={cn('truncate text-[13px]', LIBRARY_MUTED)}
            title={item.meta}
          >
            {item.meta}
          </div>
        )}
        {item.subtitle && (
          <div
            className={cn('line-clamp-1 text-[13px]', LIBRARY_MUTED)}
            title={item.subtitle}
          >
            {item.subtitle}
          </div>
        )}
        {typeof item.progress === 'number' && (
          <div
            className='mt-2 h-1 w-full overflow-hidden rounded-full bg-line'
            role='progressbar'
            aria-valuenow={item.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className='h-full rounded-full bg-fg'
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
      </div>
    </>
  );

  return (
    <motion.div
      ref={rootRef}
      className='tm-media-card-motion relative min-w-0 flex flex-col gap-2'
      tabIndex={-1}
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      animate={reveal}
      viewport={{ once: true, amount: 0.1 }}
      onViewportEnter={() => {
        if (entered.current) return;
        entered.current = true;
        const node = rootRef.current;
        const group = node?.closest('[data-tm-reveal-group]');
        let column = 0;
        if (node && group && !reduced) {
          const cards = group.querySelectorAll<HTMLElement>(
            '.tm-media-card-motion'
          );
          for (const card of Array.from(cards)) {
            if (card === node) break;
            // offsetTop ignores each card's active entrance transform.
            if (
              card.offsetParent === node.offsetParent &&
              Math.abs(card.offsetTop - node.offsetTop) <= 2
            )
              column += 1;
          }
        }
        void reveal.start({
          opacity: 1,
          y: 0,
          transition: {
            duration: reduced ? 0.12 : 0.36,
            delay: reduced ? 0 : column * 0.04,
            ease: [0.22, 1, 0.36, 1],
          },
        });
      }}
      whileTap={
        href || interactive === 'press'
          ? {
              scale: reduced ? 1 : 0.97,
              transition: { duration: reduced ? 0 : 0.12, delay: 0 },
            }
          : undefined
      }
      transition={{
        duration: reduced ? 0 : 0.12,
        delay: 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      onLoadCapture={(event) => {
        if (event.target instanceof HTMLImageElement)
          event.target.dataset.loaded = 'true';
      }}
    >
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          className={shellClass}
          aria-label={item.title}
        >
          {content}
        </Link>
      ) : interactive === 'press' ? (
        <div
          role='button'
          tabIndex={0}
          aria-label={item.title}
          onClick={onPress}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onPress?.();
            }
          }}
          className={cn(shellClass, 'cursor-pointer')}
        >
          {content}
        </div>
      ) : (
        <div className={shellClass}>{content}</div>
      )}
      {/*
        封面上的悬浮操作。必须渲染在锚点之外（按钮不能嵌进 <a>），
        同时又要对齐封面右下角——所以外面套一层「和封面等宽等高的透明盒子」：
        封面是整卡宽 + aspect-[3/4]，这个盒子 inset-x-0 top-0 加同样的宽高比，
        高度就必然等于封面高度，bottom-2 落在封面上而不是标题上。
        外层 pointer-events-none 避免吃掉卡片点击，内层再收回指针事件。
      */}
      {overlayAction && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0',
            aspect === '3/4' ? 'aspect-[3/4]' : 'aspect-[2/3]'
          )}
        >
          <div className='pointer-events-auto absolute bottom-2 right-2 z-10'>
            {overlayAction}
          </div>
        </div>
      )}
    </motion.div>
  );
}
