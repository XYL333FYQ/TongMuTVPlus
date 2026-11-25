/*
 * 自己看：播放器设置菜单（顺序和文字就是界面上的样子）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { writeSetting } from '@/lib/settings';

import type { Art, ArtSetting, ArtSettingOption } from '@/features/player';
import { type Anime4KController, setHeatmapEnabled } from '@/features/player';

import { anime4kSettings } from './settings-anime4k';
import { seekSettings } from './settings-seek';
import { skipConfigSetting } from './settings-skip';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface SettingsContext {
  anime4k: Anime4KController;
  artPlayerRef: MutableRefObject<Art | null>;
  blockAdEnabled: boolean;
  danmakuHeatmapDisabledRef: MutableRefObject<boolean>;
  danmakuHeatmapEnabledRef: MutableRefObject<boolean>;
  handleSkipConfigChange: (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => Promise<void>;
  quickForwardSecondsRef: MutableRefObject<number>;
  resumeTimeRef: MutableRefObject<number | null>;
  seekStepSecondsRef: MutableRefObject<number>;
  setBlockAdEnabled: Dispatch<SetStateAction<boolean>>;
  setDanmakuHeatmapEnabled: Dispatch<SetStateAction<boolean>>;
  setQuickForwardSeconds: Dispatch<SetStateAction<number>>;
  setSeekStepSeconds: Dispatch<SetStateAction<number>>;
  setShowDanmakuFilterSettings: Dispatch<SetStateAction<boolean>>;
  skipConfigRef: MutableRefObject<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>;
  webGPUSupported: boolean;
}

export function buildSettings(ctx: SettingsContext): ArtSetting[] {
  const {
    artPlayerRef,
    blockAdEnabled,
    danmakuHeatmapDisabledRef,
    danmakuHeatmapEnabledRef,
    handleSkipConfigChange,
    resumeTimeRef,
    setBlockAdEnabled,
    setDanmakuHeatmapEnabled,
    setShowDanmakuFilterSettings,
    skipConfigRef,
  } = ctx;
  return [
    {
      html: '去广告',
      icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="currentColor">AD</text>',
      tooltip: blockAdEnabled ? '已开启' : '已关闭',
      onClick() {
        const newVal = !blockAdEnabled;
        try {
          writeSetting('enable_blockad', String(newVal));
          if (artPlayerRef.current) {
            resumeTimeRef.current = artPlayerRef.current.currentTime;
          }
          setBlockAdEnabled(newVal);
        } catch (_) {
          // ignore
        }
        return newVal ? '当前开启' : '当前关闭';
      },
    },
    {
      html: '弹幕过滤',
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      tooltip: '配置弹幕过滤规则',
      onClick() {
        // 如果播放器处于全屏状态，先退出全屏
        if (artPlayerRef.current && artPlayerRef.current.fullscreen) {
          artPlayerRef.current.fullscreen = false;
          // 延迟一下再显示弹窗，确保全屏退出动画完成
          setTimeout(() => {
            setShowDanmakuFilterSettings(true);
          }, 300);
        } else {
          setShowDanmakuFilterSettings(true);
        }
        return '打开设置';
      },
    },
    // 热力图开关（仅在未禁用时显示）
    ...(!danmakuHeatmapDisabledRef.current
      ? [
          {
            name: '弹幕热力',
            html: '弹幕热力',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="currentColor"/></svg>',
            switch: danmakuHeatmapEnabledRef.current,
            onSwitch: function (item: ArtSettingOption) {
              const newVal = !item.switch;
              setHeatmapEnabled(artPlayerRef.current, newVal);
              setDanmakuHeatmapEnabled(newVal);
              return newVal;
            },
          },
        ]
      : []),
    ...anime4kSettings(ctx),
    {
      name: '跳过片头片尾',
      html: '跳过片头片尾',
      switch: skipConfigRef.current.enable,
      onSwitch: function (item: ArtSettingOption) {
        const newConfig = {
          ...skipConfigRef.current,
          enable: !item.switch,
        };
        handleSkipConfigChange(newConfig);
        return !item.switch;
      },
    },
    ...seekSettings(ctx),
    skipConfigSetting(ctx),
  ];
}
