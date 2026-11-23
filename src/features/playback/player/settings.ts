/*
 * 自己看：播放器设置菜单（顺序和文字就是界面上的样子）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  normalizeStoredSeconds,
  QUICK_FORWARD_STORAGE_KEY,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';
import { formatDuration, formatPaddedClock } from '@/lib/time';

import type { Art, ArtSetting, ArtSettingOption } from '@/features/player';
import { type Anime4KController, setHeatmapEnabled } from '@/features/player';

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
    anime4k,
    artPlayerRef,
    blockAdEnabled,
    danmakuHeatmapDisabledRef,
    danmakuHeatmapEnabledRef,
    handleSkipConfigChange,
    quickForwardSecondsRef,
    resumeTimeRef,
    seekStepSecondsRef,
    setBlockAdEnabled,
    setDanmakuHeatmapEnabled,
    setQuickForwardSeconds,
    setSeekStepSeconds,
    setShowDanmakuFilterSettings,
    skipConfigRef,
    webGPUSupported,
  } = ctx;
  return [
    {
      html: '去广告',
      icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="currentColor">AD</text>',
      tooltip: blockAdEnabled ? '已开启' : '已关闭',
      onClick() {
        const newVal = !blockAdEnabled;
        try {
          localStorage.setItem('enable_blockad', String(newVal));
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
    ...(webGPUSupported
      ? [
          {
            name: 'Anime4K超分',
            html: 'Anime4K超分',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4 0-7-3-7-7V9l7-3.5L19 9v4c0 4-3 7-7 7z" fill="currentColor"/><path d="M10 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            switch: anime4k.state.enabled,
            onSwitch: async function (item: ArtSettingOption) {
              await anime4k.setEnabled(!item.switch);
              return anime4k.state.enabled;
            },
          },
          {
            name: '超分模式',
            html: '超分模式',
            selector: [
              {
                html: 'ModeA (快速)',
                value: 'ModeA',
                default: anime4k.state.mode === 'ModeA',
              },
              {
                html: 'ModeB (平衡)',
                value: 'ModeB',
                default: anime4k.state.mode === 'ModeB',
              },
              {
                html: 'ModeC (质量)',
                value: 'ModeC',
                default: anime4k.state.mode === 'ModeC',
              },
              {
                html: 'ModeAA (增强快速)',
                value: 'ModeAA',
                default: anime4k.state.mode === 'ModeAA',
              },
              {
                html: 'ModeBB (增强平衡)',
                value: 'ModeBB',
                default: anime4k.state.mode === 'ModeBB',
              },
              {
                html: 'ModeCA (最高质量)',
                value: 'ModeCA',
                default: anime4k.state.mode === 'ModeCA',
              },
            ],
            onSelect: async function (item: ArtSettingOption) {
              await anime4k.setMode(item.value);
              return item.html;
            },
          },
          {
            name: '超分倍数',
            html: '超分倍数',
            selector: [
              {
                html: '1.5x',
                value: '1.5',
                default: anime4k.state.scale === 1.5,
              },
              {
                html: '2.0x',
                value: '2.0',
                default: anime4k.state.scale === 2.0,
              },
              {
                html: '3.0x',
                value: '3.0',
                default: anime4k.state.scale === 3.0,
              },
              {
                html: '4.0x',
                value: '4.0',
                default: anime4k.state.scale === 4.0,
              },
            ],
            onSelect: async function (item: ArtSettingOption) {
              await anime4k.setScale(parseFloat(item.value));
              return item.html;
            },
          },
        ]
      : []),
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
    {
      name: '快捷快进配置',
      html: '快捷快进配置',
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m16 17 5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      tooltip: `${formatDuration(quickForwardSecondsRef.current)}`,
      onClick: async function () {
        const player = artPlayerRef.current;
        if (player?.fullscreen) {
          player.fullscreen = false;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const existingDialog = document.querySelector(
          '.quick-forward-settings-dialog'
        );
        existingDialog?.remove();

        const container = document.createElement('div');
        container.className = 'quick-forward-settings-dialog';
        container.style.cssText = `
                  position: fixed;
                  inset: 0;
                  z-index: 10000;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 16px;
                  background: rgba(0, 0, 0, 0.6);
                  backdrop-filter: blur(3px);
                `;
        container.innerHTML = `
                  <div role="dialog" aria-modal="true" style="width: min(360px, 100%); background: var(--tm-surface); color: var(--tm-text); border: 1px solid var(--tm-line); border-radius: var(--tm-radius-md); padding: 20px; box-shadow: 0 16px 48px var(--tm-room-cinema-bg);">
                    <div style="font-size: 17px; font-weight: 500; margin-bottom: 8px;">快捷快进设置</div>
                    <div style="color: var(--tm-text); font-size: 13px; line-height: 1.5; margin-bottom: 16px;">设置点击底部按钮或按 P 键时向前跳转的时间。</div>
                    <label for="quick-forward-input" style="display: block; color: var(--tm-text); font-size: 13px; margin-bottom: 6px;">快进时长（秒）</label>
                    <input id="quick-forward-input" type="number" min="1" step="1" value="${quickForwardSecondsRef.current}" style="box-sizing: border-box; width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); font-size: 14px; outline: none;" />
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
                      <button type="button" data-action="cancel" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); cursor: pointer;">取消</button>
                      <button type="button" data-action="confirm" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-text); color: var(--tm-accent-contrast); cursor: pointer;">保存</button>
                    </div>
                  </div>
                `;
        document.body.appendChild(container);

        const input = container.querySelector(
          '#quick-forward-input'
        ) as HTMLInputElement;
        const cancelButton = container.querySelector('[data-action="cancel"]');
        const confirmButton = container.querySelector(
          '[data-action="confirm"]'
        );
        const cleanup = () => container.remove();
        const save = () => {
          const normalizedSeconds = normalizeStoredSeconds(Number(input.value));
          if (normalizedSeconds === null) {
            input.focus();
            if (artPlayerRef.current) {
              artPlayerRef.current.notice.show = '请输入大于 0 的有效秒数';
            }
            return;
          }

          setQuickForwardSeconds(normalizedSeconds);
          quickForwardSecondsRef.current = normalizedSeconds;
          localStorage.setItem(
            QUICK_FORWARD_STORAGE_KEY,
            String(normalizedSeconds)
          );
          if (artPlayerRef.current) {
            artPlayerRef.current.notice.show = `快捷快进已设置为${formatDuration(
              normalizedSeconds
            )}`;
          }
          cleanup();
        };

        cancelButton?.addEventListener('click', cleanup);
        confirmButton?.addEventListener('click', save);
        container.addEventListener('click', (event) => {
          if (event.target === container) cleanup();
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') cleanup();
        });
        input.focus();
        input.select();
        return '打开设置';
      },
    },
    {
      name: '快进/倒退时间',
      html: '快进/倒退时间',
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m4 12 6-6v12l-6-6Z" fill="currentColor"/><path d="m20 12-6-6v12l6-6Z" fill="currentColor"/></svg>',
      tooltip: `${formatDuration(seekStepSecondsRef.current)}`,
      onClick: async function () {
        const player = artPlayerRef.current;
        if (player?.fullscreen) {
          player.fullscreen = false;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const existingDialog = document.querySelector(
          '.seek-step-settings-dialog'
        );
        existingDialog?.remove();

        const container = document.createElement('div');
        container.className = 'seek-step-settings-dialog';
        container.style.cssText = `
                  position: fixed;
                  inset: 0;
                  z-index: 10000;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 16px;
                  background: rgba(0, 0, 0, 0.6);
                  backdrop-filter: blur(3px);
                `;
        container.innerHTML = `
                  <div role="dialog" aria-modal="true" style="width: min(360px, 100%); background: var(--tm-surface); color: var(--tm-text); border: 1px solid var(--tm-line); border-radius: var(--tm-radius-md); padding: 20px; box-shadow: 0 16px 48px var(--tm-room-cinema-bg);">
                    <div style="font-size: 17px; font-weight: 500; margin-bottom: 8px;">快进/倒退时间</div>
                    <div style="color: var(--tm-text); font-size: 13px; line-height: 1.5; margin-bottom: 16px;">设置左右方向键快进 / 快退的时间。</div>
                    <label for="seek-step-input" style="display: block; color: var(--tm-text); font-size: 13px; margin-bottom: 6px;">时长（秒）</label>
                    <input id="seek-step-input" type="number" min="1" step="1" value="${seekStepSecondsRef.current}" style="box-sizing: border-box; width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); font-size: 14px; outline: none;" />
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
                      <button type="button" data-action="cancel" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); cursor: pointer;">取消</button>
                      <button type="button" data-action="confirm" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-text); color: var(--tm-accent-contrast); cursor: pointer;">保存</button>
                    </div>
                  </div>
                `;
        document.body.appendChild(container);

        const input = container.querySelector(
          '#seek-step-input'
        ) as HTMLInputElement;
        const cancelButton = container.querySelector('[data-action="cancel"]');
        const confirmButton = container.querySelector(
          '[data-action="confirm"]'
        );
        const cleanup = () => container.remove();
        const save = () => {
          const normalizedSeconds = normalizeStoredSeconds(Number(input.value));
          if (normalizedSeconds === null) {
            input.focus();
            if (artPlayerRef.current) {
              artPlayerRef.current.notice.show = '请输入大于 0 的有效秒数';
            }
            return;
          }

          setSeekStepSeconds(normalizedSeconds);
          seekStepSecondsRef.current = normalizedSeconds;
          localStorage.setItem(
            SEEK_STEP_STORAGE_KEY,
            String(normalizedSeconds)
          );
          if (artPlayerRef.current) {
            artPlayerRef.current.notice.show = `快进/倒退时间已设为${formatDuration(
              normalizedSeconds
            )}`;
          }
          cleanup();
        };

        cancelButton?.addEventListener('click', cleanup);
        confirmButton?.addEventListener('click', save);
        container.addEventListener('click', (event) => {
          if (event.target === container) cleanup();
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') cleanup();
        });
        input.focus();
        input.select();
        return '打开设置';
      },
    },
    {
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
      onClick: async function () {
        const player = artPlayerRef.current;
        if (player) {
          // 如果处于全屏状态，先退出全屏
          if (player.fullscreen) {
            player.fullscreen = false;
            // 等待全屏退出动画完成
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // 使用 ArtPlayer 的 prompt 功能创建输入弹窗
          const currentIntro = skipConfigRef.current.intro_time || 0;
          const currentOutro = Math.abs(skipConfigRef.current.outro_time) || 0;

          // 创建一个自定义的提示框
          const container = document.createElement('div');
          container.style.cssText = ` position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.9); padding: 20px; border-radius: var(--tm-radius-sm); z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); `;

          container.innerHTML = `
                  <div style="color: var(--tm-text); margin-bottom: 15px; font-size: 16px; font-weight: bold; border-bottom: 1px solid var(--tm-line); padding-bottom: 10px;">
                    跳过配置
                  </div>
                  <div style="color: var(--tm-text); font-size: 13px; margin-bottom: 15px; line-height: 1.5;">
                    设置片头片尾跳过时间，到达时间自动跳过
                  </div>
                  <div style="margin-bottom: 10px;">
                    <label style="color: var(--tm-text); display: block; margin-bottom: 5px; font-size: 14px; font-weight: 500;">
                      片头时间 (秒)
                      <span style="color: var(--tm-text); font-size: 13px; font-weight: normal; margin-left: 8px;">从视频开始跳过的时长</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                      <input id="intro-input" type="number" min="0" step="1" value="${currentIntro}" placeholder="如: 90"
                             style="flex: 1; padding: 8px; border-radius: var(--tm-radius-sm); border: 1px solid var(--tm-line); background: var(--tm-surface); color: var(--tm-text); font-size: 14px;" />
                      <button id="set-intro-btn" style="padding: 8px 12px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; white-space: nowrap;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                          <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
                          <path d="M12 6v6l4 4" stroke="white" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        当前时间
                      </button>
                    </div>
                  </div>
                  <div style="margin-bottom: 15px;">
                    <label style="color: var(--tm-text); display: block; margin-bottom: 5px; font-size: 14px; font-weight: 500;">
                      片尾时间 (秒)
                      <span style="color: var(--tm-text); font-size: 13px; font-weight: normal; margin-left: 8px;">从视频结尾向前跳过的时长</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                      <input id="outro-input" type="number" min="0" step="1" value="${currentOutro}" placeholder="如: 120"
                             style="flex: 1; padding: 8px; border-radius: var(--tm-radius-sm); border: 1px solid var(--tm-line); background: var(--tm-surface); color: var(--tm-text); font-size: 14px;" />
                      <button id="set-outro-btn" style="padding: 8px 12px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; white-space: nowrap;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                          <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
                          <path d="M12 6v6l4 4" stroke="white" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        当前时间
                      </button>
                    </div>
                  </div>
                  <div style="background: color-mix(in srgb, var(--tm-room-cinema-bg) 55%, transparent); border-left: 3px solid var(--tm-line); padding: 10px; margin-bottom: 15px; border-radius: var(--tm-radius-sm);">
                    <div style="color: var(--tm-text); font-size: 13px; line-height: 1.6;">
                      <div style="margin-bottom: 4px;"><strong>提示：</strong></div>
                      <div>• 点击"当前时间"可快速设置为播放位置</div>
                      <div>• 片头90秒表示跳过前1分30秒</div>
                      <div>• 片尾120秒表示跳过最后2分钟</div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--tm-line); padding-top: 15px;">
                    <button id="cancel-btn" style="padding: 8px 16px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='var(--tm-line)'" onmouseout="this.style.background='var(--tm-surface)'">取消</button>
                    <button id="clear-btn" style="padding: 8px 16px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='var(--tm-line)'" onmouseout="this.style.background='var(--tm-surface)'">清除</button>
                    <button id="confirm-btn" style="padding: 8px 16px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-text); color: var(--tm-accent-contrast); cursor: pointer; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='var(--tm-text)'" onmouseout="this.style.background='var(--tm-text)'">确定</button>
                  </div>
                `;

          document.body.appendChild(container);

          const introInput = container.querySelector(
            '#intro-input'
          ) as HTMLInputElement;
          const outroInput = container.querySelector(
            '#outro-input'
          ) as HTMLInputElement;
          const setIntroBtn = container.querySelector('#set-intro-btn');
          const setOutroBtn = container.querySelector('#set-outro-btn');
          const cancelBtn = container.querySelector('#cancel-btn');
          const clearBtn = container.querySelector('#clear-btn');
          const confirmBtn = container.querySelector('#confirm-btn');

          const cleanup = () => {
            document.body.removeChild(container);
          };

          // 设置片头为当前时间
          setIntroBtn?.addEventListener('click', () => {
            const currentTime = player.currentTime || 0;
            if (currentTime > 0) {
              introInput.value = Math.floor(currentTime).toString();
            }
          });

          // 设置片尾为当前时间到结束的时长
          setOutroBtn?.addEventListener('click', () => {
            if (player.duration && player.currentTime) {
              const outroTime = player.duration - player.currentTime;
              if (outroTime > 0) {
                outroInput.value = Math.floor(outroTime).toString();
              }
            }
          });

          cancelBtn?.addEventListener('click', cleanup);

          clearBtn?.addEventListener('click', () => {
            handleSkipConfigChange({
              enable: false,
              intro_time: 0,
              outro_time: 0,
            });
            cleanup();
          });

          confirmBtn?.addEventListener('click', () => {
            const introTime = parseFloat(introInput.value) || 0;
            const outroTime = parseFloat(outroInput.value) || 0;

            const newConfig = {
              ...skipConfigRef.current,
              intro_time: introTime,
              outro_time: outroTime > 0 ? -outroTime : 0,
            };

            handleSkipConfigChange(newConfig);
            cleanup();
          });

          // 支持 Enter 键确认
          const handleEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              confirmBtn?.dispatchEvent(new Event('click'));
            } else if (e.key === 'Escape') {
              cancelBtn?.dispatchEvent(new Event('click'));
            }
          };

          introInput.addEventListener('keydown', handleEnter);
          outroInput.addEventListener('keydown', handleEnter);
        }
        return '';
      },
    },
  ];
}
