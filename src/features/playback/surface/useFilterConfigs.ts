/*
 * 自己看：进页时读一次弹幕过滤规则（交给弹幕控制器）和集数过滤规则（选集面板用）。
 */

import { useEffect, useRef, useState } from 'react';

import { initDanmakuModule } from '@/lib/danmaku/api';
import {
  getDanmakuFilterConfig,
  getEpisodeFilterConfig,
} from '@/lib/db.client';
import { normalizeEpisodeFilterConfig } from '@/lib/episode-filter';
import { logger } from '@/lib/logger';
import type { EpisodeFilterConfig } from '@/lib/types';
import { useLatest } from '@/hooks/useLatest';

import type { DanmakuController } from '@/features/player';

export function useFilterConfigs(danmaku: DanmakuController) {
  const [episodeFilterConfig, setEpisodeFilterConfig] =
    useState<EpisodeFilterConfig | null>(null);
  const episodeFilterConfigRef = useRef<EpisodeFilterConfig | null>(null);

  // 初始化弹幕模块（清理过期缓存）
  useEffect(() => {
    initDanmakuModule();
  }, []);

  // 加载弹幕过滤配置
  const danmakuLatest = useLatest(danmaku);
  useEffect(() => {
    const loadFilterConfig = async () => {
      try {
        const config = await getDanmakuFilterConfig();
        danmakuLatest.current.setFilter(config || { rules: [] });

        // 加载集数过滤配置
        const episodeConfig = await getEpisodeFilterConfig();
        if (episodeConfig) {
          const normalizedEpisodeConfig =
            normalizeEpisodeFilterConfig(episodeConfig);
          setEpisodeFilterConfig(normalizedEpisodeConfig);
          episodeFilterConfigRef.current = normalizedEpisodeConfig;
        } else {
          const defaultEpisodeConfig: EpisodeFilterConfig =
            normalizeEpisodeFilterConfig();
          setEpisodeFilterConfig(defaultEpisodeConfig);
          episodeFilterConfigRef.current = defaultEpisodeConfig;
        }
      } catch (error) {
        logger.error('加载过滤配置失败:', error);
      }
    };
    loadFilterConfig();
    // 只在进页时读一次（danmakuLatest.current 控制器在页面里只建一次）
  }, [danmakuLatest]);

  // 同步集数过滤配置到ref
  useEffect(() => {
    episodeFilterConfigRef.current = episodeFilterConfig;
  }, [episodeFilterConfig]);

  return {
    episodeFilterConfig,
    setEpisodeFilterConfig,
    episodeFilterConfigRef,
  };
}
