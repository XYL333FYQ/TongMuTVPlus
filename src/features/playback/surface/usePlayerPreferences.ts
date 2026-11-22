/*
 * 自己看：播放器设置菜单里的几个偏好（跳过片头片尾、快捷快进、方向键步长、去广告、弹幕热力图）。
 * 每个都有一份 ref 同步最新值：播放器的回调在创建时就绑好了，要读最新的设置。
 * 记在本机的键名不变：enable_blockad、external_player_adblock、danmaku_heatmap_*、player-seek-settings 里的两个。
 */

import { useEffect, useRef, useState } from 'react';

import {
  DEFAULT_QUICK_FORWARD_SECONDS,
  DEFAULT_SEEK_STEP_SECONDS,
  loadStoredSeconds,
  QUICK_FORWARD_STORAGE_KEY,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';

function readStoredFlag(key: string, fallback: boolean) {
  if (typeof window !== 'undefined') {
    const v = localStorage.getItem(key);
    if (v !== null) return v === 'true';
  }
  return fallback;
}

export function usePlayerPreferences() {
  // 跳过片头片尾配置
  const [skipConfig, setSkipConfig] = useState<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [
    skipConfig,
    skipConfig.enable,
    skipConfig.intro_time,
    skipConfig.outro_time,
  ]);

  // 快捷快进（P 键和控制栏按钮，默认 90 秒）
  const [quickForwardSeconds, setQuickForwardSeconds] = useState(() =>
    loadStoredSeconds(QUICK_FORWARD_STORAGE_KEY, DEFAULT_QUICK_FORWARD_SECONDS)
  );
  const quickForwardSecondsRef = useRef(quickForwardSeconds);
  useEffect(() => {
    quickForwardSecondsRef.current = quickForwardSeconds;
  }, [quickForwardSeconds]);

  // 左右方向键快进/倒退（默认 10 秒）
  const [seekStepSeconds, setSeekStepSeconds] = useState(() =>
    loadStoredSeconds(SEEK_STEP_STORAGE_KEY, DEFAULT_SEEK_STEP_SECONDS)
  );
  const seekStepSecondsRef = useRef(seekStepSeconds);
  useEffect(() => {
    seekStepSecondsRef.current = seekStepSeconds;
  }, [seekStepSeconds]);

  // 去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() =>
    readStoredFlag('enable_blockad', true)
  );
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 工具栏去广告开关：用于外部播放器及鸿蒙原生 HLS，默认 false
  const [externalPlayerAdBlock, setExternalPlayerAdBlock] = useState<boolean>(
    () => readStoredFlag('external_player_adblock', false)
  );
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'external_player_adblock',
        String(externalPlayerAdBlock)
      );
    }
  }, [externalPlayerAdBlock]);

  // 弹幕热力图完全禁用开关（默认不禁用，即启用热力图功能）
  const [danmakuHeatmapDisabled, setDanmakuHeatmapDisabled] = useState<boolean>(
    () => readStoredFlag('danmaku_heatmap_disabled', false)
  );
  const danmakuHeatmapDisabledRef = useRef(danmakuHeatmapDisabled);
  useEffect(() => {
    danmakuHeatmapDisabledRef.current = danmakuHeatmapDisabled;
  }, [danmakuHeatmapDisabled]);

  // 弹幕热力图开关（默认开启）
  const [danmakuHeatmapEnabled, setDanmakuHeatmapEnabled] = useState<boolean>(
    () => readStoredFlag('danmaku_heatmap_enabled', true)
  );
  const danmakuHeatmapEnabledRef = useRef(danmakuHeatmapEnabled);
  useEffect(() => {
    danmakuHeatmapEnabledRef.current = danmakuHeatmapEnabled;
  }, [danmakuHeatmapEnabled]);

  return {
    skipConfig,
    setSkipConfig,
    skipConfigRef,
    quickForwardSeconds,
    setQuickForwardSeconds,
    quickForwardSecondsRef,
    seekStepSeconds,
    setSeekStepSeconds,
    seekStepSecondsRef,
    blockAdEnabled,
    setBlockAdEnabled,
    blockAdEnabledRef,
    externalPlayerAdBlock,
    setExternalPlayerAdBlock,
    danmakuHeatmapDisabled,
    setDanmakuHeatmapDisabled,
    danmakuHeatmapDisabledRef,
    danmakuHeatmapEnabled,
    setDanmakuHeatmapEnabled,
    danmakuHeatmapEnabledRef,
  };
}
