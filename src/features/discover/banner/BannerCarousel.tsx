'use client';

import { Star, Volume2, VolumeX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { viewportSize } from '@/lib/device-tier';
import { useReducedMotionSetting } from '@/lib/motion';
import { filmPlaybackHref, roomSelectionHref } from '@/lib/playback-links';
import { readSetting } from '@/lib/settings';
import { getGenreNames } from '@/lib/tmdb-image-base';

import HomeHero from '@/components/catalog/HomeHero';
import DetailPanel from '@/components/DetailPanel';
import ProxyImage from '@/components/ProxyImage';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  type HomeBannerHeightScale,
  bannerImageUrl,
  bannerVideoUrl,
  getSavedBannerHeightScale,
} from './banner-data';
import { useBannerItems } from './useBannerItems';

interface BannerCarouselProps {
  autoPlayInterval?: number; // 自动播放间隔（毫秒）
  delayLoad?: boolean; // 是否延迟加载（等页面加载完毕后再加载）
}

export default function BannerCarousel({
  autoPlayInterval = 8000,
  delayLoad = false,
}: BannerCarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(!delayLoad); // 是否应该开始加载数据
  const [isYouTubeAccessible, setIsYouTubeAccessible] = useState(false); // YouTube连通性（默认false，检查后再决定）
  const [enableTrailers, setEnableTrailers] = useState(false); // 是否启用预告片（默认关闭）
  const [isMuted, setIsMuted] = useState(true); // 视频是否静音（默认静音）
  const [_bannerHeightScale, setBannerHeightScale] =
    useState<HomeBannerHeightScale>('1'); // 轮播图高度倍率
  const [isMobileView, setIsMobileView] = useState(true);
  // 减弱动效：系统设置或站内开关，全站同一个来源（lib/motion）
  const reducedMotion = useReducedMotionSetting();
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
  const { items, dataSource, isLoading } = useBannerItems({
    shouldLoad,
    previewAllowed,
    currentIndex,
    setCurrentIndex,
  });

  useEffect(() => {
    const updateVisibility = () =>
      setIsPageVisible(document.visibilityState === 'visible');
    const updatePlayback = (event: Event) => {
      setHasActivePlayback(
        Boolean((event as CustomEvent<{ active: boolean }>).detail?.active)
      );
    };
    updateVisibility();
    setHasActivePlayback(
      document.documentElement.dataset.tmPlaybackActive === 'true'
    );
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('tm-playback-state', updatePlayback);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('tm-playback-state', updatePlayback);
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

  // 读取本地设置
  useEffect(() => {
    const setting = readSetting('enableTrailers');
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
      setIsMobileView(viewportSize().width < 768);
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
              src={bannerVideoUrl(currentItem.trailer_url || null) || undefined}
              poster={bannerImageUrl(
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
              className='tm-home-hero-youtube'
              tabIndex={-1}
            />
          ) : (
            <ProxyImage
              originalSrc={bannerImageUrl(
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
        onWatchInRoom={() =>
          router.push(
            roomSelectionHref(
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
          src: bannerImageUrl(item.poster_path || item.backdrop_path || null),
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
        poster={bannerImageUrl(currentItem.poster_path)}
        year={currentItem.release_date?.slice(0, 4)}
        tmdbId={dataSource === 'TMDB' ? currentItem.id : undefined}
        doubanId={dataSource === 'Douban' ? currentItem.id : undefined}
        type={currentItem.media_type === 'tv' ? 'tv' : 'movie'}
        onPlay={() => handlePlay(currentItem.title)}
        onWatchInRoom={() =>
          router.push(
            roomSelectionHref(
              filmPlaybackHref({
                title: currentItem.title,
                year: currentItem.release_date?.slice(0, 4),
                searchType: currentItem.media_type === 'tv' ? 'tv' : 'movie',
              })
            )
          )
        }
        backdrop={bannerImageUrl(currentItem.backdrop_path || null)}
      />
    </>
  );
}
