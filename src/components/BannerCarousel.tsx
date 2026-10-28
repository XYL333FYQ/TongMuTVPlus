'use client';

import { Star, Volume2, VolumeX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getDoubanDetail } from '@/lib/douban.client';
import {
  type TMDBItem,
  getGenreNames,
  getTMDBImageUrl,
} from '@/lib/tmdb.client';

import HomeHero from '@/components/catalog/HomeHero';
import DetailPanel from '@/components/DetailPanel';
import ProxyImage from '@/components/ProxyImage';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  filmPlaybackHref,
  togetherSelectionHref,
} from '@/features/playback/selection-links';

const LOCALSTORAGE_DURATION = 24 * 60 * 60 * 1000;

interface BannerCarouselProps {
  autoPlayInterval?: number; // 自动播放间隔（毫秒）
  delayLoad?: boolean; // 是否延迟加载（等页面加载完毕后再加载）
}

type HomeBannerHeightScale = '1' | '1.5' | '2';

const getSavedBannerHeightScale = (): HomeBannerHeightScale => {
  if (typeof window === 'undefined') return '1';

  const saved = localStorage.getItem('homeBannerHeightScale');
  return saved === '1.5' || saved === '2' ? saved : '1';
};

// 扩展TMDBItem类型以支持TX数据源的额外字段
interface BannerItem extends TMDBItem {
  subtitle?: string; // TX数据源的子标题
  tags?: string[]; // TX数据源的标签
  trailer_url?: string | null; // 豆瓣预告片直链
  genres?: string[]; // 豆瓣数据源的类型标签
}

