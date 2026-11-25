'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import {
  type ReactNode,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useReducedMotionSetting } from '@/lib/motion';
import { useLatest } from '@/hooks/useLatest';

import { useHeroAutoplay } from '@/components/catalog/useHeroAutoplay';

import type { HomeHeroProps } from './home-hero-types';
import {
  HeroControls,
  HeroCopyLines,
  HeroDots,
  HeroMainPoster,
  HeroNeighborPoster,
  HeroUpNext,
} from './HomeHeroParts';

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
  onWatchInRoom,
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
}: HomeHeroProps) {
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
  const markLoadedLatest = useLatest(markLoaded);
  useEffect(() => {
    if (ready) {
      // Retain only image art: an outgoing preview must never keep playing sound.
      setSettled(media ? undefined : { id, art, portrait });
      return;
    }
    const image = currentFrame.current?.querySelector<HTMLImageElement>('img');
    if (image?.complete && image.naturalWidth) markLoadedLatest.current(image);
    // A failed source must not trap the carousel on the previous poster forever.
    const timeout = window.setTimeout(() => {
      setFailedId(id);
      setReadyId(id);
    }, 5000);
    return () => window.clearTimeout(timeout);
    // art is a caller-owned element; loading depends on its stable item identity.
  }, [id, ready, portrait, media, art, markLoadedLatest]);
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
    <HeroControls
      index={index}
      count={titles.length}
      reduced={reduced}
      select={select}
      progressRef={progressElement}
      autoplay={autoplay}
    />
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
            <HeroCopyLines
              id={id}
              meta={meta}
              title={title}
              description={description}
              reduced={reduced}
              onPlay={onPlay}
              onWatchInRoom={onWatchInRoom}
              onDetail={onDetail}
            />
            {!showcase && titles.length > 1 && (
              <HeroDots titles={titles} index={index} select={select} />
            )}
          </motion.div>
          {showcase ? (
            <div className='tm-home-hero-showcase'>
              <div className='tm-home-hero-poster-deck' aria-label='推荐海报'>
                <HeroMainPoster
                  id={id}
                  title={title}
                  art={art}
                  settled={settled}
                  ready={ready}
                  failed={failedId === id}
                  reduced={reduced}
                  duration={duration}
                  onOpen={onDetail || onPlay}
                  onImageLoad={markLoaded}
                />
                {neighbors.map((target, slot) => {
                  const item = deck?.[target];
                  if (!item) return null;
                  return (
                    <HeroNeighborPoster
                      key={slot}
                      item={item}
                      side={slot === 0 ? 'left' : 'right'}
                      reduced={reduced}
                      duration={duration}
                      renderPoster={renderPoster}
                      onSelect={() => select(target)}
                    />
                  );
                })}
              </div>
              {controls}
            </div>
          ) : previews.length > 1 ? (
            <HeroUpNext
              previews={previews}
              previewStart={previewStart}
              smallStart={smallStart}
              index={index}
              id={id}
              reduced={reduced}
              progress={autoplay.progress}
              renderPoster={renderPoster}
              select={select}
            />
          ) : null}
        </div>
        {extraControls && (
          <div className='tm-home-hero-extra'>{extraControls}</div>
        )}
      </div>
    </section>
  );
}
