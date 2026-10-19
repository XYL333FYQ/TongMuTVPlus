'use client';

import { ArrowRight, Film, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import './public-catalog.css';

import { useReducedMotionSetting } from '@/lib/motion';
import {
  type PublicCatalogCategory,
  type PublicCatalogItem,
  publicCatalogCategories,
  publicWorkLoginHref,
} from '@/lib/public-catalog';

import HomeHero from './HomeHero';
import HomeRooms from './HomeRooms';
import PageContainer from './PageContainer';
import PageLayout from './PageLayout';
import PosterGrid from './PosterGrid';
import PosterMotion from './PosterMotion';
import PublicPoster from './PublicPoster';
import SectionHeader from './SectionHeader';

function usePublicCatalog(
  type: PublicCatalogCategory,
  tag: string,
  enabled = true
) {
  const [items, setItems] = useState<PublicCatalogItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const nextStart = useRef(0);
  const nextCursor = useRef<string>();
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(
    async (reset = false) => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setLoading(true);
      setError('');
      if (reset) {
        setItems([]);
        setHasMore(false);
        nextStart.current = 0;
        nextCursor.current = undefined;
      }
      const params = new URLSearchParams({
        mode: 'browse',
        type,
        tag,
        limit: '20',
        start: String(reset ? 0 : nextStart.current),
      });
      if (!reset && nextCursor.current)
        params.set('cursor', nextCursor.current);
      try {
        const response = await fetch('/api/public/catalog?' + params, {
          signal: request.signal,
        });
        if (!response.ok) throw new Error('catalog unavailable');
        const data = (await response.json()) as {
          items: PublicCatalogItem[];
          start: number;
          hasMore: boolean;
          nextStart?: number;
          nextCursor?: string;
        };
        if (request.signal.aborted) return;
        const incoming = Array.isArray(data.items) ? data.items : [];
        setItems((previous) =>
          reset
            ? incoming
            : [
                ...previous,
                ...incoming.filter(
                  (item) =>
                    !previous.some(
                      (known) =>
                        known.id === item.id && known.provider === item.provider
                    )
                ),
              ]
        );
        nextStart.current = data.nextStart ?? data.start + incoming.length;
        nextCursor.current = data.nextCursor;
        setHasMore(
          Boolean(data.hasMore) &&
            incoming.length > 0 &&
            nextStart.current <= 500
        );
      } catch {
        if (!request.signal.aborted)
          setError('影视信息暂时无法获取，可以稍后重试。');
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    },
    [tag, type]
  );

  useEffect(() => {
    if (enabled) void load(true);
    return () => controller.current?.abort();
  }, [enabled, load]);

  return { items, loading, error, hasMore, load };
}

function PlainCard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CatalogCards({
  items,
  onSelect,
  horizontal = false,
}: {
  items: PublicCatalogItem[];
  onSelect: (item: PublicCatalogItem) => void;
  horizontal?: boolean;
}) {
  const CardsContainer = horizontal ? PosterGrid : 'div';
  const CardMotion = horizontal ? PosterMotion : PlainCard;
  return (
    <CardsContainer
      className={horizontal ? 'tm-home-poster-grid' : 'tm-public-grid'}
    >
      {(horizontal ? items.slice(0, 12) : items).map((item) => (
        <CardMotion key={item.provider + ':' + item.id}>
          <button
            key={item.provider + ':' + item.id}
            type='button'
            className='tm-public-card tm-press'
            onPointerMove={(event) => {
              if (
                event.pointerType !== 'mouse' ||
                document.documentElement.dataset.tmReducedMotion === 'true' ||
                window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
                !window.matchMedia('(hover:hover) and (pointer:fine)').matches
              )
                return;
              const rect = event.currentTarget.getBoundingClientRect();
              const x = Math.max(
                0,
                Math.min(1, (event.clientX - rect.left) / rect.width)
              );
              const y = Math.max(
                0,
                Math.min(1, (event.clientY - rect.top) / rect.height)
              );
              event.currentTarget.style.setProperty(
                '--tm-poster-rx',
                (0.5 - y) * 12 + 'deg'
              );
              event.currentTarget.style.setProperty(
                '--tm-poster-ry',
                (x - 0.5) * 12 + 'deg'
              );
              event.currentTarget.style.setProperty('--mx', x * 100 + '%');
              event.currentTarget.style.setProperty('--my', y * 100 + '%');
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.setProperty('--tm-poster-rx', '0deg');
              event.currentTarget.style.setProperty('--tm-poster-ry', '0deg');
            }}
            onClick={() => onSelect(item)}
            aria-label={'查看影片介绍：' + item.title}
          >
            <div className='tm-public-poster'>
              {item.poster ? (
                <PublicPoster src={item.poster} alt='' />
              ) : (
                <Film size={32} aria-hidden />
              )}
              {item.rate && Number(item.rate) > 0 && (
                <span className='mtv-rate'>{Number(item.rate).toFixed(1)}</span>
              )}
            </div>
            <strong>{item.title}</strong>
            <span>
              {[item.year, item.mediaType === 'tv' ? '剧集' : '电影']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
        </CardMotion>
      ))}
    </CardsContainer>
  );
}

function CatalogFeedback({
  feed,
}: {
  feed: ReturnType<typeof usePublicCatalog>;
}) {
  if (feed.error)
    return (
      <div className='tm-public-feedback' role='status'>
        <p>{feed.error}</p>
        <button
          type='button'
          onClick={() => void feed.load(feed.items.length === 0)}
          className='tm-tool-link'
        >
          <RefreshCw size={14} />
          重新获取
        </button>
      </div>
    );
  if (feed.loading && !feed.items.length)
    return (
      <div
        className='tm-public-grid'
        aria-busy='true'
        aria-label='正在获取影视信息'
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className='tm-public-skeleton' />
        ))}
      </div>
    );
  if (!feed.loading && !feed.items.length)
    return <p className='tm-public-feedback'>暂时没有相关影视信息。</p>;
  return null;
}

