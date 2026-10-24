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
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react';

import { posterTiltHandlers, useReducedMotionSetting } from '@/lib/motion';

import { useHeroAutoplay } from '@/components/catalog/useHeroAutoplay';
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
  onAutoSelect,
  autoPlayInterval = 8000,
  autoPlayDisabled = false,
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
  onAutoSelect?: (index: number) => void;
  autoPlayInterval?: number;
  autoPlayDisabled?: boolean;
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
  const autoplay = useHeroAutoplay({
    index,
    count: titles.length,
    onAdvance: onAutoSelect || onSelect,
    interval: autoPlayInterval,
    disabled: autoPlayDisabled,
  });
  const progressElement = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      autoplay.progress.on('change', (value) => {
        progressElement.current?.setAttribute(
          'aria-valuenow',
          String(Math.round(value * 100))
        );
      }),
    [autoplay.progress]
  );
  const select = (target: number) => {
    autoplay.interact();
    onSelect(target);
  };
  const gesture = useRef<{
    x: number;
    y: number;
    endX: number;
    endY: number;
  }>();
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
  const previewStart = Math.max(
    0,
    Math.min(index - 2, (deck?.length || 0) - 5)
  );
  const smallStart = Math.max(0, Math.min(index - 1, (deck?.length || 0) - 3));
  const previews = (deck || []).slice(previewStart, previewStart + 5);
  const showcase = portrait && !media && Boolean(deck?.length);
  const neighbors = (deck || [])
    .map((_, offset) => (index + offset + 1) % (deck?.length || 1))
    .filter((target) => target !== index)
    .slice(0, 2);
  const controls = titles.length > 1 && (
    <div className='tm-home-hero-controls' aria-label='推荐切换'>
      <button
        type='button'
        className='tm-home-hero-control'
        aria-label='上一部推荐'
        onClick={() => select((index - 1 + titles.length) % titles.length)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span
        className='tm-home-hero-counter'
        aria-label={`第 ${index + 1} 部，共 ${titles.length} 部`}
      >
        <strong>{String(index + 1).padStart(2, '0')}</strong>
        <span> / {String(titles.length).padStart(2, '0')}</span>
      </span>
      <button
        type='button'
        className='tm-home-hero-control'
        aria-label='下一部推荐'
        onClick={() => select((index + 1) % titles.length)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
      {!reduced && (
        <div
          ref={progressElement}
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

  return (
    <section
      ref={root}
      className='tm-home-hero'
      aria-label='精选推荐'
      aria-roledescription='轮播'
      aria-busy={!ready}
      onPointerDownCapture={autoplay.interact}
      onPointerMoveCapture={autoplay.extendIdle}
      onFocusCapture={autoplay.interact}
      onKeyDownCapture={autoplay.interact}
      onKeyDown={(event) => {
        if (
          titles.length < 2 ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          (event.target instanceof Element &&
            event.target.closest(
              'input, textarea, select, [contenteditable="true"]'
            ))
        )
          return;
        const target =
          event.key === 'ArrowLeft'
            ? (index - 1 + titles.length) % titles.length
            : event.key === 'ArrowRight'
            ? (index + 1) % titles.length
            : event.key === 'Home'
            ? 0
            : event.key === 'End'
            ? titles.length - 1
            : undefined;
        if (target === undefined) return;
        event.preventDefault();
        select(target);
      }}
      onTouchStart={(event) => {
        if (onTouchStart) return onTouchStart(event);
        const touch = event.touches.length === 1 ? event.touches[0] : undefined;
        gesture.current = touch
          ? {
              x: touch.clientX,
              y: touch.clientY,
              endX: touch.clientX,
              endY: touch.clientY,
            }
          : undefined;
      }}
      onTouchMove={(event) => {
        if (onTouchMove) return onTouchMove(event);
        if (event.touches.length !== 1) {
          gesture.current = undefined;
          return;
        }
        if (!gesture.current) return;
        gesture.current.endX = event.touches[0].clientX;
        gesture.current.endY = event.touches[0].clientY;
      }}
      onTouchEnd={(event) => {
        if (onTouchEnd) return onTouchEnd(event);
        const swipe = gesture.current;
        gesture.current = undefined;
        if (!swipe || titles.length < 2) return;
        const x = swipe.x - swipe.endX;
        const y = Math.abs(swipe.y - swipe.endY);
        if (Math.abs(x) > 50 && Math.abs(x) > y * 1.2)
          select((index + (x > 0 ? 1 : titles.length - 1)) % titles.length);
      }}
      onTouchCancel={() => {
        gesture.current = undefined;
      }}
    >
      <div
        className='tm-home-hero-panel'
        data-portrait={portrait}
        data-showcase={showcase}
      >
        <motion.div
          className='tm-home-hero-art'
          aria-hidden='true'
          style={{ y: reduced || portrait ? 0 : y }}
        >
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
                if (event.target instanceof HTMLImageElement)
                  markLoaded(event.target);
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
                  {Array.from(title)[0] || '影'}
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <div className='tm-home-hero-scrim' aria-hidden='true' />
        <div className='tm-home-hero-inner'>
          <motion.div
            className='tm-home-hero-copy'
            style={{
              opacity: reduced || portrait ? 1 : opacity,
              y: reduced || portrait ? 0 : copyY,
            }}
          >
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
                    className='tm-btn tm-btn-lg tm-btn-primary tm-btn-art'
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
                  {onDetail && (
                    <button
                      className='tm-btn tm-btn-lg tm-btn-ghost tm-home-hero-detail'
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
            {!showcase && titles.length > 1 && (
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
            )}
          </motion.div>
          {showcase ? (
            <div className='tm-home-hero-showcase'>
              <div className='tm-home-hero-poster-deck' aria-label='推荐海报'>
                <div className='tm-home-hero-poster tm-home-hero-poster-main'>
                  <button
                    type='button'
                    className='tm-home-hero-poster-surface'
                    aria-label={'查看影片详情：' + title}
                    onClick={onDetail || onPlay}
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
                            markLoaded(event.target);
                        }}
                        initial={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
                        animate={{
                          opacity: ready || !settled ? 1 : 0,
                          scale: 1,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {failedId === id ? (
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
                {neighbors.map((target, slot) => {
                  const item = deck?.[target];
                  if (!item) return null;
                  return (
                    <div
                      key={slot}
                      className={
                        'tm-home-hero-poster tm-home-hero-poster-' +
                        (slot === 0 ? 'left' : 'right')
                      }
                    >
                      <button
                        type='button'
                        className='tm-home-hero-poster-surface'
                        aria-label={'切换推荐：' + item.title}
                        onClick={() => select(target)}
                        {...posterTiltHandlers}
                      >
                        <AnimatePresence initial={false}>
                          <motion.span
                            key={item.id}
                            className='tm-home-hero-poster-face'
                            initial={{
                              opacity: 0,
                              x: reduced ? 0 : slot === 0 ? -12 : 12,
                            }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration }}
                            onLoadCapture={(event) => {
                              if (event.target instanceof HTMLImageElement)
                                event.currentTarget.dataset.loaded = 'true';
                            }}
                            onErrorCapture={(event) => {
                              if (event.target instanceof HTMLImageElement)
                                event.currentTarget.dataset.loaded = 'false';
                            }}
                          >
                            <span
                              className='tm-home-hero-poster-fallback'
                              aria-hidden='true'
                            >
                              {Array.from(item.title)[0] || '影'}
                            </span>
                            {renderPoster ? (
                              renderPoster(item)
                            ) : (
                              <ProxyImage
                                originalSrc={item.src}
                                alt=''
                                loading='eager'
                              />
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </div>
                  );
                })}
              </div>
              {controls}
            </div>
          ) : previews.length > 1 ? (
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
                        <ProxyImage
                          originalSrc={item.src}
                          alt=''
                          loading='lazy'
                        />
                      )}
                      {target === index && !reduced && (
                        <motion.span
                          key={id}
                          className='tm-home-hero-thumb-progress'
                          style={{ scaleX: autoplay.progress }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        {extraControls && (
          <div className='tm-home-hero-extra'>{extraControls}</div>
        )}
      </div>
    </section>
  );
}
