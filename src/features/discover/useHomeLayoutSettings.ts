'use client';

/*
 * 首页布局：显示哪些内容模块、什么顺序，大图和“继续观看”开不开。读本机设置，设置页改了（homeModulesUpdated）就重读。
 */

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { readSetting } from '@/lib/settings';

// 首页模块配置接口
export interface HomeModule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export function useHomeLayoutSettings() {
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

  const loadHomeLayoutSettings = () => {
    if (typeof window === 'undefined') return;

    const savedHomeModules = readSetting('homeModules');
    if (savedHomeModules) {
      try {
        setHomeModules(JSON.parse(savedHomeModules));
      } catch (error) {
        // 存的首页模块配置坏了就用默认的；原始错误留给排查
        logger.error('解析首页模块配置失败:', error);
      }
    }

    const savedHomeBannerEnabled = readSetting('homeBannerEnabled');
    if (savedHomeBannerEnabled !== null) {
      setHomeBannerEnabled(savedHomeBannerEnabled === 'true');
    }

    const savedHomeContinueWatchingEnabled = readSetting(
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

  return { homeModules, homeBannerEnabled, homeContinueWatchingEnabled };
}
