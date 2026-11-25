/*
 * 自己看：“上次播放到 xx:xx · 跳转”提示。进入播放后第一次开始播放时检查：
 * 这一集有播放记录、记录 > 10 秒而现在 < 10 秒，就在画面左下给一个跳转按钮（短剧不提示）。
 */

import { generateStorageKey, getAllPlayRecords } from '@/lib/db.client';
import { logger } from '@/lib/logger';
import { formatClock } from '@/lib/time';

import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
import type { WireInstanceContext } from './wire-instance';

export function watchPlayRecordJump(art: Art, ctx: WireInstanceContext) {
  const {
    artPlayerRef,
    currentEpisodeIndexRef,
    currentIdRef,
    currentSourceRef,
    playRecordJumpDismissedRef,
    playRecordJumpInitialCheckRef,
    playRecordJumpLayerRef,
    searchParams,
  } = ctx;
  // 监听视频播放事件，检查是否需要显示播放记录跳转按钮
  art.on('video:playing', () => {
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

        const currentTime = art?.currentTime || 0;

        // 如果当前播放时间已经大于等于10秒，不显示跳转按钮
        if (currentTime >= 10) {
          // 标记已经进行过首次检查，避免切集后再显示
          playRecordJumpInitialCheckRef.current = false;
          if (playRecordJumpLayerRef.current) {
            art.layers.remove('play-record-jump');
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

            // 添加到播放器 layers
            playRecordJumpLayerRef.current =
              art.layers.add({
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
                    border-radius: var(--tm-radius-sm);
                    font-size: 14px;
                    font-family: system-ui, -apple-system, sans-serif;
                    pointer-events: auto;
                  ">
                    <span style="margin-right: 4px;">
                      上次播放到 ${formatClock(recordTime)}
                    </span>
                    <button id="play-record-jump-btn" style="
                      padding: 4px 12px;
                      border-width: 1px;
                      border-style: solid;
                      border-radius: var(--tm-radius-sm);
                      font-size: 13px;
                      cursor: pointer;
                      transition: all 0.2s;
                      font-weight: 500;
                    ">
                      跳转
                    </button>
                    <button id="play-record-dismiss-btn" style="
                      padding: 4px 8px;
                      border-width: 0;
                      border-style: solid;
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
                  left: '0',
                  bottom: '0',
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                },
              }) ?? null;

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
                if (art) {
                  art.currentTime = recordTime;
                  art.notice.show = `已跳转到 ${formatClock(recordTime)}`;
                }
                playRecordJumpDismissedRef.current = true;
                if (playRecordJumpLayerRef.current) {
                  art.layers.remove('play-record-jump');
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
                  art.layers.remove('play-record-jump');
                  playRecordJumpLayerRef.current = null;
                }
              });
            }

            logger.info(
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
        logger.error('[PlayRecordJump] 检查播放记录失败:', err);
        // 即使出错也标记为已检查过
        playRecordJumpInitialCheckRef.current = false;
      }
    };

    // 延迟检查，确保播放器已经稳定（这期间换集重建了就交给新实例自己检查）
    setTimeout(() => {
      if (artPlayerRef.current === art) void checkPlayRecordJump();
    }, 500);
  });
}
