'use client';

/*
 * 首页大图的几块：切换控件（上一部 / 计数 / 下一部 / 自动切换进度）、文字区（逐行进场）、
 * “接下来”缩略图、主海报两侧的海报。只负责画，状态都在 HomeHero。
 */

import { type MotionValue, AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Users } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import { posterTiltHandlers } from '@/lib/motion';

import FilmPoster from '@/components/poster/FilmPoster';

import type { HeroDeckItem } from './home-hero-types';

export function HeroControls({
  index,
  count,
  reduced,
  select,
  progressRef,
  autoplay,
}: {
  index: number;
  count: number;
  reduced: boolean;
  select: (target: number) => void;
  progressRef: RefObject<HTMLDivElement>;
  autoplay: { state: string; progress: MotionValue<number> };
}) {
  return (
    <div className='tm-home-hero-controls' aria-label='推荐切换'>
      <button
        type='button'
        className='tm-home-hero-control'
        aria-label='上一部推荐'
        onClick={() => select((index - 1 + count) % count)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span
        className='tm-home-hero-counter'
        aria-label={`第 ${index + 1} 部，共 ${count} 部`}
      >
        <strong>{String(index + 1).padStart(2, '0')}</strong>
        <span> / {String(count).padStart(2, '0')}</span>
      </span>
      <button
        type='button'
        className='tm-home-hero-control'
        aria-label='下一部推荐'
        onClick={() => select((index + 1) % count)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
      {!reduced && (
        <div
          ref={progressRef}
          className='tm-home-hero-progress'
          role='progressbar'
          aria-label='封面自动切换进度'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-valuetext={
            autoplay.state === 'idle'
              ? '手动浏览中，静置12秒后恢复自动切换'
              : autoplay.state === 'suspended'
              ? '自动切换暂缓'
              : '正在计时，随后自动切换封面'
          }
          data-state={autoplay.state}
        >
          <motion.span style={{ scaleX: autoplay.progress }} />
        </div>
      )}
    </div>
  );
}

export function HeroCopyLines({
  id,
  meta,
  title,
  description,
  reduced,
  onPlay,
  onWatchInRoom,
  onDetail,
}: {
  id: string;
  meta: ReactNode;
  title: string;
  description?: string;
  reduced: boolean;
  onPlay: () => void;
  onWatchInRoom: () => void;
  onDetail?: () => void;
}) {
  return (
    <motion.div
      initial='hidden'
      animate='visible'
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: reduced ? 0 : 0.06 },
        },
      }}
    >
      {[
        <div className='tm-home-hero-meta' key='meta'>
          {meta}
        </div>,
        <h2 className='tm-home-hero-title' key='title'>
          {title}
        </h2>,
        description ? (
          <p className='tm-home-hero-description' key='description'>
            {description}
          </p>
        ) : null,
        <div className='tm-home-hero-actions' key='actions'>
          <button
            className='tm-btn tm-btn-lg tm-btn-primary tm-btn-art tm-home-hero-action'
            onClick={onPlay}
          >
            <Play size={16} fill='currentColor' />
            播放
          </button>
          <button
            className='tm-btn tm-btn-lg tm-btn-art-glass tm-home-hero-action tm-home-hero-action-glass'
            onClick={onWatchInRoom}
          >
            <Users size={18} />
            一起看
          </button>
          {onDetail && (
            <button
              className='tm-btn tm-btn-lg tm-btn-ghost tm-home-hero-action tm-home-hero-detail'
              onClick={onDetail}
            >
              详情
            </button>
          )}
        </div>,
      ].map(
        (child, i) =>
          child && (
            <motion.div
              key={i === 3 ? 'actions' : id + '-' + i}
              initial='hidden'
              animate='visible'
              variants={{
                hidden: { opacity: 0, y: reduced ? 0 : 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: reduced ? 0.12 : 0.36,
                    delay: reduced ? 0 : i * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  },
                },
              }}
            >
              {child}
            </motion.div>
          )
      )}
    </motion.div>
  );
}

