/*
 * 自己看：播放器控制条上加的按钮（截图、下一集、快捷快进、iOS 全屏等）。
 */

import type { MutableRefObject } from 'react';

import { isHandheld } from '@/lib/device-tier';

import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface ControlsContext {
  artPlayerRef: MutableRefObject<Art | null>;
  handleNextEpisode: () => Promise<void>;
  isIOS: boolean;
  seekQuickForward: () => boolean;
}

export function buildControls(ctx: ControlsContext) {
  const { artPlayerRef, handleNextEpisode, isIOS, seekQuickForward } = ctx;
  return [
    {
      // 与内置截图同名同位置，沿用 .art-control-screenshot 的显示规则
      name: 'screenshot',
      position: 'right',
      index: 20,
      html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="2"/></svg></i>',
      tooltip: '截图',
      click: function () {
        const art = artPlayerRef.current;
        if (!art) return;
        art.screenshot().catch(() => {
          // 片源站点没有开放跨域读取时浏览器禁止读帧，给出能看懂的原因
          if (artPlayerRef.current) {
            artPlayerRef.current.notice.show =
              '这个片源不允许截图，可以换个线路再试';
          }
        });
      },
    },
    {
      position: 'left',
      index: 40,
      html: `<i class="art-icon flex quick-forward-control"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m16 17 5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></i>`,
      tooltip: '快捷快进',
      mounted: ($el: HTMLElement) => {
        $el.classList.add('quick-forward-control-wrapper');
        if (!document.getElementById('quick-forward-control-style')) {
          const style = document.createElement('style');
          style.id = 'quick-forward-control-style';
          style.textContent = `
                    @media (max-width: 767px) and (orientation: portrait) {
                      .quick-forward-control-wrapper {
                        display: none !important;
                      }
                    }
                  `;
          document.head.appendChild(style);
        }
      },
      click: function () {
        seekQuickForward();
      },
    },
    {
      position: 'left',
      index: 13,
      html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
      tooltip: '播放下一集',
      click: function () {
        handleNextEpisode();
      },
    },
    // iOS 设备上添加自定义全屏按钮（横屏和竖屏都显示）
    ...(isIOS
      ? [
          {
            position: 'right',
            index: 100, // 大数字确保在设置按钮右边
            html: '<i class="art-icon ios-portrait-fullscreen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/></svg></i>',
            tooltip: '全屏',
            style: {
              color: 'var(--tm-room-player-text)',
            },
            mounted: function ($el: HTMLElement) {
              // 添加 CSS 样式：横屏和竖屏都显示
              const style = document.createElement('style');
              style.textContent = ` /* iOS 自定义全屏按钮在所有方向都显示 */ .ios-portrait-fullscreen { display: inline-flex !important; } /* iOS 全屏选择对话框样式（遵循项目统一风格） */ .ios-fullscreen-dialog { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--tm-surface); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; } .ios-fullscreen-dialog-content { background: var(--tm-surface); border-radius: var(--tm-radius-md); max-width: 480px; width: 100%; box-shadow: 0 20px 60px var(--tm-text); overflow: hidden; } .dark .ios-fullscreen-dialog-content { background: var(--tm-surface); } /* 标题栏 */ .ios-fullscreen-dialog-header { background: linear-gradient(135deg, var(--tm-surface) 0%, var(--tm-surface) 100%); padding: 20px 24px; } .ios-fullscreen-dialog-title { font-size: 20px; font-weight: 700; color: var(--tm-text); display: flex; align-items: center; gap: 10px; margin-bottom: 6px; } .ios-fullscreen-dialog-title svg { stroke: var(--tm-text); } .ios-fullscreen-dialog-subtitle { font-size: 14px; color: var(--tm-text); margin: 0; } /* 选项列表 */ .ios-fullscreen-dialog-options { padding: 16px; display: flex; flex-direction: column; gap: 12px; } .ios-fullscreen-option { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--tm-surface); border: 2px solid transparent; border-radius: var(--tm-radius-md); cursor: pointer; transition: all 0.2s; text-align: left; } .dark .ios-fullscreen-option { background: var(--tm-surface); } .ios-fullscreen-option:hover { background: var(--tm-surface); border-color: var(--tm-line); box-shadow: 0 4px 12px var(--tm-text); } .dark .ios-fullscreen-option:hover { background: var(--tm-surface); } .ios-fullscreen-option:active { transform: scale(0.98); } /* 推荐选项 */ .ios-fullscreen-option-recommended { border-color: var(--tm-line); } /* 选项图标 */ .ios-fullscreen-option-icon { flex-shrink: 0; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--tm-surface); border-radius: var(--tm-radius-sm); color: var(--tm-text); } .dark .ios-fullscreen-option-icon { background: var(--tm-surface); } .ios-fullscreen-option-recommended .ios-fullscreen-option-icon { background: var(--tm-text); color: var(--tm-accent-contrast); } /* 选项内容 */ .ios-fullscreen-option-content { flex: 1; } .ios-fullscreen-option-title { font-size: 16px; font-weight: 500; color: var(--tm-text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; } .dark .ios-fullscreen-option-title { color: var(--tm-text); } .ios-fullscreen-option-badge { display: inline-block; padding: 2px 8px; background: var(--tm-text); color: var(--tm-accent-contrast); font-size: 13px; font-weight: 500; border-radius: var(--tm-radius-sm); } .ios-fullscreen-option-desc { font-size: 13px; color: var(--tm-text); line-height: 1.4; } .dark .ios-fullscreen-option-desc { color: var(--tm-text); } /* 箭头图标 */ .ios-fullscreen-option-arrow { flex-shrink: 0; color: var(--tm-text); transition: transform 0.2s; } .dark .ios-fullscreen-option-arrow { color: var(--tm-text); } .ios-fullscreen-option:hover .ios-fullscreen-option-arrow { transform: translateX(4px); color: var(--tm-text); } /* 底部提示 */ .ios-fullscreen-dialog-footer { padding: 16px 24px; background: var(--tm-surface); border-top: 1px solid var(--tm-line); display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--tm-text); line-height: 1.5; } .dark .ios-fullscreen-dialog-footer { background: var(--tm-surface); border-top-color: var(--tm-line); color: var(--tm-text); } .ios-fullscreen-dialog-footer svg { flex-shrink: 0; margin-top: 2px; stroke: currentColor; } `;
              document.head.appendChild(style);
            },
            click: function () {
              if (!artPlayerRef.current) return;

              // 检测是否在 PWA 模式下
              const isPWA =
                window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.navigator.standalone === true;

              // 检查是否已经在原生全屏状态
              const isInNativeFullscreen = !!(
                document.fullscreenElement || document.webkitFullscreenElement
              );

              // 如果已经在原生全屏状态，退出原生全屏
              if (isInNativeFullscreen) {
                const exitFullscreen =
                  document.exitFullscreen ||
                  document.webkitExitFullscreen ||
                  document.mozCancelFullScreen ||
                  document.msExitFullscreen;
                if (exitFullscreen) {
                  try {
                    const result = exitFullscreen.call(document);
                    if (result && typeof result.catch === 'function') {
                      result.catch((err: Error) =>
                        console.error('退出全屏失败:', err)
                      );
                    }
                  } catch (err) {
                    console.error('退出全屏失败:', err);
                  }
                }
                return;
              }

              // 如果已经在网页全屏状态，退出网页全屏
              if (artPlayerRef.current.fullscreenWeb) {
                artPlayerRef.current.fullscreenWeb = false;
                return;
              }

              // 如果在 PWA 模式下，直接使用容器全屏（可以隐藏状态栏）
              if (isPWA) {
                const container = artPlayerRef.current.template.$container;
                if (container && container.webkitEnterFullscreen) {
                  Promise.resolve(container.webkitEnterFullscreen()).catch(
                    (err: Error) => {
                      console.error('PWA 全屏失败:', err);
                      // 如果失败，降级使用网页全屏
                      if (artPlayerRef.current)
                        artPlayerRef.current.fullscreenWeb = true;
                    }
                  );
                } else {
                  // 不支持原生全屏，使用网页全屏
                  artPlayerRef.current.fullscreenWeb = true;
                }
                return;
              }

              // iPhone：直接用系统全屏（会自己横过来）。网页全屏在竖着的手机上只是中间一小条画面，
              // 按钮还会被挤出屏幕（2026-11-18 问题文档第 6 条）。iPad 仍可以选
              if (isHandheld()) {
                const video = artPlayerRef.current.template?.$video;
                if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
                else if (video?.requestFullscreen)
                  void video.requestFullscreen();
                else artPlayerRef.current.fullscreenWeb = true;
                return;
              }

              // 非 PWA 模式：创建对话框（使用项目统一风格）
              const dialog = document.createElement('div');
              dialog.className = 'ios-fullscreen-dialog';
              dialog.innerHTML = `
                <div class="ios-fullscreen-dialog-content">
                  <!-- 标题栏 -->
                  <div class="ios-fullscreen-dialog-header">
                    <h3 class="ios-fullscreen-dialog-title">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" stroke="currentColor" stroke-width="2" fill="none"/>
                      </svg>
                      选择全屏模式
                    </h3>
                    <p class="ios-fullscreen-dialog-subtitle">
                      由于 iOS 系统限制，原生全屏会使用系统播放器，将无法显示弹幕及使用部分播放器功能。网页全屏可能无法完全占满屏幕，但可保留所有功能。
                    </p>
                  </div>

                  <!-- 选项列表 -->
                  <div class="ios-fullscreen-dialog-options">
                    <!-- 网页全屏选项 -->
                    <button class="ios-fullscreen-option ios-fullscreen-option-recommended" data-action="web">
                      <div class="ios-fullscreen-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                          <path d="M7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" fill="currentColor"/>
                        </svg>
                      </div>
                      <div class="ios-fullscreen-option-content">
                        <div class="ios-fullscreen-option-title">
                          网页全屏
                          <span class="ios-fullscreen-option-badge">推荐</span>
                        </div>
                        <div class="ios-fullscreen-option-desc">
                          保留弹幕、控制栏等所有功能
                        </div>
                      </div>
                      <svg class="ios-fullscreen-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>

                    <!-- 原生全屏选项 -->
                    <button class="ios-fullscreen-option" data-action="native">
                      <div class="ios-fullscreen-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                      </div>
                      <div class="ios-fullscreen-option-content">
                        <div class="ios-fullscreen-option-title">
                          原生全屏
                        </div>
                        <div class="ios-fullscreen-option-desc">
                          使用系统播放器，部分功能不可用
                        </div>
                      </div>
                      <svg class="ios-fullscreen-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>

                  <!-- 底部提示 -->
                  <div class="ios-fullscreen-dialog-footer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 16v-4m0-4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>将网站添加到主屏幕（PWA）后，网页全屏可以完全全屏</span>
                  </div>
                </div>
              `;

              // 添加到页面
              document.body.appendChild(dialog);

              // 点击背景关闭
              dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                  document.body.removeChild(dialog);
                }
              });

              // 按钮点击事件
              const buttons = dialog.querySelectorAll('.ios-fullscreen-option');
              buttons.forEach((button) => {
                button.addEventListener('click', () => {
                  const action = button.getAttribute('data-action');

                  if (action === 'web') {
                    // 网页全屏
                    if (artPlayerRef.current) {
                      artPlayerRef.current.fullscreenWeb = true;
                    }
                  } else if (action === 'native') {
                    // 原生全屏（尝试使用浏览器的全屏 API）
                    if (
                      artPlayerRef.current &&
                      artPlayerRef.current.template.$video
                    ) {
                      const videoElement = artPlayerRef.current.template.$video;
                      if (videoElement.requestFullscreen) {
                        videoElement.requestFullscreen();
                      } else if (videoElement.webkitEnterFullscreen) {
                        videoElement.webkitEnterFullscreen();
                      }
                    }
                  }

                  // 关闭对话框
                  document.body.removeChild(dialog);
                });
              });
            },
          },
        ]
      : []),
  ];
}
