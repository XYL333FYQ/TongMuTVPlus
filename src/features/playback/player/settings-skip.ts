/*
 * 自己看：播放器设置菜单里的片头片尾的跳过时间（顺序和文字就是界面上的样子，整体顺序在 settings.ts）。
 */

import { formatPaddedClock } from '@/lib/time';

import type { ArtSetting } from '@/features/player';

import type { SettingsContext } from './settings';

export function skipConfigSetting(ctx: SettingsContext): ArtSetting {
  const { artPlayerRef, handleSkipConfigChange, skipConfigRef } = ctx;
  return {
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
  };
}
