'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  Play,
  Users,
} from 'lucide-react';
import {
  type ReactNode,
  type TouchEventHandler,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useReducedMotionSetting } from '@/lib/motion';

import ProxyImage from '@/components/ProxyImage';

export interface HeroDeckItem {
  id: string;
  title: string;
  src: string;
}

export default function HomeHero({
  id,
  title,
  meta,
  description,
  art,
  contain,
  deck,
  renderPoster,
  onPlay,
  onTogether,
  onDetail,
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
  contain: boolean;
  deck?: HeroDeckItem[];
  renderPoster?: (item: HeroDeckItem) => ReactNode;
  onPlay: () => void;
  onTogether: () => void;
  onDetail?: () => void;
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
  const [imageShapes, setImageShapes] = useState<Record<string, boolean>>({});
  const portrait = imageShapes[id] ?? contain;
  const media =
    isValidElement(art) && (art.type === 'video' || art.type === 'iframe');
  const [readyId, setReadyId] = useState<string>();
  const [failedId, setFailedId] = useState<string>();
  const [settled, setSettled] = useState<{
    id: string;
    art: ReactNode;
    portrait: boolean;
  }>();
  const currentId = useRef(id);
  currentId.current = id;
  const root = useRef<HTMLElement>(null);
  const currentFrame = useRef<HTMLDivElement | null>(null);
  const ready = media || readyId === id;
  const markLoaded = (image: HTMLImageElement) => {
    if (image.naturalWidth <= 0) return;
    const loadedId = id;
    const finish = () => {
      if (currentId.current !== loadedId) return;
      setImageShapes((previous) => ({
        ...previous,
        [loadedId]: image.naturalHeight > image.naturalWidth,
      }));
      setFailedId(undefined);
      setReadyId(loadedId);
    };
    if (typeof image.decode === 'function')
      void image.decode().then(finish, finish);
    else finish();
  };
  useEffect(() => {
    if (ready) {
      // Retain only image art: an outgoing preview must never keep playing sound.
      setSettled(media ? undefined : { id, art, portrait });
      return;
    }
    const image = currentFrame.current?.querySelector<HTMLImageElement>('img');
    if (image?.complete && image.naturalWidth) markLoaded(image);
    // A failed source must not trap the carousel on the previous poster forever.
    const timeout = window.setTimeout(() => {
      setFailedId(id);
      setReadyId(id);
    }, 5000);
    return () => window.clearTimeout(timeout);
    // art is a caller-owned element; loading depends on its stable item identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready, portrait, media, art]);
  const distance = useMotionValue(0);
  const y = useTransform(distance, (value) => value * 0.3);
  const opacity = useTransform(distance, [0, 420], [1, 0]);
  const copyY = useTransform(distance, (value) => value * -0.12);
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
  const prevIndex =
    deck && deck.length > 1 ? (index - 1 + deck.length) % deck.length : -1;
  const nextIndex =
    deck && deck.length > 2
      ? (index + 1) % deck.length
      : deck && deck.length === 2
      ? (index + 1) % 2
      : -1;
  const prevItem = prevIndex >= 0 ? deck?.[prevIndex] : undefined;
  const nextItem =
    nextIndex >= 0 && nextIndex !== prevIndex ? deck?.[nextIndex] : undefined;

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
      <div className='tm-home-hero-panel' data-portrait={portrait}>
        <motion.div
          className='tm-home-hero-art'
          style={{ y: reduced || portrait ? 0 : y }}
        >
          {portrait && prevItem?.src && (
            <button
              type='button'
              className='tm-home-hero-side-card'
              data-side='prev'
              onClick={() => onSelect(prevIndex)}
              aria-label={`切换到上一部：${prevItem.title}`}
              tabIndex={-1}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={prevItem.id}
                  className='tm-home-hero-side-frame'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration }}
                >
                  {renderPoster ? (
                    renderPoster(prevItem)
                  ) : (
                    <ProxyImage
                      originalSrc={prevItem.src}
                      alt=''
                      loading='eager'
                      className='tm-home-hero-side-image'
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>
          )}
          <AnimatePresence initial={false}>
            {!media && settled && settled.id !== id && (
              <motion.div
                key={settled.id}
                className='tm-home-hero-frame'
                data-portrait={settled.portrait}
                data-ready='true'
                aria-hidden='true'
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration }}
              >
                {settled.art}
              </motion.div>
            )}
            <motion.div
              key={id}
              ref={(element) => {
                if (currentId.current === id) currentFrame.current = element;
              }}
              className='tm-home-hero-frame'
              data-portrait={portrait}
              data-current='true'
              data-ready={ready}
              onLoadCapture={(event) => {
                const image = event.target;
                if (image instanceof HTMLImageElement) markLoaded(image);
              }}
              initial={{ opacity: 0, scale: 1 }}
              animate={{
                opacity: ready || !settled ? 1 : 0,
                scale: reduced || portrait ? 1 : 1.06,
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration },
                scale: {
                  duration: reduced || portrait ? 0 : 12,
                  ease: 'linear',
                },
              }}
            >
              {art}
              {failedId === id && (
                <span
                  className='tm-home-hero-image-failed'
                  role='img'
                  aria-label='海报暂时无法加载'
                >
                  <Film size={36} aria-hidden />
                </span>
              )}
            </motion.div>
          </AnimatePresence>
          {portrait && nextItem?.src && (
            <button
              type='button'
              className='tm-home-hero-side-card'
              data-side='next'
              onClick={() => onSelect(nextIndex)}
              aria-label={`切换到下一部：${nextItem.title}`}
              tabIndex={-1}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={nextItem.id}
                  className='tm-home-hero-side-frame'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration }}
                >
                  {renderPoster ? (
                    renderPoster(nextItem)
                  ) : (
                    <ProxyImage
                      originalSrc={nextItem.src}
                      alt=''
                      loading='eager'
                      className='tm-home-hero-side-image'
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>
          )}
        </motion.div>
        {/* 遮罩用页面底色渐变：深色主题压暗、浅色主题提亮，大图下沿融进页面 */}
        <div className='tm-home-hero-scrim' aria-hidden='true' />
        <motion.div
          className='tm-home-hero-copy'
          style={{
            opacity: reduced || portrait ? 1 : opacity,
            y: reduced || portrait ? 0 : copyY,
          }}
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
                  className='tm-btn tm-btn-lg tm-btn-primary'
                  onClick={onPlay}
                >
                  <Play size={16} fill='currentColor' />
                  播放
                </button>
                <button
                  className='tm-btn tm-btn-lg tm-home-hero-glass'
                  onClick={onTogether}
                >
                  <Users size={18} />
                  一起看
                </button>
                {onDetail && (
                  <button
                    className='tm-btn tm-btn-lg tm-home-hero-glass tm-home-hero-detail'
                    onClick={onDetail}
                  >
                    <Info size={18} />
                    详情
                  </button>
                )}
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
        <div className='tm-home-hero-controls'>
          {extraControls}
          {titles.length > 1 && (
            <>
              <button
                className='tm-icon-btn tm-home-hero-arrow'
                aria-label='上一张推荐'
                onClick={() =>
                  onSelect((index - 1 + titles.length) % titles.length)
                }
              >
                <ChevronLeft size={20} />
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
              <button
                className='tm-icon-btn tm-home-hero-arrow'
                aria-label='下一张推荐'
                onClick={() => onSelect((index + 1) % titles.length)}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
