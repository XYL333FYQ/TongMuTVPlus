'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Users } from 'lucide-react';
import {
  type ReactNode,
  type TouchEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useReducedMotionSetting } from '@/lib/motion';

export default function HomeHero({
  id,
  title,
  meta,
  description,
  art,
  ambient,
  contain,
  onPlay,
  onTogether,
  titles,
  index,
  onSelect,
  onPause,
  extraControls,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  id: string;
  title: string;
  meta: ReactNode;
  description?: string;
  art: ReactNode;
  ambient?: ReactNode;
  contain: boolean;
  onPlay: () => void;
  onTogether: () => void;
  titles: string[];
  index: number;
  onSelect: (index: number) => void;
  onPause?: (paused: boolean) => void;
  extraControls?: ReactNode;
  onTouchStart?: TouchEventHandler<HTMLElement>;
  onTouchMove?: TouchEventHandler<HTMLElement>;
  onTouchEnd?: TouchEventHandler<HTMLElement>;
}) {
  const reduced = useReducedMotionSetting();
  const [imageShape, setImageShape] = useState<{
    id: string;
    portrait: boolean;
  }>();
  const portrait = imageShape?.id === id ? imageShape.portrait : contain;
  const root = useRef<HTMLElement>(null);
  const distance = useMotionValue(0);
  const y = useTransform(distance, (value) => value * 0.3);
  const opacity = useTransform(distance, [0, 400], [1, 0]);
  const scale = useTransform(distance, [0, 400], [1, 0.96]);
  useEffect(() => {
    const update = () =>
      distance.set(
        reduced
          ? 0
          : Math.max(0, -(root.current?.getBoundingClientRect().top || 0))
      );
    update();
    window.addEventListener('scroll', update, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', update, true);
  }, [distance, reduced]);
  const duration = reduced ? 0.12 : 0.6;
  return (
    <section
      ref={root}
      className='tm-home-hero'
      aria-label='精选推荐'
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => onPause?.(true)}
      onMouseLeave={() => onPause?.(false)}
      onFocusCapture={() => onPause?.(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          onPause?.(false);
      }}
    >
      <div className='tm-home-ambient' aria-hidden='true'>
        <AnimatePresence initial={false}>
          <motion.div
            key={id + '-ambient'}
            className='tm-home-ambient-frame'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
          >
            {ambient}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className='tm-home-hero-panel' data-portrait={portrait}>
        {portrait && (
          <div className='tm-home-portrait-ambient' aria-hidden='true'>
            {ambient}
          </div>
        )}
        <motion.div className='tm-home-hero-art' style={{ y: reduced ? 0 : y }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={id}
              className='tm-home-hero-frame'
              data-contain={portrait || contain}
              data-portrait={portrait}
              onLoadCapture={(event) => {
                const image = event.target;
                if (
                  image instanceof HTMLImageElement &&
                  image.naturalWidth > 0
                ) {
                  setImageShape({
                    id,
                    portrait: image.naturalHeight > image.naturalWidth,
                  });
                }
              }}
              initial={{ opacity: 0, scale: 1 }}
              animate={{
                opacity: 1,
                scale: reduced || portrait || contain ? 1 : 1.06,
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration },
                scale: {
                  duration: reduced || portrait || contain ? 0 : 12,
                  ease: 'linear',
                },
              }}
            >
              {art}
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <motion.div
          className='tm-home-hero-copy'
          style={{ opacity: reduced ? 1 : opacity, scale: reduced ? 1 : scale }}
        >
          <motion.div
            key={id + '-copy'}
            initial='hidden'
            animate='visible'
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reduced ? 0 : 0.06 } },
            }}
          >
            {[
              <div className='tm-home-hero-meta' key='meta'>
                {meta}
              </div>,
              <h1 className='tm-home-hero-title' key='title'>
                {title}
              </h1>,
              description ? (
                <p className='tm-home-hero-description' key='description'>
                  {description}
                </p>
              ) : null,
              <div className='tm-home-hero-actions' key='actions'>
                <button
                  className='tm-btn tm-btn-lg tm-btn-art'
                  onClick={onPlay}
                >
                  <Play size={16} fill='currentColor' />
                  播放
                </button>
                <button
                  className='tm-btn tm-btn-lg tm-btn-art-glass'
                  onClick={onTogether}
                >
                  <Users size={18} />
                  一起看
                </button>
              </div>,
            ].map(
              (child, i) =>
                child && (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: reduced ? 0 : 12 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: reduced ? 0.12 : 0.36,
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
        </motion.div>
        {titles.length > 1 && (
          <>
            <button
              className='tm-icon-btn tm-home-hero-arrow tm-home-hero-prev'
              data-variant='art'
              aria-label='上一张推荐'
              onClick={() =>
                onSelect((index - 1 + titles.length) % titles.length)
              }
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className='tm-icon-btn tm-home-hero-arrow tm-home-hero-next'
              data-variant='art'
              aria-label='下一张推荐'
              onClick={() => onSelect((index + 1) % titles.length)}
            >
              <ChevronRight size={20} />
            </button>
            <div className='tm-home-hero-dots' aria-label='切换推荐'>
              {titles.map((name, n) => (
                <button
                  key={n}
                  aria-label={`查看推荐 ${n + 1}：${name}`}
                  aria-current={n === index ? 'true' : undefined}
                  data-active={n === index}
                  onClick={() => onSelect(n)}
                >
                  <span />
                </button>
              ))}
            </div>
          </>
        )}
        {extraControls && (
          <div className='tm-home-hero-extra'>{extraControls}</div>
        )}
      </div>
    </section>
  );
}
