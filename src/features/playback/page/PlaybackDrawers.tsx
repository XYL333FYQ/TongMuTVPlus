'use client';

import { useState } from 'react';

import { isNetdiskSource } from '@/lib/netdisk/source';
import type { SearchResult } from '@/lib/types';

import AIChatPanel from '@/components/AIChatPanel';
import CorrectDialog from '@/components/CorrectDialog';
import DetailPanel from '@/components/DetailPanel';

export type PlaybackDrawer = 'pansou' | 'aiChat' | 'correct' | 'detail';

type DrawerState = Record<PlaybackDrawer, boolean>;

const CLOSED: DrawerState = {
  pansou: false,
  aiChat: false,
  correct: false,
  detail: false,
};

/**
 * 网盘、AI 问片、纠错、详情四个面板。平板和电脑上是右侧抽屉，同一时间只开一个；
 * 手机上是弹窗，各开各的。
 */
export function usePlaybackDrawers(drawerMode: boolean) {
  const [open, setOpen] = useState<DrawerState>(CLOSED);
  const show = (drawer: PlaybackDrawer) =>
    setOpen((previous) =>
      drawerMode
        ? { ...CLOSED, [drawer]: true }
        : { ...previous, [drawer]: true }
    );
  const close = (drawer: PlaybackDrawer) =>
    setOpen((previous) => ({ ...previous, [drawer]: false }));
  return { open, show, close };
}

interface PlaybackDrawersProps {
  open: DrawerState;
  onClose: (drawer: PlaybackDrawer) => void;
  /** 平板和电脑用右侧抽屉 */
  drawerMode: boolean;
  detail: SearchResult | null;
  videoDoubanId: number;
  currentEpisode: number;
  aiEnabled: boolean;
  /** 后台配置的 AI 问片欢迎语，{title} 换成片名 */
  aiWelcomeTemplate: string;
  onCorrected: () => void;
}

/** AI 问片、纠错（只有小雅源）、详情三个面板 */
export default function PlaybackDrawers({
  open,
  onClose,
  drawerMode,
  detail,
  videoDoubanId,
  currentEpisode,
  aiEnabled,
  aiWelcomeTemplate,
  onCorrected,
}: PlaybackDrawersProps) {
  return (
    <>
      {/* AI问片面板 */}
      {aiEnabled && detail && (
        <AIChatPanel
          isOpen={open.aiChat}
          onClose={() => onClose('aiChat')}
          context={{
            title: detail.title,
            year: detail.year,
            douban_id: videoDoubanId !== 0 ? videoDoubanId : undefined,
            currentEpisode,
          }}
          welcomeMessage={
            aiWelcomeTemplate
              ? aiWelcomeTemplate.replace('{title}', detail.title || '')
              : `想了解《${detail.title}》的更多信息吗？我可以帮你查询剧情、演员、评价等。`
          }
          useDrawer={drawerMode}
          drawerWidth='w-[400px]'
        />
      )}

      {/* 纠错弹窗 - 仅小雅源显示 */}
      {detail && detail.source === 'xiaoya' && (
        <CorrectDialog
          isOpen={open.correct}
          onClose={() => onClose('correct')}
          videoKey={`${detail.source}_${detail.id}`}
          currentTitle={detail.title}
          currentVideo={{
            tmdbId: detail.tmdb_id,
            doubanId: detail.douban_id ? String(detail.douban_id) : undefined,
            poster: detail.poster,
            releaseDate: detail.year,
            overview: detail.desc,
            voteAverage: detail.rating,
            mediaType: detail.type_name === '电影' ? 'movie' : 'tv',
          }}
          source='xiaoya'
          onCorrect={onCorrected}
          useDrawer={drawerMode}
          drawerWidth='w-[400px]'
        />
      )}

      {/* 详情面板 */}
      {detail && (
        <DetailPanel
          isOpen={open.detail}
          onClose={() => onClose('detail')}
          title={detail.title}
          poster={detail.poster}
          doubanId={
            // 特殊源使用 tmdb，其他使用 cms（通过 doubanId）
            // 如果有豆瓣ID且不为0，传入doubanId
            detail.source === 'openlist' ||
            isNetdiskSource(detail.source) ||
            detail.source?.startsWith('emby') ||
            detail.source === 'xiaoya'
              ? undefined
              : detail.douban_id && detail.douban_id !== 0
              ? detail.douban_id
              : undefined
          }
          tmdbId={
            // 特殊源使用 tmdb
            detail.source === 'openlist' ||
            isNetdiskSource(detail.source) ||
            detail.source?.startsWith('emby') ||
            detail.source === 'xiaoya'
              ? detail.tmdb_id
              : undefined
          }
          type={detail.type_name === '电影' ? 'movie' : 'tv'}
          year={detail.year}
          currentEpisode={currentEpisode}
          cmsData={
            // 非特殊源使用 cms 数据
            // 但如果有豆瓣ID且不为0，则不传入cmsData，优先使用豆瓣数据
            detail.source !== 'openlist' &&
            !isNetdiskSource(detail.source) &&
            !detail.source?.startsWith('emby') &&
            detail.source !== 'xiaoya' &&
            !(detail.douban_id && detail.douban_id !== 0)
              ? {
                  desc: detail.desc,
                  episodes: detail.episodes,
                  episodes_titles: detail.episodes_titles,
                }
              : undefined
          }
          sourceId={detail.id}
          source={detail.source}
          useDrawer={drawerMode}
          drawerWidth='w-[400px]'
        />
      )}
    </>
  );
}
