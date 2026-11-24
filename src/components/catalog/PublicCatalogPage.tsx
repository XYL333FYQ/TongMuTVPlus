'use client';

import { Film, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { posterTiltHandlers } from '@/lib/motion';
import { filmPlaybackHref, roomSelectionHref } from '@/lib/playback-links';
import {
  type PublicCatalogCategory,
  type PublicCatalogItem,
  publicCatalogCategories,
  publicWorkLoginHref,
} from '@/lib/public-catalog';

import HomeHero from '@/components/catalog/HomeHero';
import PosterGrid from '@/components/catalog/PosterGrid';
import PosterMotion from '@/components/catalog/PosterMotion';
import PublicPoster from '@/components/catalog/PublicPoster';
import SectionHeader from '@/components/catalog/SectionHeader';
import EmptyState from '@/components/feedback/EmptyState';
import RetryNotice from '@/components/feedback/RetryNotice';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import FilmPoster from '@/components/poster/FilmPoster';

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
        if (!request.signal.aborted) setError('影视信息暂时无法获取');
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

function CatalogCard({
  item,
  onSelect,
}: {
  item: PublicCatalogItem;
  onSelect: (item: PublicCatalogItem) => void;
}) {
  // 所在分区已经说明了类型，卡片下面只写年份；没有年份就不留空行
  const meta = item.year || '';
  return (
    <button
      type='button'
      className='tm-video-card tm-public-card'
      {...posterTiltHandlers}
      onClick={() => onSelect(item)}
      aria-label={'查看影片介绍：' + item.title}
    >
      <FilmPoster
        guest
        src={item.poster}
        title={item.title}
        className='tm-video-card-art'
      >
        {item.rate && Number(item.rate) > 0 && (
          <span className='mtv-rate'>
            <Star size={11} aria-hidden />
            {Number(item.rate).toFixed(1)}
          </span>
        )}
      </FilmPoster>
      <span className='tm-poster-title'>{item.title}</span>
      {meta && <span className='tm-poster-meta'>{meta}</span>}
    </button>
  );
}

/** 大图要铺满半屏：豆瓣小/中图换大图，TMDB 换 1280 宽 */
function heroImage(url: string) {
  return url
    .replace(/\/[sm]_ratio_poster\//, '/l_ratio_poster/')
    .replace('/t/p/w500/', '/t/p/w1280/');
}

function CatalogFeedback({
  feed,
}: {
  feed: ReturnType<typeof usePublicCatalog>;
}) {
  if (feed.error)
    return (
      <RetryNotice
        message={feed.error}
        retryLabel='重新获取'
        onRetry={() => void feed.load(feed.items.length === 0)}
      />
    );
  if (feed.loading && !feed.items.length) {
    const placeholders = Array.from({ length: 12 }, (_, index) => (
      <div key={index} className='tm-home-skeleton tm-skeleton' />
    ));
    return (
      <div aria-busy='true' aria-label='正在获取影视信息'>
        <PosterGrid>{placeholders}</PosterGrid>
      </div>
    );
  }
  if (!feed.loading && !feed.items.length)
    return (
      <EmptyState icon={<Film size={24} />} title='暂时没有相关影视信息' />
    );
  return null;
}

function CategoryLinks() {
  return (
    <nav
      className='tm-chips tm-home-categories'
      data-scroll='true'
      aria-label='影视分类'
    >
      {publicCatalogCategories.map((item) => (
        <Link key={item.type} href={item.href} className='tm-chip'>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** 只用公开资料：不读片源、个人记录或片源搜索缓存。 */
export default function PublicCatalogPage({
  mode,
  category,
  rooms,
}: {
  mode: 'home' | 'library';
  category?: PublicCatalogCategory;
  /** 首页“正在一起看”那一栏，由页面传入（房间是另一个功能，共用组件不直接引用） */
  rooms?: ReactNode;
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
  const [heroIndex, setHeroIndex] = useState(0);
  const recommendations = catalog.items.slice(0, 5);
  const featured = recommendations[heroIndex] || recommendations[0];

  if (!isHome)
    return (
      <PageLayout activePath='/douban'>
        <PageContainer>
          <header className='tm-page-head'>
            <div>
              <h1 className='tm-page-title'>片库</h1>
              <p className='tm-page-desc'>登录后可以播放、收藏和一起看</p>
            </div>
          </header>
          <nav className='tm-tabs' aria-label='影视类型'>
            {publicCatalogCategories.map((item) => (
              <Link
                key={item.type}
                href={item.href}
                className='tm-tab'
                aria-current={type === item.type ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {tags.length > 1 && (
            <div
              className='tm-chips tm-library-tags'
              data-scroll='true'
              role='group'
              aria-label='影片分类'
            >
              {tags.map((value) => (
                <button
                  type='button'
                  key={value}
                  className='tm-chip'
                  aria-pressed={tag === value}
                  onClick={() => setSelectedTag(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
          <div className='tm-library-grid'>
            {catalog.items.length > 0 && (
              <PosterGrid>
                {catalog.items.map((item) => (
                  <CatalogCard
                    key={item.provider + ':' + item.id}
                    item={item}
                    onSelect={openWork}
                  />
                ))}
              </PosterGrid>
            )}
            <CatalogFeedback feed={catalog} />
          </div>
          {!!catalog.items.length && catalog.hasMore && !catalog.error && (
            <div className='tm-library-more'>
              <button
                type='button'
                className='tm-btn tm-btn-secondary'
                disabled={catalog.loading}
                onClick={() => void catalog.load()}
              >
                {catalog.loading ? '正在加载…' : '加载更多'}
              </button>
            </div>
          )}
        </PageContainer>
      </PageLayout>
    );

  return (
    <PageLayout activePath='/'>
      <div className='tm-home'>
        {/* 桌面没有手机顶栏，页名留给读屏软件（手机上由顶栏提供） */}
        <h1 className='tm-desktop-page-name'>发现</h1>
        <div className='tm-home-stage'>
          {featured ? (
            <HomeHero
              id={featured.provider + ':' + featured.id}
              title={featured.title}
              meta={
                <>
                  {featured.year && <span>{featured.year}</span>}
                  <span className='tm-home-hero-genres'>
                    <span className='tm-home-hero-genre'>
                      {featured.mediaType === 'tv' ? '剧集' : '电影'}
                    </span>
                  </span>
                </>
              }
              description={featured.description}
              contain
              art={
                <PublicPoster
                  src={heroImage(featured.poster)}
                  alt={featured.title}
                  eager
                  className='tm-home-hero-image'
                />
              }
              onPlay={() => openWork(featured)}
              onWatchInRoom={() =>
                router.push(
                  '/login?redirect=' +
                    encodeURIComponent(
                      roomSelectionHref(
                        filmPlaybackHref({
                          title: featured.title,
                          year: featured.year,
                          searchType: featured.mediaType,
                        })
                      )
                    )
                )
              }
              deck={recommendations.map((item) => ({
                id: item.provider + ':' + item.id,
                title: item.title,
                src: heroImage(item.poster),
              }))}
              renderPoster={(item) => (
                <FilmPoster
                  key={item.id}
                  guest
                  src={item.src}
                  title={item.title}
                  fit='contain'
                  className='tm-home-hero-deck-art'
                />
              )}
              titles={recommendations.map((item) => item.title)}
              index={heroIndex}
              onSelect={setHeroIndex}
            />
          ) : (
            <div
              className={
                'tm-home-hero-panel tm-home-hero-loading' +
                (catalog.loading ? ' tm-skeleton' : '')
              }
            >
              {catalog.loading ? '' : '暂时没有推荐内容'}
            </div>
          )}
        </div>
        <PageContainer className='tm-home-body'>
          <div className='tm-home-pair'>{rooms}</div>
          <CategoryLinks />
          {[
            { title: '热门电影', href: '/douban?type=movie', feed: catalog },
            { title: '热门剧集', href: '/douban?type=tv', feed: television },
          ].map((section) => (
            <section key={section.title} className='tm-section tm-home-section'>
              <SectionHeader
                variant='home'
                title={section.title}
                href={section.href}
              />
              {section.feed.items.length > 0 && (
                <PosterGrid className='tm-home-grid'>
                  {section.feed.items.slice(0, 12).map((item) => (
                    <PosterMotion key={item.provider + ':' + item.id}>
                      <CatalogCard item={item} onSelect={openWork} />
                    </PosterMotion>
                  ))}
                </PosterGrid>
              )}
              <CatalogFeedback feed={section.feed} />
            </section>
          ))}
        </PageContainer>
      </div>
    </PageLayout>
  );
}
