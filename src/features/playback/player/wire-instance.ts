/*
 * 自己看：每个新的 Artplayer 实例上的事件（就绪后补的设置项、截图按钮显隐、网页全屏、热力图之外的进度条事件、恢复进度、续播提示、自动下一集、进度保存、预加载）。
 * 由内核 WatchPlayer 的 onInstance 在每个实例创建后调用一次。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { DEVICE_TIER_EVENT, getDeviceTier } from '@/lib/device-tier';
import { logger } from '@/lib/logger';
import { installTouchControls } from '@/lib/player-touch-controls';
import { formatPaddedClock } from '@/lib/time';
import type { SearchResult } from '@/lib/types';

import type { DanmakuController } from '@/features/player';
import type { Art } from '@/features/player';

import { watchProgressAndPrefetch } from './next-episode-prefetch';
import { watchPlayRecordJump } from './play-record-jump';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface WireInstanceContext {
  artPlayerRef: MutableRefObject<Art | null>;
  artRef: MutableRefObject<HTMLDivElement | null>;
  clearPlayerTimeouts: () => void;
  currentEpisodeIndexRef: MutableRefObject<number>;
  currentIdRef: MutableRefObject<string>;
  currentSourceRef: MutableRefObject<string>;
  danmaku: DanmakuController;
  detailRef: MutableRefObject<SearchResult | null>;
  handleNextEpisode: () => Promise<void>;
  isEpisodeFilteredByTitle: (title: string) => boolean;
  isIOS: boolean;
  lastSaveTimeRef: MutableRefObject<number>;
  lastSkipCheckRef: MutableRefObject<number>;
  lastVolumeRef: MutableRefObject<number>;
  nextEpisodeDanmakuPreloadTriggeredRef: MutableRefObject<boolean>;
  nextEpisodePreCacheTriggeredRef: MutableRefObject<boolean>;
  playRecordJumpDismissedRef: MutableRefObject<boolean>;
  playRecordJumpInitialCheckRef: MutableRefObject<boolean>;
  playRecordJumpLayerRef: MutableRefObject<HTMLElement | null>;
  restoreWebFullscreenOnReadyRef: MutableRefObject<boolean>;
  resumePlayingAfterHlsModeSwitchRef: MutableRefObject<boolean | null>;
  resumeTimeRef: MutableRefObject<number | null>;
  saveCurrentPlayProgress: () => Promise<void>;
  schedulePlayerTimeout: (callback: () => void, delay: number) => number;
  searchParams: URLSearchParams;
  seekStepSecondsRef: MutableRefObject<number>;
  setCorsFailedUrl: Dispatch<SetStateAction<string | null>>;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setIsWebFullscreen: Dispatch<SetStateAction<boolean>>;
  setPlayerReady: Dispatch<SetStateAction<boolean>>;
  setVideoError: Dispatch<SetStateAction<string | null>>;
  skipConfigRef: MutableRefObject<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>;
}

export function makeWireInstance(ctx: WireInstanceContext) {
  const {
    artPlayerRef,
    artRef,
    clearPlayerTimeouts,
    currentEpisodeIndexRef,
    detailRef,
    handleNextEpisode,
    isEpisodeFilteredByTitle,
    isIOS,
    lastSkipCheckRef,
    lastVolumeRef,
    restoreWebFullscreenOnReadyRef,
    resumePlayingAfterHlsModeSwitchRef,
    resumeTimeRef,
    saveCurrentPlayProgress,
    schedulePlayerTimeout,
    seekStepSecondsRef,
    setCorsFailedUrl,
    setCurrentEpisodeIndex,
    setError,
    setIsVideoLoading,
    setIsWebFullscreen,
    setPlayerReady,
    setVideoError,
    skipConfigRef,
  } = ctx;
  return (art: Art) => {
    artPlayerRef.current = art;
    art.on('destroy', clearPlayerTimeouts);

    // 监听播放器事件
    art.on('ready', async () => {
      setError(null);

      // 换集重建前处于网页全屏则恢复，避免用户换集时被踢出全屏
      if (restoreWebFullscreenOnReadyRef.current && art) {
        restoreWebFullscreenOnReadyRef.current = false;
        try {
          art.fullscreenWeb = true;
        } catch (err) {
          logger.warn('恢复网页全屏失败:', err);
        }
      }

      // 标记播放器已就绪，触发 usePlaySync 设置事件监听器
      setPlayerReady(true);
      logger.info('[PlayPage] Player ready, triggering sync setup');

      // 控制截图按钮在小屏幕竖屏时隐藏
      const updateScreenshotVisibility = () => {
        const screenshotBtn = document.querySelector(
          '.art-control-screenshot'
        ) as HTMLElement;
        if (screenshotBtn) {
          screenshotBtn.style.display =
            getDeviceTier() === 'phone' ? 'none' : '';
        }
      };
      updateScreenshotVisibility();
      window.addEventListener('resize', updateScreenshotVisibility);
      window.addEventListener(DEVICE_TIER_EVENT, updateScreenshotVisibility);
      art.on('fullscreen', updateScreenshotVisibility);
      art.on('fullscreenWeb', updateScreenshotVisibility);

      // iOS 设备：动态调整弹幕设置面板位置，避免被遮挡
      if (isIOS && art) {
        // 使用 MutationObserver 监听弹幕设置面板的显示
        let isAdjusting = false; // 防止重复调整的标记
        const observer = new MutationObserver(() => {
          if (isAdjusting) return; // 如果正在调整，跳过

          const panel = document.querySelector(
            '.apd-config-panel'
          ) as HTMLElement;
          if (panel && panel.style.display !== 'none') {
            // 获取当前的 left 值
            const currentLeft = parseInt(panel.style.left || '0', 10);

            // 如果 left 值异常小（iOS 上只有 -5px），调整为正常值（-246px，比标准位置再往左 100px）
            if (currentLeft > -50) {
              isAdjusting = true; // 设置标记，防止重复触发
              const adjustedLeft = -246;
              panel.style.left = `${adjustedLeft}px`;
              logger.info(
                '[iOS] 已调整弹幕设置面板位置: 从',
                currentLeft,
                '调整为',
                adjustedLeft
              );

              // 延迟重置标记
              setTimeout(() => {
                isAdjusting = false;
              }, 100);
            }
          }
        });

        // 监听整个播放器容器的 DOM 变化
        if (artRef.current) {
          observer.observe(artRef.current, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
        }

        // 清理函数
        art.on('destroy', () => {
          observer.disconnect();
        });
      }
    });

    art.on('pause', () => {
      saveCurrentPlayProgress();
    });

    art.on('video:volumechange', () => {
      lastVolumeRef.current = art.volume;
    });
    // 监听网页全屏事件，控制导航栏显示隐藏
    art.on('fullscreenWeb', (isFullscreen: boolean) => {
      logger.info('网页全屏状态变化:', isFullscreen);
      setIsWebFullscreen(isFullscreen);
    });

    // 触屏：画面正中快退 / 播放暂停 / 快进，手机全屏左上退出。和房间播放器共用一份
    // （src/lib/player-touch-controls.ts）；以前这里自己写了一套，位置、样子都和房间不一样
    {
      const disposeTouch = installTouchControls(art, {
        stepSeconds: () => seekStepSecondsRef.current,
        exitFullscreen: () => {
          if (document.fullscreenElement)
            void document.exitFullscreen().catch(() => undefined);
          if (art.fullscreenWeb) art.fullscreenWeb = false;
          if (art.fullscreen) art.fullscreen = false;
        },
      });
      art.on('destroy', disposeTouch);
    }

    // 监听视频可播放事件，这时恢复播放进度更可靠
    art.on('video:canplay', () => {
      // 若存在需要恢复的播放进度，则跳转
      if (resumeTimeRef.current && resumeTimeRef.current > 0) {
        try {
          const duration = art.duration || 0;
          let target = resumeTimeRef.current;
          if (duration && target >= duration - 2) {
            target = Math.max(0, duration - 5);
          }
          art.currentTime = target;
          logger.info('成功恢复播放进度到:', resumeTimeRef.current);
        } catch (err) {
          logger.warn('恢复播放进度失败:', err);
        }
      }
      resumeTimeRef.current = null;

      const shouldResumePlaying = resumePlayingAfterHlsModeSwitchRef.current;
      resumePlayingAfterHlsModeSwitchRef.current = null;
      if (shouldResumePlaying === false) {
        art.pause();
      } else if (shouldResumePlaying === true) {
        Promise.resolve(art.play()).catch((error) => {
          logger.warn('[Harmony HLS] 恢复播放失败:', error);
        });
      }

      schedulePlayerTimeout(() => {
        if (!art) {
          return;
        }

        if (Math.abs(art.volume - lastVolumeRef.current) > 0.01) {
          art.volume = lastVolumeRef.current;
        }
        art.notice.show = '';
      }, 0);

      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setVideoError(null);
      setCorsFailedUrl(null);
    });

    // 开始播放后检查要不要显示“上次播放到”
    watchPlayRecordJump(art, ctx);

    // 监听视频时间更新事件，实现跳过片头片尾
    art.on('video:timeupdate', () => {
      if (!skipConfigRef.current.enable) return;

      const currentTime = art.currentTime || 0;
      const duration = art.duration || 0;
      const now = Date.now();

      // 限制跳过检查频率为1.5秒一次
      if (now - lastSkipCheckRef.current < 1500) return;
      lastSkipCheckRef.current = now;

      // 跳过片头
      if (
        skipConfigRef.current.intro_time > 0 &&
        currentTime < skipConfigRef.current.intro_time
      ) {
        art.currentTime = skipConfigRef.current.intro_time;
        art.notice.show = `已跳过片头 (${formatPaddedClock(
          skipConfigRef.current.intro_time
        )})`;
      }

      // 跳过片尾
      if (
        skipConfigRef.current.outro_time < 0 &&
        duration > 0 &&
        currentTime > art.duration + skipConfigRef.current.outro_time
      ) {
        if (
          currentEpisodeIndexRef.current <
          (detailRef.current?.episodes?.length || 1) - 1
        ) {
          handleNextEpisode();
        } else {
          art.pause();
        }
        art.notice.show = `已跳过片尾 (${formatPaddedClock(
          skipConfigRef.current.outro_time
        )})`;
      }
    });

    // 监听视频播放结束事件，自动播放下一集
    art.on('video:ended', () => {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;

      if (!d || !d.episodes || idx >= d.episodes.length - 1) {
        return;
      }

      // 查找下一个未被过滤的集数
      let nextIdx = idx + 1;
      while (nextIdx < d.episodes.length) {
        const episodeTitle = d.episodes_titles?.[nextIdx];
        const isFiltered =
          episodeTitle && isEpisodeFilteredByTitle(episodeTitle);

        if (!isFiltered) {
          setTimeout(() => {
            setCurrentEpisodeIndex(nextIdx);
          }, 1000);
          return;
        }
        nextIdx++;
      }

      // 所有后续集数都被屏蔽
      if (art) {
        art.notice.show = '后续集数均已屏蔽，已自动停止';
      }
    });

    // 定时保存进度；快播完时预缓冲下一集、预加载下一集弹幕
    watchProgressAndPrefetch(art, ctx);
  };
}
