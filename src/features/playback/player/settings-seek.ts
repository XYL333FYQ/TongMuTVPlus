/*
 * 自己看：播放器设置菜单里的快捷快进和快进 / 倒退步长（顺序和文字就是界面上的样子，整体顺序在 settings.ts）。
 */

import {
  normalizeStoredSeconds,
  QUICK_FORWARD_STORAGE_KEY,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';
import { writeSetting } from '@/lib/settings';
import { formatDuration } from '@/lib/time';

import type { ArtSetting } from '@/features/player';

import type { SettingsContext } from './settings';

export function seekSettings(ctx: SettingsContext): ArtSetting[] {
  const {
    artPlayerRef,
    quickForwardSecondsRef,
    seekStepSecondsRef,
    setQuickForwardSeconds,
    setSeekStepSeconds,
  } = ctx;
  return [
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
          writeSetting(QUICK_FORWARD_STORAGE_KEY, String(normalizedSeconds));
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
          writeSetting(SEEK_STEP_STORAGE_KEY, String(normalizedSeconds));
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
  ];
}
