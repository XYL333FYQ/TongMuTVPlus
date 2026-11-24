/*
 * 自己看：保存 / 删除跳过片头片尾配置。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { deleteSkipConfig, saveSkipConfig } from '@/lib/db.client';
import { logger } from '@/lib/logger';
import { formatPaddedClock } from '@/lib/time';

import type { Art, ArtSettingOption } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface SkipConfigContext {
  artPlayerRef: MutableRefObject<Art | null>;
  currentIdRef: MutableRefObject<string>;
  currentSourceRef: MutableRefObject<string>;
  handleSkipConfigChange: (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => Promise<void>;
  setSkipConfig: Dispatch<
    SetStateAction<{ enable: boolean; intro_time: number; outro_time: number }>
  >;
  skipConfigRef: MutableRefObject<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>;
}

export function makeHandleSkipConfigChange(ctx: SkipConfigContext) {
  const {
    artPlayerRef,
    currentIdRef,
    currentSourceRef,
    setSkipConfig,
    skipConfigRef,
  } = ctx;
  return async (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => {
    if (!currentSourceRef.current || !currentIdRef.current) return;

    try {
      setSkipConfig(newConfig);
      if (!newConfig.enable && !newConfig.intro_time && !newConfig.outro_time) {
        await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);

        // 安全地更新播放器设置，仅在播放器存在时执行
        if (artPlayerRef.current && artPlayerRef.current.setting) {
          try {
            artPlayerRef.current.setting.update({
              name: '跳过片头片尾',
              html: '跳过片头片尾',
              switch: skipConfigRef.current.enable,
              onSwitch: function (item: ArtSettingOption) {
                const newConfig = {
                  ...skipConfigRef.current,
                  enable: !item.switch,
                };
                ctx.handleSkipConfigChange(newConfig);
                return !item.switch;
              },
            });
            artPlayerRef.current.setting.update({
              name: '跳过配置',
              html: '跳过配置',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="currentColor"/><path d="M9 12L15 12" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
              tooltip:
                skipConfigRef.current.intro_time === 0 &&
                skipConfigRef.current.outro_time === 0
                  ? '设置跳过配置'
                  : `片头: ${formatPaddedClock(
                      skipConfigRef.current.intro_time
                    )} | 片尾: ${formatPaddedClock(
                      Math.abs(skipConfigRef.current.outro_time)
                    )}`,
            });
          } catch (settingErr) {
            logger.warn('更新播放器设置失败:', settingErr);
          }
        }
      } else {
        await saveSkipConfig(
          currentSourceRef.current,
          currentIdRef.current,
          newConfig
        );
      }
      logger.info('跳过片头片尾配置已保存:', newConfig);
    } catch (err) {
      logger.error('保存跳过片头片尾配置失败:', err);
    }
  };
}
