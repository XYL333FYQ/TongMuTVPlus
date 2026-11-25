/*
 * 自己看：打开一部片时从哪一集、哪个位置开始。
 * 顺序：地址里点名的集（房间 / 片单选的）> 从文件进来时点的那一集 > 播放记录 > 第 1 集；
 * 位置：点名的集正好是播放记录那一集就接着播放记录，否则用本机按集记的进度。
 */

import { logger } from '@/lib/logger';

export interface StartEpisodeInput {
  /** 播放记录：第几集（从 1 开始）和看到哪 */
  record?: { index: number; play_time: number } | null;
  /** 地址里的 episode（从 0 开始），可能越界 */
  requestedIndex?: number;
  /** 详情里带的起始集（从文件点进来时） */
  detailInitialIndex?: number;
  episodeCount: number;
  /** 本机按集记的进度 */
  localProgress: (index: number) => number | null;
}

export function chooseStartEpisode({
  record,
  requestedIndex,
  detailInitialIndex,
  episodeCount,
  localProgress,
}: StartEpisodeInput): { index: number; resumeTime: number | null } {
  // Explicit room/queue selection takes precedence over personal viewing history.
  const initialEpisodeIndex =
    requestedIndex !== undefined
      ? Math.min(requestedIndex, Math.max(0, episodeCount - 1))
      : detailInitialIndex;

  if (record) {
    const recordIndex = record.index - 1;
    const recordTime = record.play_time;
    if (initialEpisodeIndex !== undefined) {
      if (recordIndex === initialEpisodeIndex) {
        logger.info(
          '[Play] 播放记录集数与点击文件一致，恢复播放进度:',
          recordTime
        );
        return { index: recordIndex, resumeTime: recordTime };
      }
      logger.info('[Play] 使用点击的文件集数:', initialEpisodeIndex);
      return {
        index: initialEpisodeIndex,
        resumeTime: localProgress(initialEpisodeIndex),
      };
    }
    logger.info('[Play] 使用播放记录集数:', recordIndex);
    return { index: recordIndex, resumeTime: recordTime };
  }
  if (initialEpisodeIndex !== undefined) {
    logger.info(
      '[Play] 没有播放记录，使用点击的文件集数:',
      initialEpisodeIndex
    );
    return {
      index: initialEpisodeIndex,
      resumeTime: localProgress(initialEpisodeIndex),
    };
  }
  logger.info('[Play] 没有播放记录，从第0集开始');
  return { index: 0, resumeTime: localProgress(0) };
}
