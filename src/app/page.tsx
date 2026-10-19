/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { motion } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import { AI_WELCOME_MESSAGE } from '@/lib/brand';
import { getDoubanCategories } from '@/lib/douban.client';
import { useReducedMotionSetting } from '@/lib/motion';
import { getTMDBImageUrl, TMDBItem } from '@/lib/tmdb.client';
import { DoubanItem } from '@/lib/types';
import { base58Encode, processImageUrl } from '@/lib/utils';
import { useViewerIdentity } from '@/hooks/useViewerIdentity';

import AIChatPanel from '@/components/AIChatPanel';
import BannerCarousel from '@/components/BannerCarousel';
import ContinueWatching from '@/components/ContinueWatching';
import HomeRooms from '@/components/HomeRooms';
import HttpWarningDialog from '@/components/HttpWarningDialog';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import PosterGrid from '@/components/PosterGrid';
import PosterMotion from '@/components/PosterMotion';
import PublicCatalogPage from '@/components/PublicCatalogPage';
import SectionHeader from '@/components/SectionHeader';
import { useSite } from '@/components/SiteProvider';
import Toast, { ToastProps } from '@/components/Toast';
import VideoCard from '@/components/VideoCard';

// 首页模块配置接口
interface HomeModule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

function HomeClient() {
  const reduced = useReducedMotionSetting();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 移除了 activeTab 状态，收藏夹功能已移到 UserMenu
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [hotDuanju, setHotDuanju] = useState<any[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<TMDBItem[]>([]);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<
    BangumiCalendarData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { announcement, announcementDisplayMode } = useSite();
  // 首页模块配置状态
  const [homeModules, setHomeModules] = useState<HomeModule[]>([
    { id: 'hotMovies', name: '热门电影', enabled: true, order: 0 },
    { id: 'hotDuanju', name: '热播短剧', enabled: true, order: 1 },
    { id: 'bangumiCalendar', name: '新番放送', enabled: true, order: 2 },
    { id: 'hotTvShows', name: '热门剧集', enabled: true, order: 3 },
    { id: 'hotVarietyShows', name: '热门综艺', enabled: true, order: 4 },
    { id: 'upcomingContent', name: '即将上映', enabled: true, order: 5 },
  ]);
  const [homeBannerEnabled, setHomeBannerEnabled] = useState(true);
  const [homeContinueWatchingEnabled, setHomeContinueWatchingEnabled] =
    useState(true);

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showHttpWarning, setShowHttpWarning] = useState(true);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDefaultMessageNoVideo, setAiDefaultMessageNoVideo] =
    useState(AI_WELCOME_MESSAGE);
  const [_musicEnabled, setMusicEnabled] = useState(false);
  const [_mangaEnabled, setMangaEnabled] = useState(false);
  const [_booksEnabled, setBooksEnabled] = useState(false);
  const [netdiskTempPlayEnabled, setNetdiskTempPlayEnabled] = useState(false);
  const [showDirectPlayDialog, setShowDirectPlayDialog] = useState(false);
  const [directPlayUrl, setDirectPlayUrl] = useState('');
  const [directPlaySubmitting, setDirectPlaySubmitting] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const detectNetdiskLink = (
    url: string
  ): {
    provider: 'quark' | 'mobile' | 'baidu' | 'tianyi' | '123' | 'uc' | '115';
    shareUrl: string;
    passcode?: string;
  } | null => {
    const trimmed = url.trim();

    const pickPasscode = (...values: Array<string | undefined>) =>
      values.map((item) => item?.trim()).find(Boolean);

    const inlinePasscode = (text: string) =>
      pickPasscode(
        text.match(
          /(?:提取码|访问码|密码)\s*[:：=]?\s*([a-zA-Z0-9]{4,8})/i
        )?.[1],
        text.match(/[?&](?:pwd|passcode|accessCode)=([^&\s]+)/i)?.[1]
      );

    if (
      /https:\/\/(?:www\.)?123(?:684|865|912|pan)\.(?:com|cn)\/s\//i.test(
        trimmed
      )
    ) {
      return {
        provider: '123',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&]pwd=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (
      /https:\/\/cloud\.189\.cn\/(web\/share\?code=|t\/)/i.test(trimmed) ||
      /https:\/\/h5\.cloud\.189\.cn\/share\.html#\/t\//i.test(trimmed)
    ) {
      return {
        provider: 'tianyi',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&]pwd=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/pan\.baidu\.com\/(s\/|wap\/init\?surl=)/i.test(trimmed)) {
      return {
        provider: 'baidu',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:pwd|accessCode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/https:\/\/pan\.quark\.cn\/s\//i.test(trimmed)) {
      return {
        provider: 'quark',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:pwd|passcode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/https:\/\/drive\.uc\.cn\/s\//i.test(trimmed)) {
      return {
        provider: 'uc',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:pwd|passcode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/https:\/\/(?:yun|caiyun)\.139\.com\//i.test(trimmed)) {
      return { provider: 'mobile', shareUrl: trimmed };
    }

    if (/https:\/\/(?:115|anxia|115cdn)\.com\/s\//i.test(trimmed)) {
      return {
        provider: '115',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:password|pwd|passcode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    return null;
  };

  const handleDirectPlay = () => {
    setDirectPlayUrl('');
    setShowDirectPlayDialog(true);
  };

  useEffect(() => {
    if (searchParams.get('open') !== 'directplay') return;
    handleDirectPlay();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('open');
    const query = nextParams.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  }, [searchParams, router]);

  const submitDirectPlay = async () => {
    const trimmed = directPlayUrl.trim();
    if (!trimmed) return;
    setDirectPlaySubmitting(true);
    try {
      const netdisk = detectNetdiskLink(trimmed);
      if (netdisk && !netdiskTempPlayEnabled) {
        throw new Error('无权限使用临时播放');
      }

      if (netdisk) {
        const source =
          netdisk.provider === 'mobile'
            ? 'netdisk-mobile'
            : netdisk.provider === 'baidu'
            ? 'netdisk-baidu'
            : netdisk.provider === 'tianyi'
            ? 'netdisk-tianyi'
            : netdisk.provider === '115'
            ? 'netdisk-115'
            : netdisk.provider === 'uc'
            ? 'netdisk-uc'
            : netdisk.provider === '123'
            ? 'netdisk-123'
            : 'netdisk-quark';
        const id = base58Encode(
          JSON.stringify({
            shareUrl: netdisk.shareUrl,
            passcode: netdisk.passcode || '',
          })
        );
        if (!id) {
          throw new Error('网盘链接编码失败');
        }
        const targetUrl = `/play?source=${encodeURIComponent(
          source
        )}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(
          '网盘直链播放'
        )}`;
        setShowDirectPlayDialog(false);
        setDirectPlayUrl('');
        router.push(targetUrl);
        return;
      }

      const encoded = base58Encode(trimmed);
      if (!encoded) return;
      const targetUrl = `/play?source=directplay&id=${encodeURIComponent(
        encoded
      )}`;
      setShowDirectPlayDialog(false);
      setDirectPlayUrl('');
      router.push(targetUrl);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : '播放失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setDirectPlaySubmitting(false);
    }
  };

  const loadHomeLayoutSettings = () => {
    if (typeof window === 'undefined') return;

    const savedHomeModules = localStorage.getItem('homeModules');
    if (savedHomeModules) {
      try {
        setHomeModules(JSON.parse(savedHomeModules));
      } catch (error) {
        console.error('解析首页模块配置失败:', error);
      }
    }

    const savedHomeBannerEnabled = localStorage.getItem('homeBannerEnabled');
    if (savedHomeBannerEnabled !== null) {
      setHomeBannerEnabled(savedHomeBannerEnabled === 'true');
    }

    const savedHomeContinueWatchingEnabled = localStorage.getItem(
      'homeContinueWatchingEnabled'
    );
    if (savedHomeContinueWatchingEnabled !== null) {
      setHomeContinueWatchingEnabled(
        savedHomeContinueWatchingEnabled === 'true'
      );
    }
  };

  // 加载首页模块配置
  useEffect(() => {
    loadHomeLayoutSettings();
  }, []);

  // 监听首页模块配置更新事件
  useEffect(() => {
    const handleHomeModulesUpdated = () => {
      loadHomeLayoutSettings();
    };

    window.addEventListener('homeModulesUpdated', handleHomeModulesUpdated);
    return () => {
      window.removeEventListener(
        'homeModulesUpdated',
        handleHomeModulesUpdated
      );
    };
  }, []);

  // 检查AI功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        (window as any).RUNTIME_CONFIG?.AI_ENABLED &&
        (window as any).RUNTIME_CONFIG?.AI_ENABLE_HOMEPAGE_ENTRY;
      setAiEnabled(enabled);

      // 加载AI默认消息配置
      const defaultMsg = (window as any).RUNTIME_CONFIG
        ?.AI_DEFAULT_MESSAGE_NO_VIDEO;
      if (defaultMsg) {
        setAiDefaultMessageNoVideo(defaultMsg);
      }
    }
  }, []);

  // 检查音乐功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = !!(window as any).RUNTIME_CONFIG?.MUSIC_ENABLED;
      setMusicEnabled(enabled);
    }
  }, []);

  // 检查漫画功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = !!(window as any).RUNTIME_CONFIG?.SUWAYOMI_ENABLED;
      setMangaEnabled(enabled);
    }
  }, []);

  // 检查电子书功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = !!(window as any).RUNTIME_CONFIG?.BOOKS_ENABLED;
      setBooksEnabled(enabled);
    }
  }, []);

  // 检查网盘临时播放权限，仅有权限时在直链播放弹窗展示网盘在线播放提示
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = !!(window as any).RUNTIME_CONFIG
        ?.NETDISK_TEMP_PLAY_ENABLED;
      setNetdiskTempPlayEnabled(enabled);
    }
  }, []);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      // 会话级标记：只在首次访问站点时弹出，导航切回首页不重复弹
      if (sessionStorage.getItem('announcementShown')) {
        return;
      }
      // 每次显示模式：每次新会话首次访问弹出一次
      if (announcementDisplayMode === 'every') {
        setShowAnnouncement(true);
        sessionStorage.setItem('announcementShown', '1');
        return;
      }
      // 单次显示模式：localStorage 记住已看过的公告文本，换公告则重新弹出
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement, announcementDisplayMode]);

  useEffect(() => {
    const CACHE_DURATION = 60 * 60 * 1000; // 1小时

    const getCache = (key: string) => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        return { data, expired: Date.now() - timestamp > CACHE_DURATION };
      } catch {
        return null;
      }
    };

    const setCache = (key: string, data: any) => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        // Ignore localStorage errors
      }
    };

    const moviesCache = getCache('homepage_movies');
    const tvShowsCache = getCache('homepage_tvshows');
    const varietyCache = getCache('homepage_variety');
    const bangumiCache = getCache('homepage_bangumi');
    const duanjuCache = getCache('homepage_duanju');
    const upcomingCache = getCache('homepage_upcoming');

    if (moviesCache?.data) setHotMovies(moviesCache.data);
    if (tvShowsCache?.data) setHotTvShows(tvShowsCache.data);
    if (varietyCache?.data) setHotVarietyShows(varietyCache.data);
    if (bangumiCache?.data) setBangumiCalendarData(bangumiCache.data);
    if (duanjuCache?.data) setHotDuanju(duanjuCache.data);
    if (upcomingCache?.data) setUpcomingContent(upcomingCache.data);

    const hasCache =
      moviesCache ||
      tvShowsCache ||
      varietyCache ||
      bangumiCache ||
      duanjuCache ||
      upcomingCache;
    if (hasCache) setLoading(false);

    const needsRefresh =
      !moviesCache ||
      moviesCache.expired ||
      !tvShowsCache ||
      tvShowsCache.expired ||
      !varietyCache ||
      varietyCache.expired ||
      !bangumiCache ||
      bangumiCache.expired ||
      !duanjuCache ||
      duanjuCache.expired ||
      !upcomingCache ||
      upcomingCache.expired;

    if (needsRefresh) {
      (async () => {
        try {
          const [
            moviesData,
            tvShowsData,
            varietyShowsData,
            bangumiCalendarData,
          ] = await Promise.all([
            getDoubanCategories({
              kind: 'movie',
              category: '热门',
              type: '全部',
            }).catch((error) => {
              console.error('获取热门电影数据失败:', error);
              return null;
            }),
            getDoubanCategories({
              kind: 'tv',
              category: 'tv',
              type: 'tv',
            }).catch((error) => {
              console.error('获取热门剧集数据失败:', error);
              return null;
            }),
            getDoubanCategories({
              kind: 'tv',
              category: 'show',
              type: 'show',
            }).catch((error) => {
              console.error('获取热门综艺数据失败:', error);
              return null;
            }),
            GetBangumiCalendarData().catch((error) => {
              console.error('获取新番放送数据失败:', error);
              return [];
            }),
          ]);

          if (moviesData?.code === 200) {
            setHotMovies(moviesData.list);
            if (moviesData.list && moviesData.list.length > 0) {
              setCache('homepage_movies', moviesData.list);
            }
          }
          if (tvShowsData?.code === 200) {
            setHotTvShows(tvShowsData.list);
            if (tvShowsData.list && tvShowsData.list.length > 0) {
              setCache('homepage_tvshows', tvShowsData.list);
            }
          }
          if (varietyShowsData?.code === 200) {
            setHotVarietyShows(varietyShowsData.list);
            if (varietyShowsData.list && varietyShowsData.list.length > 0) {
              setCache('homepage_variety', varietyShowsData.list);
            }
          }
          setBangumiCalendarData(bangumiCalendarData);
          if (bangumiCalendarData && bangumiCalendarData.length > 0) {
            setCache('homepage_bangumi', bangumiCalendarData);
          }

          try {
            const duanjuResponse = await fetch('/api/duanju/recommends');
            if (duanjuResponse.ok) {
              const duanjuResult = await duanjuResponse.json();
              if (
                duanjuResult.code === 200 &&
                duanjuResult.data &&
                duanjuResult.data.length > 0
              ) {
                setHotDuanju(duanjuResult.data);
                setCache('homepage_duanju', duanjuResult.data);
              }
            }
          } catch (error) {
            console.error('获取热播短剧数据失败:', error);
          }

          try {
            const response = await fetch('/api/tmdb/upcoming');
            if (response.ok) {
              const result = await response.json();
              if (
                result.code === 200 &&
                result.data &&
                result.data.length > 0
              ) {
                const sorted = [...result.data].sort((a, b) => {
                  const dateA = new Date(
                    a.release_date || '9999-12-31'
                  ).getTime();
                  const dateB = new Date(
                    b.release_date || '9999-12-31'
                  ).getTime();
                  return dateA - dateB;
                });
                setUpcomingContent(sorted);
                setCache('homepage_upcoming', sorted);
              }
            }
          } catch (error) {
            console.error('获取TMDB即将上映数据失败:', error);
          }

          setLoading(false);
        } catch (error) {
          console.error('获取推荐数据失败:', error);
          setLoading(false);
        }
      })();
    }
  }, []);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  // 渲染模块的函数
  const renderModule = (moduleId: string) => {
    switch (moduleId) {
      case 'hotMovies':
        return (
          <section
            key='hotMovies'
            className='tm-film-section'
            data-module='hotMovies'
          >
            <SectionHeader title='热门电影' href='/douban?type=movie' />
            <PosterGrid className='tm-home-poster-grid'>
              {loading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <PosterMotion key={index}>
                      <div className='tm-home-skeleton tm-skeleton' />
                    </PosterMotion>
                  ))
                : hotMovies.slice(0, 12).map((movie) => (
                    <PosterMotion key={movie.id}>
                      <VideoCard
                        detailOnTouch
                        id={movie.id}
                        poster={movie.poster}
                        title={movie.title}
                        year={movie.year}
                        rate={movie.rate}
                        type='movie'
                        from='douban'
                        douban_id={movie.id ? parseInt(movie.id) : undefined}
                      />
                    </PosterMotion>
                  ))}
            </PosterGrid>
          </section>
        );

      case 'hotDuanju':
        if (hotDuanju.length === 0) return null;
        return (
          <section key='hotDuanju' className='tm-film-section'>
            <SectionHeader title='热播短剧' href='/duanju' />
            <PosterGrid className='tm-home-poster-grid'>
              {loading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <PosterMotion key={index}>
                      <div className='tm-home-skeleton tm-skeleton' />
                    </PosterMotion>
                  ))
                : hotDuanju.slice(0, 12).map((duanju) => (
                    <PosterMotion key={duanju.id + duanju.source}>
                      <VideoCard
                        detailOnTouch
                        id={duanju.id}
                        source={duanju.source}
                        poster={duanju.poster}
                        title={duanju.title}
                        year={duanju.year}
                        type='tv'
                        from='search'
                        source_name={duanju.source_name}
                        episodes={duanju.episodes?.length}
                        douban_id={duanju.douban_id}
                        cmsData={{
                          desc: duanju.desc,
                          episodes: duanju.episodes,
                          episodes_titles: duanju.episodes_titles,
                        }}
                      />
                    </PosterMotion>
                  ))}
            </PosterGrid>
          </section>
        );

      case 'bangumiCalendar':
        return (
          <section key='bangumiCalendar' className='tm-film-section'>
            <SectionHeader title='新番放送' href='/douban?type=anime' />
            <PosterGrid className='tm-home-poster-grid'>
              {loading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <PosterMotion key={index}>
                      <div className='tm-home-skeleton tm-skeleton' />
                    </PosterMotion>
                  ))
                : (() => {
                    const today = new Date();
                    const weekdays = [
                      'Sun',
                      'Mon',
                      'Tue',
                      'Wed',
                      'Thu',
                      'Fri',
                      'Sat',
                    ];
                    const currentWeekday = weekdays[today.getDay()];
                    const todayAnimes =
                      bangumiCalendarData
                        .find((item) => item.weekday.en === currentWeekday)
                        ?.items.filter((anime) => anime.images) || [];

                    return todayAnimes.slice(0, 12).map((anime, index) => (
                      <PosterMotion key={`${anime.id}-${index}`}>
                        <VideoCard
                          detailOnTouch
                          from='douban'
                          title={anime.name_cn || anime.name}
                          poster={
                            anime.images?.large ||
                            anime.images?.common ||
                            anime.images?.medium ||
                            anime.images?.small ||
                            anime.images?.grid ||
                            ''
                          }
                          douban_id={anime.id}
                          rate={anime.rating?.score?.toFixed(1) || ''}
                          year={anime.air_date?.split('-')?.[0] || ''}
                          isBangumi={true}
                        />
                      </PosterMotion>
                    ));
                  })()}
            </PosterGrid>
          </section>
        );

      case 'hotTvShows':
        return (
          <section key='hotTvShows' className='tm-film-section'>
            <SectionHeader title='热门剧集' href='/douban?type=tv' />
            <PosterGrid className='tm-home-poster-grid'>
              {loading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <PosterMotion key={index}>
                      <div className='tm-home-skeleton tm-skeleton' />
                    </PosterMotion>
                  ))
                : hotTvShows.slice(0, 12).map((tvShow) => (
                    <PosterMotion key={tvShow.id}>
                      <VideoCard
                        detailOnTouch
                        id={tvShow.id}
                        poster={tvShow.poster}
                        title={tvShow.title}
                        year={tvShow.year}
                        rate={tvShow.rate}
                        type='tv'
                        from='douban'
                        douban_id={tvShow.id ? parseInt(tvShow.id) : undefined}
                      />
                    </PosterMotion>
                  ))}
            </PosterGrid>
          </section>
        );

      case 'hotVarietyShows':
        return (
          <section key='hotVarietyShows' className='tm-film-section'>
            <SectionHeader title='热门综艺' href='/douban?type=show' />
            <PosterGrid className='tm-home-poster-grid'>
              {loading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <PosterMotion key={index}>
                      <div className='tm-home-skeleton tm-skeleton' />
                    </PosterMotion>
                  ))
                : hotVarietyShows.slice(0, 12).map((varietyShow) => (
                    <PosterMotion key={varietyShow.id}>
                      <VideoCard
                        detailOnTouch
                        id={varietyShow.id}
                        poster={varietyShow.poster}
                        title={varietyShow.title}
                        year={varietyShow.year}
                        rate={varietyShow.rate}
                        type='tv'
                        from='douban'
                        douban_id={
                          varietyShow.id ? parseInt(varietyShow.id) : undefined
                        }
                      />
                    </PosterMotion>
                  ))}
            </PosterGrid>
          </section>
        );

      case 'upcomingContent':
        if (upcomingContent.length === 0) return null;
        return (
          <section key='upcomingContent' className='tm-film-section'>
            <SectionHeader title='即将上映' href='/douban?type=movie' />
            <PosterGrid className='tm-home-poster-grid'>
              {upcomingContent.slice(0, 12).map((item) => (
                <PosterMotion key={`${item.media_type}-${item.id}`}>
                  <VideoCard
                    detailOnTouch
                    title={item.title}
                    poster={processImageUrl(getTMDBImageUrl(item.poster_path))}
                    year={item.release_date?.split('-')?.[0] || ''}
                    rate={
                      item.vote_average && item.vote_average > 0
                        ? item.vote_average.toFixed(1)
                        : ''
                    }
                    type={item.media_type === 'tv' ? 'tv' : 'movie'}
                    from='douban'
                    tmdb_id={item.id}
                    releaseDate={item.release_date}
                    isUpcoming={true}
                  />
                </PosterMotion>
              ))}
            </PosterGrid>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <PageLayout>
      <div className='tm-home tm-home-v3'>
        {/* TMDB 热门轮播图 */}
        {homeBannerEnabled && (
          <PageContainer>
            <BannerCarousel delayLoad={true} />
          </PageContainer>
        )}

        <PageContainer className='tm-home-content-v3'>
          <div className='tm-home-resume-rooms'>
            {homeContinueWatchingEnabled && (
              <ContinueWatching className='tm-home-resume' homeLayout />
            )}
            <HomeRooms />
          </div>
          <div className='tm-home-utilities'>
            {aiEnabled && (
              <button
                onClick={() => setShowAIChat(true)}
                className='tm-tool-link tm-press min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              >
                <Bot size={16} />
                AI 问片
              </button>
            )}
          </div>
          <nav className='tm-category-row' aria-label='影视分类'>
            <Link href='/douban?type=movie' aria-current='page'>
              电影
            </Link>
            <Link href='/douban?type=tv'>剧集</Link>
            <Link href='/douban?type=anime'>动漫</Link>
            <Link href='/douban?type=show'>综艺</Link>
            {homeModules.some(
              (module) => module.id === 'hotDuanju' && module.enabled
            ) && <Link href='/duanju'>短剧</Link>}
          </nav>

          {homeModules
            .filter((module) => module.enabled)
            .sort((a, b) => a.order - b.order)
            .map((module) => renderModule(module.id))}
        </PageContainer>
      </div>

      {/* HTTP 环境警告弹窗 */}
      {showHttpWarning && (
        <HttpWarningDialog onClose={() => setShowHttpWarning(false)} />
      )}

      {/* AI问片面板 */}
      {aiEnabled && (
        <AIChatPanel
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
          welcomeMessage={aiDefaultMessageNoVideo}
        />
      )}

      {/* 公告弹窗 */}
      {showAnnouncement && (
        <div className='fixed inset-0 bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_70%,transparent)] z-[1000] flex items-center justify-center p-4'>
          <motion.div
            className='bg-[var(--tm-surface)] rounded-lg shadow-xl max-w-md w-full p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto'
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.12 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <h3 className='text-lg font-medium text-[color:var(--tm-text)] mb-3'>
              公告
            </h3>
            <div className='text-[color:var(--tm-muted)] mb-4 whitespace-pre-wrap'>
              {announcement}
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement || '')}
              className='w-full px-4 py-2 bg-[var(--tm-text)] text-[var(--tm-accent-contrast)] rounded-lg transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              知道了
            </button>
          </motion.div>
        </div>
      )}

      {showDirectPlayDialog && (
        <div
          className='fixed inset-0 bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)] z-[1000] flex items-center justify-center p-4'
          onClick={() => setShowDirectPlayDialog(false)}
        >
          <motion.div
            className='bg-[var(--tm-surface)] rounded-lg shadow-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto'
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.12 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='flex items-center justify-between p-4 border-b border-[var(--tm-line)]'>
              <h3 className='text-lg font-medium text-[color:var(--tm-text)]'>
                直链播放
              </h3>
              <button
                onClick={() => setShowDirectPlayDialog(false)}
                className='p-2 hover:bg-[var(--tm-line)] rounded-lg transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                aria-label='关闭'
              >
                <X size={20} className='text-[color:var(--tm-muted)]' />
              </button>
            </div>
            <div className='p-4 space-y-4'>
              <div className='text-sm text-[color:var(--tm-muted)]'>
                请输入可直接播放的视频链接。
              </div>
              {netdiskTempPlayEnabled && (
                <div className='text-[13px] text-[color:var(--tm-muted)]'>
                  支持夸克、UC、百度、天翼、移动、123、115 网盘在线播放。
                </div>
              )}
              <input
                value={directPlayUrl}
                onChange={(event) => setDirectPlayUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitDirectPlay();
                  }
                }}
                placeholder='https://example.com/video.m3u8'
                className='w-full px-3 py-2 rounded-lg border border-[var(--tm-line)] bg-[var(--tm-surface)] text-[color:var(--tm-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              />
              <div className='flex justify-end gap-2'>
                <button
                  onClick={() => setShowDirectPlayDialog(false)}
                  className='px-4 py-2 rounded-lg border border-[var(--tm-line)] text-[color:var(--tm-muted)] text-[color:var(--tm-text)] hover:bg-[var(--tm-line)] transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                >
                  取消
                </button>
                <button
                  onClick={submitDirectPlay}
                  disabled={!directPlayUrl.trim() || directPlaySubmitting}
                  className='px-4 py-2 rounded-lg bg-[var(--tm-text)] text-[var(--tm-accent-contrast)] transition-[opacity,transform] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                >
                  {directPlaySubmitting ? '处理中...' : '播放'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </PageLayout>
  );
}

function HomeEntry() {
  const { ready, isGuest } = useViewerIdentity();
  if (!ready)
    return (
      <PageLayout activePath='/'>
        <div className='tm-public-feedback' role='status'>
          正在打开首页…
        </div>
      </PageLayout>
    );
  return isGuest ? <PublicCatalogPage mode='home' /> : <HomeClient />;
}

export default function Home() {
  return (
    <Suspense>
      <HomeEntry />
    </Suspense>
  );
}
