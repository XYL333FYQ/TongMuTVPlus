'use client';

import {
  ArrowRight,
  Film,
  Play,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import './public-catalog.css';

import { useReducedMotionSetting } from '@/lib/motion';
import type { PublicCatalogItem } from '@/lib/public-catalog';

import HomeHero from './HomeHero';
import HomeRooms from './HomeRooms';
import PageContainer from './PageContainer';
import PageLayout from './PageLayout';
import PosterAmbient from './PosterAmbient';
import PosterGrid from './PosterGrid';
import PosterMotion from './PosterMotion';
import PublicPoster from './PublicPoster';

function usePublicCatalog(type: 'movie' | 'tv', tag: string, enabled = true) {
  const [items, setItems] = useState<PublicCatalogItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const nextStart = useRef(0);
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
      }
      const params = new URLSearchParams({
        mode: 'browse',
        type,
        tag,
        limit: '20',
        start: String(reset ? 0 : nextStart.current),
      });
      try {
        const response = await fetch('/api/public/catalog?' + params, {
          signal: request.signal,
        });
        if (!response.ok) throw new Error('catalog unavailable');
        const data = (await response.json()) as {
          items: PublicCatalogItem[];
          start: number;
          hasMore: boolean;
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
        nextStart.current = data.start + incoming.length;
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

function PublicFilmDetails({
  item,
  onClose,
}: {
  item: PublicCatalogItem | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (item && !dialog.current?.open) dialog.current?.showModal();
    else if (!item) dialog.current?.close();
  }, [item]);
  const playParams = item
    ? new URLSearchParams({
        title: item.title,
        year: item.year,
        type: item.mediaType,
      })
    : null;
  return (
    <dialog
      ref={dialog}
      className='tm-public-detail'
      aria-labelledby='tm-public-detail-title'
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {item && (
        <div className='tm-public-detail-body'>
          {item.poster && (
            <PosterAmbient imageKey={item.poster}>
              <PublicPoster src={item.poster} alt='' />
            </PosterAmbient>
          )}
          <button
            type='button'
            className='tm-public-detail-close'
            onClick={onClose}
            aria-label='关闭影片介绍'
          >
            <X size={20} />
          </button>
          <div className='tm-public-detail-art'>
            {item.poster ? (
              <PublicPoster src={item.poster} alt={item.title + ' 海报'} />
            ) : (
              <Film size={48} aria-hidden />
            )}
          </div>
          <div className='tm-public-detail-copy'>
            <span className='tm-section-label'>
              {item.mediaType === 'tv' ? '剧集' : '电影'} · 影片介绍
            </span>
            <h2 id='tm-public-detail-title'>{item.title}</h2>
            <p className='tm-public-detail-meta'>
              {[
                item.year,
                Number(item.rate) > 0
                  ? '评分 ' + Number(item.rate).toFixed(1)
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p>
              {item.description ||
                '暂无剧情介绍。你可以搜索片名，寻找更多影视信息。'}
            </p>
            <div className='tm-public-detail-actions'>
              <Link
                href={'/play?' + playParams}
                prefetch={false}
                className='tm-tool-link'
              >
                <Play size={15} />
                播放
              </Link>
              <Link
                href='/watch-room'
                className='tm-tool-link'
                onClick={onClose}
              >
                <Users size={15} />
                一起看
              </Link>
              <Link
                href={'/search?q=' + encodeURIComponent(item.title)}
                className='tm-tool-link'
                onClick={onClose}
              >
                <Search size={15} />
                搜索片名
              </Link>
            </div>
            <small>
              影片信息来自 {item.provider === 'tmdb' ? 'TMDB' : '豆瓣'}
              。登录后可查看已接入的片源与播放情况。
            </small>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Public metadata only: no playback sources, user records or source-search cache. */
export default function PublicCatalogPage({
  mode,
}: {
  mode: 'home' | 'library';
}) {
  const params = useSearchParams();
  const isHome = mode === 'home';
  const requestedType = params.get('type') || 'movie';
  const type = !isHome && requestedType === 'tv' ? 'tv' : 'movie';
  const [selectedTag, setSelectedTag] = useState('热门');
  const tags =
    type === 'movie'
      ? ['热门', '最新', '经典']
      : ['热门', '国产剧', '美剧', '英剧', '韩剧', '日剧'];
  const tag = isHome || !tags.includes(selectedTag) ? '热门' : selectedTag;
  const catalog = usePublicCatalog(type, tag);
  const television = usePublicCatalog('tv', '热门', isHome);
  const [selected, setSelected] = useState<PublicCatalogItem | null>(null);
  const router = useRouter();
  const reduced = useReducedMotionSetting();
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const recommendations = catalog.items.slice(0, 5);
  const featured = recommendations[heroIndex] || recommendations[0];
  useEffect(() => {
    if (!isHome || reduced || paused || selected || recommendations.length < 2)
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        setHeroIndex((index) => (index + 1) % recommendations.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isHome, reduced, paused, selected, recommendations.length]);
  const ContentContainer = isHome ? PageContainer : 'div';

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
                onPlay={() =>
                  router.push(
                    '/play?' +
                      new URLSearchParams({
                        title: featured.title,
                        year: featured.year,
                        type: featured.mediaType,
                      })
                  )
                }
                onTogether={() => router.push('/watch-room')}
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
                <Link href='/douban?type=movie' className='tm-tool-link'>
                  电影
                  <ArrowRight size={13} />
                </Link>
                <Link href='/douban?type=tv' className='tm-tool-link'>
                  剧集
                  <ArrowRight size={13} />
                </Link>
                <Link href='/search' className='tm-tool-link'>
                  <Search size={14} />
                  按片名寻找
                </Link>
              </div>
              <section className='tm-public-section'>
                <div className='tm-public-section-heading'>
                  <h2>热门电影</h2>
                  <Link href='/douban?type=movie'>
                    查看全部
                    <ArrowRight size={14} />
                  </Link>
                </div>
                <CatalogCards
                  items={catalog.items}
                  onSelect={setSelected}
                  horizontal
                />
                <CatalogFeedback feed={catalog} />
              </section>
              <section className='tm-public-section'>
                <div className='tm-public-section-heading'>
                  <h2>热门剧集</h2>
                  <Link href='/douban?type=tv'>
                    查看全部
                    <ArrowRight size={14} />
                  </Link>
                </div>
                <CatalogCards
                  items={television.items}
                  onSelect={setSelected}
                  horizontal
                />
                <CatalogFeedback feed={television} />
              </section>
            </>
          ) : (
            <>
              <div className='tm-public-library-heading'>
                <span className='tm-section-label'>找到下一个喜欢的故事</span>
                <h1>片库</h1>
                <p>浏览公开影视信息，登录后查找片源、收藏作品或一起观看。</p>
              </div>
              {!['movie', 'tv'].includes(requestedType) && (
                <p className='tm-public-feedback'>
                  当前展示公开电影与剧集。登录后可进入动漫、综艺等专属分类。
                </p>
              )}
              <nav className='tm-public-filters' aria-label='影视类型'>
                <Link
                  href='/douban?type=movie'
                  aria-current={type === 'movie' ? 'page' : undefined}
                >
                  电影
                </Link>
                <Link
                  href='/douban?type=tv'
                  aria-current={type === 'tv' ? 'page' : undefined}
                >
                  剧集
                </Link>
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
              <CatalogCards items={catalog.items} onSelect={setSelected} />
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
      <PublicFilmDetails item={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  );
}