export function HeroNeighborPoster({
  item,
  side,
  reduced,
  duration,
  renderPoster,
  onSelect,
}: {
  item: HeroDeckItem;
  side: 'left' | 'right';
  reduced: boolean;
  duration: number;
  renderPoster?: (item: HeroDeckItem) => ReactNode;
  onSelect: () => void;
}) {
  return (
    <div className={'tm-home-hero-poster tm-home-hero-poster-' + side}>
      <button
        type='button'
        className='tm-home-hero-poster-surface'
        aria-label={'切换推荐：' + item.title}
        onClick={onSelect}
        {...posterTiltHandlers}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={item.id}
            className='tm-home-hero-poster-face'
            initial={{
              opacity: 0,
              x: reduced ? 0 : side === 'left' ? -12 : 12,
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
          >
            {renderPoster ? (
              renderPoster(item)
            ) : (
              <FilmPoster
                src={item.src}
                title={item.title}
                fit='contain'
                eager
                className='tm-home-hero-deck-art'
              />
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

export function HeroUpNext({
  previews,
  previewStart,
  smallStart,
  index,
  id,
  reduced,
  progress,
  renderPoster,
  select,
}: {
  previews: HeroDeckItem[];
  previewStart: number;
  smallStart: number;
  index: number;
  id: string;
  reduced: boolean;
  progress: MotionValue<number>;
  renderPoster?: (item: HeroDeckItem) => ReactNode;
  select: (target: number) => void;
}) {
  return (
    <div className='tm-home-upnext' aria-label='接下来'>
      <span className='tm-home-upnext-label'>接下来</span>
      <div className='tm-home-hero-thumbs'>
        {previews.map((item, offset) => {
          const target = previewStart + offset;
          return (
            <button
              key={item.id}
              className='tm-home-hero-thumb'
              aria-label={'切换推荐：' + item.title}
              aria-pressed={target === index}
              data-active={target === index}
              data-small-visible={
                target >= smallStart && target < smallStart + 3
              }
              onClick={() => select(target)}
            >
              {renderPoster ? (
                renderPoster(item)
              ) : (
                <FilmPoster
                  src={item.src}
                  title={item.title}
                  className='tm-home-hero-deck-art'
                />
              )}
              {target === index && !reduced && (
                <motion.span
                  key={id}
                  className='tm-home-hero-thumb-progress'
                  style={{ scaleX: progress }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 主海报：上一张淡出、这一张淡入；加载失败时显示片名首字 */
export function HeroMainPoster({
  id,
  title,
  art,
  settled,
  ready,
  failed,
  reduced,
  duration,
  onOpen,
  onImageLoad,
}: {
  id: string;
  title: string;
  art: ReactNode;
  settled?: { id: string; art: ReactNode };
  ready: boolean;
  failed: boolean;
  reduced: boolean;
  duration: number;
  onOpen: () => void;
  onImageLoad: (image: HTMLImageElement) => void;
}) {
  return (
    <div className='tm-home-hero-poster tm-home-hero-poster-main'>
      <button
        type='button'
        className='tm-home-hero-poster-surface'
        aria-label={'查看影片详情：' + title}
        onClick={onOpen}
        {...posterTiltHandlers}
      >
        <AnimatePresence initial={false}>
          {settled && settled.id !== id && (
            <motion.span
              key={settled.id}
              className='tm-home-hero-poster-face'
              aria-hidden='true'
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration }}
            >
              {settled.art}
            </motion.span>
          )}
          <motion.span
            key={id}
            className='tm-home-hero-poster-face'
            onLoadCapture={(event) => {
              if (event.target instanceof HTMLImageElement)
                onImageLoad(event.target);
            }}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
            animate={{
              opacity: ready || !settled ? 1 : 0,
              scale: 1,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          >
            {failed ? (
              <span
                className='tm-home-hero-poster-fallback'
                role='img'
                aria-label='海报暂时无法加载'
              >
                {Array.from(title)[0] || '影'}
              </span>
            ) : (
              art
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

export function HeroDots({
  titles,
  index,
  select,
}: {
  titles: string[];
  index: number;
  select: (target: number) => void;
}) {
  return (
    <div className='tm-home-hero-dots' aria-label='切换推荐'>
      {titles.map((name, n) => (
        <button
          key={n}
          aria-label={`查看推荐 ${n + 1}：${name}`}
          aria-current={n === index ? 'true' : undefined}
          data-active={n === index}
          onClick={() => select(n)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}