/** Public metadata only: no playback sources, user records or source-search cache. */
export default function PublicCatalogPage({
  mode,
  category,
}: {
  mode: 'home' | 'library';
  category?: PublicCatalogCategory;
}) {
  const params = useSearchParams();
  const isHome = mode === 'home';
  const requestedType = params.get('type') || 'movie';
  const type: PublicCatalogCategory = isHome
    ? 'movie'
    : category ||
      publicCatalogCategories.find((item) => item.type === requestedType)
        ?.type ||
      'movie';
  const [selectedTag, setSelectedTag] = useState('热门');
  const tags =
    type === 'movie'
      ? ['热门', '最新', '经典']
      : type === 'tv'
      ? ['热门', '国产剧', '美剧', '英剧', '韩剧', '日剧']
      : ['热门'];
  const tag = isHome || !tags.includes(selectedTag) ? '热门' : selectedTag;
  const catalog = usePublicCatalog(type, tag);
  const television = usePublicCatalog('tv', '热门', isHome);
  const router = useRouter();
  const openWork = (item: PublicCatalogItem) =>
    router.push(publicWorkLoginHref(item));
  const reduced = useReducedMotionSetting();
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const recommendations = catalog.items.slice(0, 5);
  const featured = recommendations[heroIndex] || recommendations[0];
  useEffect(() => {
    if (!isHome || reduced || paused || recommendations.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        setHeroIndex((index) => (index + 1) % recommendations.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isHome, reduced, paused, recommendations.length]);
  const ContentContainer = PageContainer;

  return (
    <PageLayout activePath={isHome ? '/' : '/douban'}>
      <div
        className={'tm-home tm-public-catalog' + (isHome ? ' tm-home-v3' : '')}
      >
        {isHome && (
          <PageContainer>
            {featured ? (
              <HomeHero
                id={featured.provider + ':' + featured.id}
                title={featured.title}
                meta={
                  <>
                    {featured.year && <span>{featured.year}</span>}
                    <span>{featured.mediaType === 'tv' ? '剧集' : '电影'}</span>
                  </>
                }
                description={featured.description}
                contain
                art={
                  <PublicPoster
                    src={featured.poster}
                    alt={featured.title}
                    eager
                    className='tm-home-hero-image'
                  />
                }
                ambient={<PublicPoster src={featured.poster} alt='' eager />}
                onPlay={() => openWork(featured)}
                onTogether={() =>
                  router.push(
                    '/login?redirect=' + encodeURIComponent('/watch-room')
                  )
                }
                titles={recommendations.map((item) => item.title)}
                index={heroIndex}
                onSelect={setHeroIndex}
                onPause={setPaused}
              />
            ) : (
              <div
                className={
                  'tm-home-hero-panel tm-home-hero-loading' +
                  (catalog.loading ? ' tm-skeleton' : '')
                }
              >
                {' '}
                {catalog.loading ? '正在加载推荐' : '暂时没有推荐内容'}
              </div>
            )}
          </PageContainer>
        )}
        <ContentContainer
          className={isHome ? 'tm-home-content-v3' : 'tm-home-content'}
        >
          {isHome ? (
            <>
              <div className='tm-home-resume-rooms'>
                <HomeRooms guest />
              </div>
              <div className='tm-category-row'>
                {publicCatalogCategories.map((item) => (
                  <Link
                    key={item.type}
                    href={item.href}
                    className='tm-tool-link'
                    aria-current={item.type === 'movie' ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <section className='tm-public-section' data-module='hotMovies'>
                <SectionHeader
                  title='热门电影'
                  href='/douban?type=movie'
                  className='tm-public-section-heading'
                />
                <CatalogCards
                  items={catalog.items}
                  onSelect={openWork}
                  horizontal
                />
                <CatalogFeedback feed={catalog} />
              </section>
              <section className='tm-public-section'>
                <SectionHeader
                  title='热门剧集'
                  href='/douban?type=tv'
                  className='tm-public-section-heading'
                />
                <CatalogCards
                  items={television.items}
                  onSelect={openWork}
                  horizontal
                />
                <CatalogFeedback feed={television} />
              </section>
            </>
          ) : (
            <>
              <div className='tm-public-library-heading'>
                <h1>片库</h1>
                <p>浏览公开影视信息，登录后查找片源、收藏作品或一起观看。</p>
              </div>
              <nav className='tm-public-filters' aria-label='影视类型'>
                {publicCatalogCategories.map((item) => (
                  <Link
                    key={item.type}
                    href={item.href}
                    aria-current={type === item.type ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div
                className='tm-public-tags'
                role='group'
                aria-label='影片分类'
              >
                {tags.map((value) => (
                  <button
                    type='button'
                    key={value}
                    aria-pressed={tag === value}
                    onClick={() => setSelectedTag(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <CatalogCards items={catalog.items} onSelect={openWork} />
              <CatalogFeedback feed={catalog} />
              {!!catalog.items.length && catalog.hasMore && !catalog.error && (
                <div className='tm-public-more'>
                  <button
                    type='button'
                    className='tm-tool-link'
                    disabled={catalog.loading}
                    onClick={() => void catalog.load()}
                  >
                    {catalog.loading ? '正在加载…' : '加载更多影片'}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </ContentContainer>
      </div>
    </PageLayout>
  );
}
