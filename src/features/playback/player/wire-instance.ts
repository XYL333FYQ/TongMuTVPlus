/*
 * 自己看：每个新的 Artplayer 实例上的事件（就绪后补的设置项、截图按钮显隐、网页全屏、热力图之外的进度条事件、恢复进度、续播提示、自动下一集、进度保存、预加载）。
 * 由内核 WatchPlayer 的 onInstance 在每个实例创建后调用一次。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { generateStorageKey, getAllPlayRecords } from '@/lib/db.client';
import { DEVICE_TIER_EVENT, getDeviceTier } from '@/lib/device-tier';
import { installTouchControls } from '@/lib/player-touch-controls';
import type { SearchResult } from '@/lib/types';

import type { DanmakuController } from '@/features/player';
import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface WireInstanceContext {
  artPlayerRef: MutableRefObject<Art>;
  artRef: MutableRefObject<HTMLDivElement | null>;
  clearPlayerTimeouts: () => void;
  currentEpisodeIndexRef: MutableRefObject<number>;
  currentIdRef: MutableRefObject<string>;
  currentSourceRef: MutableRefObject<string>;
  danmaku: DanmakuController;
  detailRef: MutableRefObject<SearchResult | null>;
  formatTime: (seconds: number) => string;
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
  playRecordJumpLayerRef: MutableRefObject<Art>;
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
    currentIdRef,
    currentSourceRef,
    danmaku,
    detailRef,
    formatTime,
    handleNextEpisode,
    isEpisodeFilteredByTitle,
    isIOS,
    lastSaveTimeRef,
    lastSkipCheckRef,
    lastVolumeRef,
    nextEpisodeDanmakuPreloadTriggeredRef,
    nextEpisodePreCacheTriggeredRef,
    playRecordJumpDismissedRef,
    playRecordJumpInitialCheckRef,
    playRecordJumpLayerRef,
    restoreWebFullscreenOnReadyRef,
    resumePlayingAfterHlsModeSwitchRef,
    resumeTimeRef,
    saveCurrentPlayProgress,
    schedulePlayerTimeout,
    searchParams,
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
    artPlayerRef.current.on('ready', async () => {
      setError(null);

      // 换集重建前处于网页全屏则恢复，避免用户换集时被踢出全屏
      if (restoreWebFullscreenOnReadyRef.current && artPlayerRef.current) {
        restoreWebFullscreenOnReadyRef.current = false;
        try {
          artPlayerRef.current.fullscreenWeb = true;
        } catch (err) {
          console.warn('恢复网页全屏失败:', err);
        }
      }

      // 标记播放器已就绪，触发 usePlaySync 设置事件监听器
      setPlayerReady(true);
      console.log('[PlayPage] Player ready, triggering sync setup');

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
      artPlayerRef.current.on('fullscreen', updateScreenshotVisibility);
      artPlayerRef.current.on('fullscreenWeb', updateScreenshotVisibility);

      // iOS 设备：动态调整弹幕设置面板位置，避免被遮挡
      if (isIOS && artPlayerRef.current) {
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
              console.log(
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
        artPlayerRef.current.on('destroy', () => {
          observer.disconnect();
        });
      }
    });

    artPlayerRef.current.on('pause', () => {
      saveCurrentPlayProgress();
    });

    artPlayerRef.current.on('video:volumechange', () => {
      lastVolumeRef.current = artPlayerRef.current.volume;
    });
    // 监听网页全屏事件，控制导航栏显示隐藏
    artPlayerRef.current.on('fullscreenWeb', (isFullscreen: boolean) => {
      console.log('网页全屏状态变化:', isFullscreen);
      setIsWebFullscreen(isFullscreen);
    });

    // 触屏：画面正中快退 / 播放暂停 / 快进，手机全屏左上退出。和房间播放器共用一份
    // （src/lib/player-touch-controls.ts）；以前这里自己写了一套，位置、样子都和房间不一样
    {
      const art = artPlayerRef.current;
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
    artPlayerRef.current.on('video:canplay', () => {
      // 若存在需要恢复的播放进度，则跳转
      if (resumeTimeRef.current && resumeTimeRef.current > 0) {
        try {
          const duration = artPlayerRef.current.duration || 0;
          let target = resumeTimeRef.current;
          if (duration && target >= duration - 2) {
            target = Math.max(0, duration - 5);
          }
          artPlayerRef.current.currentTime = target;
          console.log('成功恢复播放进度到:', resumeTimeRef.current);
        } catch (err) {
          console.warn('恢复播放进度失败:', err);
        }
      }
      resumeTimeRef.current = null;

      const shouldResumePlaying = resumePlayingAfterHlsModeSwitchRef.current;
      resumePlayingAfterHlsModeSwitchRef.current = null;
      if (shouldResumePlaying === false) {
        artPlayerRef.current.pause();
      } else if (shouldResumePlaying === true) {
        Promise.resolve(artPlayerRef.current.play()).catch((error) => {
          console.warn('[Harmony HLS] 恢复播放失败:', error);
        });
      }

      schedulePlayerTimeout(() => {
        if (!artPlayerRef.current) {
          return;
        }

        if (
          Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) > 0.01
        ) {
          artPlayerRef.current.volume = lastVolumeRef.current;
        }
        artPlayerRef.current.notice.show = '';
      }, 0);

      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setVideoError(null);
      setCorsFailedUrl(null);
    });

    // 监听视频播放事件，检查是否需要显示播放记录跳转按钮
    artPlayerRef.current.on('video:playing', () => {
      // 检查是否需要显示播放记录跳转按钮
      // 条件：当前播放时间 < 10秒 且 播放记录时间 > 10秒
      const checkPlayRecordJump = async () => {
        try {
          // 短剧不显示"上次播放到"提示（短剧单集太短，提示意义不大）
          if (searchParams.get('duanju') === '1') {
            playRecordJumpInitialCheckRef.current = false;
            return;
          }

          // 仅在进入播放后的首次检查时处理，避免本次会话新生成的记录触发恢复按钮
          if (!playRecordJumpInitialCheckRef.current) {
            return;
          }

          // 如果用户已经关闭过跳转按钮，不再显示
          if (playRecordJumpDismissedRef.current) {
            return;
          }

          const currentTime = artPlayerRef.current?.currentTime || 0;

          // 如果当前播放时间已经大于等于10秒，不显示跳转按钮
          if (currentTime >= 10) {
            // 标记已经进行过首次检查，避免切集后再显示
            playRecordJumpInitialCheckRef.current = false;
            if (playRecordJumpLayerRef.current) {
              artPlayerRef.current.layers.remove('play-record-jump');
              playRecordJumpLayerRef.current = null;
            }
            return;
          }

          // 获取播放记录
          const allRecords = await getAllPlayRecords();
          const key = generateStorageKey(
            currentSourceRef.current,
            currentIdRef.current
          );
          const record = allRecords[key];

          if (record) {
            const recordIndex = record.index - 1;
            const recordTime = record.play_time;

            // 检查是否是当前集数且播放记录时间大于10秒且当前时间小于10秒
            if (
              recordIndex === currentEpisodeIndexRef.current &&
              recordTime > 10 &&
              currentTime < 10
            ) {
              // 如果已经添加过，不重复添加
              if (playRecordJumpLayerRef.current) {
                return;
              }

              // 标记已经进行过首次检查
              playRecordJumpInitialCheckRef.current = false;

              // 格式化时间显示
              const formatTime = (seconds: number): string => {
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = Math.floor(seconds % 60);
                if (h > 0) {
                  return `${h}:${m.toString().padStart(2, '0')}:${s
                    .toString()
                    .padStart(2, '0')}`;
                }
                return `${m}:${s.toString().padStart(2, '0')}`;
              };

              // 添加到播放器 layers
              playRecordJumpLayerRef.current = artPlayerRef.current.layers.add({
                name: 'play-record-jump',
                html: `
                      <div id="play-record-jump-container" style="
                        position: absolute;
                        left: 16px;
                        bottom: 60px;
                        z-index: 20;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 12px;
                        background-color: color-mix(in srgb, var(--tm-room-cinema-bg) 55%, transparent);
                        border-radius: var(--tm-radius-sm);
                        color: var(--tm-text);
                        font-size: 14px;
                        font-family: system-ui, -apple-system, sans-serif;
                        box-shadow: 0 2px 8px var(--tm-room-cinema-bg);
                        backdrop-filter: blur(4px);
                        pointer-events: auto;
                      ">
                        <span style="margin-right: 4px;">
                          上次播放到 ${formatTime(recordTime)}
                        </span>
                        <button id="play-record-jump-btn" style="
                          padding: 4px 12px;
                          background-color: color-mix(in srgb, var(--tm-room-cinema-bg) 55%, transparent);
                          border: 1px solid var(--tm-line);
                          border-radius: var(--tm-radius-sm);
                          color: var(--tm-text);
                          font-size: 13px;
                          cursor: pointer;
                          transition: all 0.2s;
                          font-weight: 500;
                        ">
                          跳转
                        </button>
                        <button id="play-record-dismiss-btn" style="
                          padding: 4px 8px;
                          background-color: transparent;
                          border: none;
                          color: var(--tm-text);
                          font-size: 18px;
                          cursor: pointer;
                          line-height: 1;
                          transition: color 0.2s;
                        " title="关闭">
                          ×
                        </button>
                      </div>
                    `,
                style: {
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                },
              });

              // 绑定事件
              const jumpBtn = document.getElementById('play-record-jump-btn');
              const dismissBtn = document.getElementById(
                'play-record-dismiss-btn'
              );

              if (jumpBtn) {
                jumpBtn.addEventListener('mouseenter', () => {
                  jumpBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                });
                jumpBtn.addEventListener('mouseleave', () => {
                  jumpBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                });
                jumpBtn.addEventListener('click', () => {
                  if (artPlayerRef.current) {
                    artPlayerRef.current.currentTime = recordTime;
                    artPlayerRef.current.notice.show = `已跳转到 ${formatTime(
                      recordTime
                    )}`;
                  }
                  playRecordJumpDismissedRef.current = true;
                  if (playRecordJumpLayerRef.current) {
                    artPlayerRef.current.layers.remove('play-record-jump');
                    playRecordJumpLayerRef.current = null;
                  }
                });
              }

              if (dismissBtn) {
                dismissBtn.addEventListener('mouseenter', () => {
                  dismissBtn.style.color = 'white';
                });
                dismissBtn.addEventListener('mouseleave', () => {
                  dismissBtn.style.color = 'rgba(255, 255, 255, 0.7)';
                });
                dismissBtn.addEventListener('click', () => {
                  playRecordJumpDismissedRef.current = true;
                  if (playRecordJumpLayerRef.current) {
                    artPlayerRef.current.layers.remove('play-record-jump');
                    playRecordJumpLayerRef.current = null;
                  }
                });
              }

              console.log(
                '[PlayRecordJump] 显示跳转按钮，当前时间:',
                currentTime,
                '记录时间:',
                recordTime
              );
            } else {
              // 不满足显示条件，也标记为已检查过
              playRecordJumpInitialCheckRef.current = false;
            }
          } else {
            // 没有播放记录，也标记为已检查过
            playRecordJumpInitialCheckRef.current = false;
          }
        } catch (err) {
          console.error('[PlayRecordJump] 检查播放记录失败:', err);
          // 即使出错也标记为已检查过
          playRecordJumpInitialCheckRef.current = false;
        }
      };

      // 延迟检查，确保播放器已经稳定
      setTimeout(checkPlayRecordJump, 500);
    });

    // 监听视频时间更新事件，实现跳过片头片尾
    artPlayerRef.current.on('video:timeupdate', () => {
      if (!skipConfigRef.current.enable) return;

      const currentTime = artPlayerRef.current.currentTime || 0;
      const duration = artPlayerRef.current.duration || 0;
      const now = Date.now();

      // 限制跳过检查频率为1.5秒一次
      if (now - lastSkipCheckRef.current < 1500) return;
      lastSkipCheckRef.current = now;

      // 跳过片头
      if (
        skipConfigRef.current.intro_time > 0 &&
        currentTime < skipConfigRef.current.intro_time
      ) {
        artPlayerRef.current.currentTime = skipConfigRef.current.intro_time;
        artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(
          skipConfigRef.current.intro_time
        )})`;
      }

      // 跳过片尾
      if (
        skipConfigRef.current.outro_time < 0 &&
        duration > 0 &&
        currentTime >
          artPlayerRef.current.duration + skipConfigRef.current.outro_time
      ) {
        if (
          currentEpisodeIndexRef.current <
          (detailRef.current?.episodes?.length || 1) - 1
        ) {
          handleNextEpisode();
        } else {
          artPlayerRef.current.pause();
        }
        artPlayerRef.current.notice.show = `已跳过片尾 (${formatTime(
          skipConfigRef.current.outro_time
        )})`;
      }
    });

    // 监听视频播放结束事件，自动播放下一集
    artPlayerRef.current.on('video:ended', () => {
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
      if (artPlayerRef.current) {
        artPlayerRef.current.notice.show = '后续集数均已屏蔽，已自动停止';
      }
    });

    artPlayerRef.current.on('video:timeupdate', () => {
      const now = Date.now();
      let interval = 5000;
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
        interval = 20000;
      }
      if (now - lastSaveTimeRef.current > interval) {
        saveCurrentPlayProgress();
        lastSaveTimeRef.current = now;
      }

      // 下集预缓冲逻辑
      const nextEpisodePreCacheEnabled =
        typeof window !== 'undefined'
          ? localStorage.getItem('nextEpisodePreCache') === 'true'
          : false;

      if (nextEpisodePreCacheEnabled) {
        const currentTime = artPlayerRef.current?.currentTime || 0;
        const duration = artPlayerRef.current?.duration || 0;
        const progress = duration > 0 ? currentTime / duration : 0;

        // 检查是否已经到达90%播放进度
        if (
          duration > 0 &&
          progress >= 0.9 &&
          !nextEpisodePreCacheTriggeredRef.current
        ) {
          // 标记已触发，防止重复执行
          nextEpisodePreCacheTriggeredRef.current = true;

          // 获取下一集信息
          const currentIdx = currentEpisodeIndexRef.current;
          const episodes = detailRef.current?.episodes;

          if (!episodes || currentIdx >= episodes.length - 1) {
            return;
          }

          const nextEpisodeIndex = currentIdx + 1;
          const nextEpisodeUrl = episodes[nextEpisodeIndex];

          if (!nextEpisodeUrl) {
            return;
          }

          // 使用 fetch 预加载资源，利用浏览器缓存
          const preloadNextEpisode = async () => {
            try {
              // 判断是否是m3u8流
              if (
                nextEpisodeUrl.includes('.m3u8') ||
                nextEpisodeUrl.includes('m3u8')
              ) {
                // 1. 先fetch m3u8文件
                const m3u8Response = await fetch(nextEpisodeUrl);
                const m3u8Text = await m3u8Response.text();

                // 2. 解析m3u8，提取ts分片URL
                const lines = m3u8Text.split('\n');
                const tsUrls: string[] = [];
                const baseUrl = nextEpisodeUrl.substring(
                  0,
                  nextEpisodeUrl.lastIndexOf('/') + 1
                );

                for (const line of lines) {
                  const trimmedLine = line.trim();
                  // 跳过注释和空行
                  if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue;
                  }
                  // 构建完整的ts URL
                  const tsUrl = trimmedLine.startsWith('http')
                    ? trimmedLine
                    : baseUrl + trimmedLine;
                  tsUrls.push(tsUrl);
                }

                // 3. 预加载前20个ts分片
                const maxFragmentsToPreload = Math.min(20, tsUrls.length);

                for (let i = 0; i < maxFragmentsToPreload; i++) {
                  try {
                    await fetch(tsUrls[i]);
                  } catch (err) {
                    // 静默处理分片加载失败
                  }
                }
              }
            } catch (error) {
              // 静默处理预缓冲失败
            }
          };

          // 异步执行预缓冲
          preloadNextEpisode();
        }
      }

      // 下集弹幕预加载逻辑
      const nextEpisodeDanmakuPreloadEnabled =
        typeof window !== 'undefined'
          ? localStorage.getItem('nextEpisodeDanmakuPreload') === 'true'
          : false;

      if (nextEpisodeDanmakuPreloadEnabled) {
        const currentTime = artPlayerRef.current?.currentTime || 0;
        const duration = artPlayerRef.current?.duration || 0;
        const progress = duration > 0 ? currentTime / duration : 0;

        // 检查是否已经到达90%播放进度
        if (
          duration > 0 &&
          progress >= 0.9 &&
          !nextEpisodeDanmakuPreloadTriggeredRef.current
        ) {
          // 标记已触发，防止重复执行
          nextEpisodeDanmakuPreloadTriggeredRef.current = true;

          // 异步执行弹幕预加载
          void danmaku.preloadNext();
        }
      }
    });
  };
}
