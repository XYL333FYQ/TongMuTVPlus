'use client';

/*
 * 播放页状态（五）：换源和优选的状态、测速结果、面板开合、下载选集、换源加载、直链代理记忆。
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { pruneLocalEpisodeProgressStorage } from '@/lib/episode-progress';
import { logger } from '@/lib/logger';
import { readJson, readSetting, writeSetting } from '@/lib/settings';
import { SearchResult } from '@/lib/types';

import type { FallbackRecommendation, PlaybackPanel } from '../../page/types';

export function usePlaybackSourceState() {
  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null
  );
  const [fallbackRecommendations, setFallbackRecommendations] = useState<
    FallbackRecommendation[]
  >([]);
  const [hasCompletedSearchRequest, setHasCompletedSearchRequest] =
    useState(false);
  const [backgroundSourcesLoading, setBackgroundSourcesLoading] =
    useState(false);

  useEffect(() => {
    try {
      pruneLocalEpisodeProgressStorage();
    } catch (error) {
      logger.warn('[Play] Failed to prune local episode progress:', error);
    }
  }, []);

  // 优选和测速开关
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = readSetting('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  const [preferStrategy] = useState<'fast' | 'full'>(() => {
    if (typeof window !== 'undefined') {
      const saved = readSetting('preferStrategy');
      if (saved === 'fast' || saved === 'full') {
        return saved;
      }
    }
    return 'fast';
  });

  // 优选偏好：综合判定(balanced) / 分辨率优先(resolution) / 网速优先(speed)
  const [preferMode] = useState<'balanced' | 'resolution' | 'speed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = readSetting('preferMode');
      if (saved === 'balanced' || saved === 'resolution' || saved === 'speed') {
        return saved;
      }
    }
    return 'balanced';
  });

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<
      string,
      { quality: string; loadSpeed: string; pingTime: number; bitrate: string }
    >
  >(new Map());

  // 当前源的视频信息（用于标题旁边显示）
  const [currentSourceVideoInfo, setCurrentSourceVideoInfo] = useState<{
    quality: string;
    loadSpeed: string;
    pingTime: number;
    bitrate: string;
  } | null>(null);

  // 折叠状态（仅在 lg 及以上屏幕有效）
  // 电脑上一开始只露右侧图标栏，点“选集 / 换源 / 弹幕”再展开面板
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(true);

  // 手机 / 平板：底部操作坞打开的半屏面板；电脑：右侧图标栏选中的面板
  const [soloSheet, setSoloSheet] = useState<PlaybackPanel | 'tools' | null>(
    null
  );
  const [soloRail, setSoloRail] = useState<PlaybackPanel>('episodes');
  const [selectorRequest, setSelectorRequest] = useState<{
    tab: PlaybackPanel;
    nonce: number;
  } | null>(null);
  const openSoloSheet = (panel: PlaybackPanel | 'tools') => {
    if (panel !== 'tools')
      setSelectorRequest({ tab: panel, nonce: Date.now() });
    setSoloSheet(panel);
    // 面板盖住下半屏：把画面滚到最上面，面板正好接在画面下方
    const frame = document.querySelector<HTMLElement>(
      '.tm-playback-host[data-presentation="full"] .tm-playback-video-frame'
    );
    if (frame) {
      // 顶栏是固定的：画面停在顶栏下面
      const header = document.querySelector<HTMLElement>(
        '.tm-mobile-header-v2, .tm-top-header'
      );
      const headerHeight =
        header && getComputedStyle(header).display !== 'none'
          ? header.getBoundingClientRect().bottom
          : 0;
      const top =
        frame.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      // 页面短、滚不上去时，面板就从画面下沿开始
      const host = frame.closest<HTMLElement>('.tm-playback-host');
      host?.style.setProperty(
        '--tm-solo-sheet-top',
        `${Math.round(frame.getBoundingClientRect().bottom)}px`
      );
    }
  };
  const selectSoloRail = (panel: PlaybackPanel) => {
    if (!isEpisodeSelectorCollapsed && soloRail === panel) {
      setIsEpisodeSelectorCollapsed(true);
      return;
    }
    setIsEpisodeSelectorCollapsed(false);
    setSoloRail(panel);
    setSelectorRequest({ tab: panel, nonce: Date.now() });
  };
  useEffect(() => {
    if (!soloSheet) return;
    const close = (event: KeyboardEvent) =>
      event.key === 'Escape' && setSoloSheet(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [soloSheet]);

  // 下载选集面板显示状态
  const [showDownloadSelector, setShowDownloadSelector] = useState(false);

  const videoUrlRequestSeqRef = useRef(0);
  const lastVideoRequestKeyRef = useRef<string | null>(null);

  // 直链代理域名记忆：检查某个域名是否需要代理
  const isDirectplayDomainProxied = (url: string): boolean => {
    try {
      const domain = new URL(url).hostname;
      return readJson<string[]>('directplay_proxy_domains', []).includes(
        domain
      );
    } catch {
      return false;
    }
  };
  // 将域名记录到代理列表
  const addDirectplayProxyDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      const domains = readJson<string[]>('directplay_proxy_domains', []);
      if (!domains.includes(domain)) {
        domains.push(domain);
        writeSetting('directplay_proxy_domains', JSON.stringify(domains));
      }
    } catch {
      /* ignore */
    }
  };

  // 播放器就绪状态（用于触发 usePlaySync 的事件监听器设置）
  const [playerReady, setPlayerReady] = useState(false);

  return {
    availableSources,
    setAvailableSources,
    sourceSearchLoading,
    setSourceSearchLoading,
    sourceSearchError,
    setSourceSearchError,
    fallbackRecommendations,
    setFallbackRecommendations,
    hasCompletedSearchRequest,
    setHasCompletedSearchRequest,
    backgroundSourcesLoading,
    setBackgroundSourcesLoading,
    optimizationEnabled,
    preferStrategy,
    preferMode,
    precomputedVideoInfo,
    setPrecomputedVideoInfo,
    currentSourceVideoInfo,
    setCurrentSourceVideoInfo,
    isEpisodeSelectorCollapsed,
    setIsEpisodeSelectorCollapsed,
    soloSheet,
    setSoloSheet,
    soloRail,
    setSoloRail,
    selectorRequest,
    setSelectorRequest,
    openSoloSheet,
    selectSoloRail,
    showDownloadSelector,
    setShowDownloadSelector,
    videoUrlRequestSeqRef,
    lastVideoRequestKeyRef,
    isDirectplayDomainProxied,
    addDirectplayProxyDomain,
    playerReady,
    setPlayerReady,
  };
}

export type PlaybackSourceState = ReturnType<typeof usePlaybackSourceState>;