export default function BannerCarousel({
  autoPlayInterval = 8000,
  delayLoad = false,
}: BannerCarouselProps) {
  const router = useRouter();
  const [items, setItems] = useState<BannerItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(!delayLoad); // 是否应该开始加载数据
  const [isYouTubeAccessible, setIsYouTubeAccessible] = useState(false); // YouTube连通性（默认false，检查后再决定）
  const [enableTrailers, setEnableTrailers] = useState(false); // 是否启用预告片（默认关闭）
  const [dataSource, setDataSource] = useState<string>(''); // 当前数据源
  const [isMuted, setIsMuted] = useState(true); // 视频是否静音（默认静音）
  const [_bannerHeightScale, setBannerHeightScale] =
    useState<HomeBannerHeightScale>('1'); // 轮播图高度倍率
  const [isMobileView, setIsMobileView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [hasActivePlayback, setHasActivePlayback] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const watchRoom = useWatchRoomContextSafe();
  const previewAllowed =
    enableTrailers &&
    !isMobileView &&
    !reducedMotion &&
    !hasActivePlayback &&
    !watchRoom?.currentRoom &&
    isPageVisible;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () =>
      setReducedMotion(
        preference.matches ||
          document.documentElement.dataset.tmReducedMotion === 'true'
      );
    const updateVisibility = () =>
      setIsPageVisible(document.visibilityState === 'visible');
    const updatePlayback = (event: Event) => {
      setHasActivePlayback(
        Boolean((event as CustomEvent<{ active: boolean }>).detail?.active)
      );
    };
    updateMotion();
    updateVisibility();
    setHasActivePlayback(
      document.documentElement.dataset.tmPlaybackActive === 'true'
    );
    preference.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('tm-playback-state', updatePlayback);
    window.addEventListener('tm-visual-preferences-change', updateMotion);
    return () => {
      preference.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('tm-playback-state', updatePlayback);
      window.removeEventListener('tm-visual-preferences-change', updateMotion);
    };
  }, []);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map()); // 所有视频元素的引用
  const isManualChange = useRef(false); // 标记是否为手动切换
  const manualReset = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(manualReset.current), []);
  const beginManualChange = useCallback(() => {
    isManualChange.current = true;
    clearTimeout(manualReset.current);
    manualReset.current = setTimeout(() => {
      isManualChange.current = false;
    }, 100);
  }, []);

  // 根据数据源获取缓存key
  const getLocalStorageKey = (source: string) => {
    return `banner_trending_cache_${source}`;
  };

  // 先查找片源，用户选择播放前保持当前播放会话。
  const handlePlay = (title: string) => {
    router.push(`/search?q=${encodeURIComponent(title)}`);
  };

  // 切换音量
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // 直接更新当前视频元素的静音状态
    const currentVideo = videoRefs.current.get(currentIndex);
    if (currentVideo) {
      currentVideo.muted = newMutedState;
    }
  };

  // 获取图片原始URL（处理TX完整URL和TMDB路径）
  const getImageUrl = (path: string | null) => {
    if (!path) return '';
    // 如果是完整URL（TX数据源或豆瓣），直接返回原始地址
    if (path.startsWith('http://') || path.startsWith('https://')) {
      // 豆瓣中图只有 540 宽，铺满大图会糊；换成同一张的大图（1080 宽）
      return path.replace(/\/[sm]_ratio_poster\//, '/l_ratio_poster/');
    }
    // 否则使用TMDB的URL拼接原始地址
    return getTMDBImageUrl(path, 'original');
  };

  // 获取视频URL（处理豆瓣视频代理）
  const getVideoUrl = (url: string | null) => {
    if (!url) return null;
    // 豆瓣视频直接使用服务器代理
    if (url.includes('doubanio.com')) {
      return `/api/video-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  // 读取本地设置
  useEffect(() => {
    const setting = localStorage.getItem('enableTrailers');
    if (setting !== null) {
      setEnableTrailers(setting === 'true');
    }

    setBannerHeightScale(getSavedBannerHeightScale());

    const handleHomeModulesUpdated = () => {
      setBannerHeightScale(getSavedBannerHeightScale());
    };

    window.addEventListener('homeModulesUpdated', handleHomeModulesUpdated);
    return () => {
      window.removeEventListener(
        'homeModulesUpdated',
        handleHomeModulesUpdated
      );
    };
  }, []);

  // 移动端保持静态推荐，避免额外视频资源占用
  useEffect(() => {
    const updateIsMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    updateIsMobileView();
    window.addEventListener('resize', updateIsMobileView);
    return () => window.removeEventListener('resize', updateIsMobileView);
  }, []);

  // 延迟加载：等待页面加载完毕后再开始加载轮播图数据
  useEffect(() => {
    if (!delayLoad) return;

    // 页面加载完毕后再开始加载
    if (document.readyState === 'complete') {
      setShouldLoad(true);
    } else {
      const handleLoad = () => {
        setShouldLoad(true);
      };
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [delayLoad]);

  // 检测YouTube连通性 - 仅在启用预告片且数据源为TMDB时检测
  useEffect(() => {
    // 如果未启用预告片或数据源不是TMDB，不进行检测
    if (!previewAllowed || dataSource !== 'TMDB') {
      setIsYouTubeAccessible(false);
      return;
    }

    const checkYouTubeAccess = () => {
      const img = document.createElement('img');
      const timeout = setTimeout(() => {
        img.src = '';
        setIsYouTubeAccessible(false);
      }, 3000);

      img.onload = () => {
        clearTimeout(timeout);
        setIsYouTubeAccessible(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        setIsYouTubeAccessible(false);
      };

      // 添加随机查询参数避免缓存
      img.src = `https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg?t=${Date.now()}`;
    };

    checkYouTubeAccess();
  }, [previewAllowed, dataSource]);

  // 获取热门内容
  useEffect(() => {
    // 如果不应该加载，直接返回
    if (!shouldLoad) return;

    const fetchTrending = async () => {
      try {
        // 先尝试从所有可能的数据源缓存中读取，找到最新的缓存
        const sources = ['TMDB', 'TX', 'Douban'];
        let cachedData = null;
        let validSource = null;
        let cacheExpired = false;
        let latestTimestamp = 0;

        // 遍历所有数据源，找到最新的缓存
        for (const source of sources) {
          const cacheKey = getLocalStorageKey(source);
          const cached = localStorage.getItem(cacheKey);

          if (cached) {
            try {
              const { data, timestamp } = JSON.parse(cached);

              // 选择时间戳最新的缓存
              if (timestamp > latestTimestamp) {
                cachedData = data;
                validSource = source;
                latestTimestamp = timestamp;
                cacheExpired = Date.now() - timestamp > LOCALSTORAGE_DURATION;
              }
            } catch (e) {
              console.error('解析缓存数据失败:', e);
            }
          }
        }

        // 乐观缓存：如果有缓存（无论是否过期），先显示缓存数据
        if (cachedData) {
          setItems(cachedData);
          setDataSource(validSource || ''); // 设置数据源
          setIsLoading(false);
        }

        // 如果缓存过期或没有缓存，后台更新数据
        if (!cachedData || cacheExpired) {
          const response = await fetch('/api/tmdb/trending');
          const result = await response.json();

          if (result.code === 200 && result.list.length > 0) {
            const newDataSource = result.source || 'TMDB'; // 获取数据源标识
            const cacheKey = getLocalStorageKey(newDataSource);

            setItems(result.list);
            setDataSource(newDataSource); // 设置数据源

            // 保存到 localStorage（使用数据源特定的key）
            try {
              localStorage.setItem(
                cacheKey,
                JSON.stringify({
                  data: result.list,
                  timestamp: Date.now(),
                })
              );
            } catch (e) {
              // localStorage 可能已满，忽略错误
              console.error('保存到 localStorage 失败:', e);
            }
          }
        }
      } catch (error) {
        console.error('获取热门内容失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, [shouldLoad]);

  // Only resolve a trailer for the visible item. Browsing must not compete
  // with the persistent film or room playback session.
  useEffect(() => {
    const item = items[currentIndex];
    if (
      !previewAllowed ||
      dataSource !== 'Douban' ||
      !item ||
      item.trailer_url !== undefined
    )
      return;
    let cancelled = false;
    getDoubanDetail(item.id.toString())
      .then((detail) => {
        if (cancelled) return;
        const trailerUrl = detail.trailers?.[0]?.video_url || null;
        setItems((previous) =>
          previous.map((entry) =>
            entry.id === item.id ? { ...entry, trailer_url: trailerUrl } : entry
          )
        );
      })
      .catch(() => {
        if (!cancelled)
          setItems((previous) =>
            previous.map((entry) =>
              entry.id === item.id ? { ...entry, trailer_url: null } : entry
            )
          );
      });
    return () => {
      cancelled = true;
    };
  }, [previewAllowed, dataSource, currentIndex, items]);

  // 切换轮播图时重置静音状态
  useEffect(() => {
    setIsMuted(true);
  }, [currentIndex]);

  // 控制视频播放/暂停和静音状态
  useEffect(() => {
    // 遍历所有视频元素
    videoRefs.current.forEach((video, index) => {
      if (index === currentIndex && previewAllowed) {
        // 当前显示的视频：播放并设置静音状态
        video.muted = isMuted;
        video.play().catch(() => {
          // 忽略自动播放失败的错误
        });
      } else {
        // 非当前显示的视频：暂停
        video.pause();
      }
    });
  }, [currentIndex, isMuted, previewAllowed]);

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      beginManualChange();
      setCurrentIndex(index);
    },
    [items.length, beginManualChange]
  );

  if (isLoading || !shouldLoad) {
    return (
      <div
        className='tm-home-hero-panel tm-skeleton'
        aria-label='正在加载推荐'
      />
    );
  }

  if (!items.length) {
    return (
      <div className='tm-home-hero-panel tm-home-hero-loading'>
        <div>
          <p>暂时没有推荐内容</p>
          <button
            className='tm-btn tm-btn-secondary'
            onClick={() => router.push('/search')}
          >
            搜索片名
          </button>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex] || items[0];
  const genres = currentItem.tags?.length
    ? currentItem.tags
    : currentItem.genres?.length
    ? currentItem.genres
    : getGenreNames(currentItem.genre_ids, 3);
  const canShowVideo =
    previewAllowed &&
    Boolean(currentItem.backdrop_path) &&
    Boolean(currentItem.trailer_url);
  const canShowYouTube =
    previewAllowed &&
    Boolean(currentItem.backdrop_path) &&
    !currentItem.trailer_url &&
    currentItem.video_key &&
    isYouTubeAccessible;

  return (
    <>
      <HomeHero
        id={String(currentItem.id)}
        title={currentItem.title}
        description={currentItem.overview}
        contain={dataSource === 'Douban' || !currentItem.backdrop_path}
        meta={
          <>
            {currentItem.vote_average > 0 && (
              <span className='tm-hero-score'>
                <Star aria-hidden />
                {currentItem.vote_average.toFixed(1)}
              </span>
            )}
            {currentItem.release_date && (
              <span>{currentItem.release_date.slice(0, 4)}</span>
            )}
            {genres.length > 0 && (
              <span className='tm-home-hero-genres'>
                {genres.slice(0, 3).map((genre, i) => (
                  <span className='tm-home-hero-genre' key={genre + i}>
                    {genre}
                  </span>
                ))}
              </span>
            )}
          </>
        }
        art={
          canShowVideo ? (
            <video
              ref={(element) => {
                videoRefs.current.clear();
                if (element) videoRefs.current.set(currentIndex, element);
              }}
              src={getVideoUrl(currentItem.trailer_url || null) || undefined}
              poster={getImageUrl(
                currentItem.backdrop_path || currentItem.poster_path
              )}
              muted={isMuted}
              autoPlay
              loop
              playsInline
              preload='metadata'
            />
          ) : canShowYouTube ? (
            <iframe
              title={currentItem.title + ' 预告片'}
              src={`https://www.youtube.com/embed/${currentItem.video_key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${currentItem.video_key}`}
              allow='autoplay; encrypted-media'
              className='tm-hero-youtube pointer-events-none'
              tabIndex={-1}
            />
          ) : (
            <ProxyImage
              originalSrc={getImageUrl(
                currentItem.backdrop_path || currentItem.poster_path
              )}
              alt={currentItem.title}
              loading='eager'
              onLoad={(event) => {
                event.currentTarget.dataset.loaded = 'true';
              }}
              className='tm-home-hero-image'
            />
          )
        }
        onPlay={() => handlePlay(currentItem.title)}
        onTogether={() =>
          router.push(
            togetherSelectionHref(
              filmPlaybackHref({
                title: currentItem.title,
                year: currentItem.release_date?.slice(0, 4),
                searchType: currentItem.media_type === 'tv' ? 'tv' : 'movie',
              })
            )
          )
        }
        onDetail={() => setDetailOpen(true)}
        deck={items.map((item) => ({
          id: String(item.id),
          title: item.title,
          src: getImageUrl(item.poster_path || item.backdrop_path || null),
        }))}
        titles={items.map((item) => item.title)}
        index={currentIndex}
        onSelect={goToSlide}
        onAutoSelect={setCurrentIndex}
        autoPlayInterval={autoPlayInterval}
        autoPlayDisabled={detailOpen || hasActivePlayback}
        extraControls={
          canShowVideo ? (
            <button
              className='tm-icon-btn tm-home-hero-arrow'
              onClick={toggleMute}
              aria-label={isMuted ? '开启预告片声音' : '关闭预告片声音'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          ) : undefined
        }
      />
      <DetailPanel
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={currentItem.title}
        poster={getImageUrl(currentItem.poster_path)}
        year={currentItem.release_date?.slice(0, 4)}
        tmdbId={dataSource === 'TMDB' ? currentItem.id : undefined}
        doubanId={dataSource === 'Douban' ? currentItem.id : undefined}
        type={currentItem.media_type === 'tv' ? 'tv' : 'movie'}
        onPlay={() => handlePlay(currentItem.title)}
        onTogether={() =>
          router.push(
            togetherSelectionHref(
              filmPlaybackHref({
                title: currentItem.title,
                year: currentItem.release_date?.slice(0, 4),
                searchType: currentItem.media_type === 'tv' ? 'tv' : 'movie',
              })
            )
          )
        }
        backdrop={getImageUrl(currentItem.backdrop_path || null)}
      />
    </>
  );
}
