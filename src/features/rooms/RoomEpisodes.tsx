'use client';

import { usePlaybackSession } from '@/features/playback/context';
import { playbackHrefFromState } from '@/features/playback/session';
import { useRoomPlayback } from '@/features/room/RoomPlaybackBridge';

import type { PlayState } from '@/types/watch-room';

/** 名称太长（或只是“第01集”这类）时只显示集号，完整名称放在提示里。 */
function episodeLabel(title: string, index: number) {
  const trimmed = title.trim();
  if (!trimmed || /^第?\s*0*\d+\s*[集话話期]?$/.test(trimmed))
    return String(index + 1);
  return trimmed.length > 8 ? String(index + 1) : trimmed;
}

/**
 * 房间里的选集（相当于 SyncTV 的动态片单）：有换片权限的人点一集，
 * 整个房间一起切过去；没有权限的人只能看到当前在第几集。
 * 集数来自本机播放器解析到的影片资料，必须和房间正在放的是同一部。
 */
export default function RoomEpisodes({
  state,
  canChange,
}: {
  state: PlayState;
  canChange: boolean;
}) {
  const playback = usePlaybackSession();
  const roomPlayback = useRoomPlayback();
  const media = playback.media;
  const sameFilm =
    media &&
    media.source === state.source &&
    String(media.videoId) === String(state.videoId);
  const titles = sameFilm ? playback.metadata.episodeTitles || [] : [];
  if (titles.length < 2) return null;
  const current = state.episode || 1;
  return (
    <section className='tm-room-episodes' aria-label='选集'>
      <header>
        <h3>选集</h3>
        <span>
          第 {current} / {titles.length} 集{!canChange && ' · 没有换集权限'}
        </span>
      </header>
      <div className='tm-room-episode-grid'>
        {titles.map((title, index) => {
          const episode = index + 1;
          const active = episode === current;
          return (
            <button
              key={episode}
              type='button'
              aria-current={active ? 'true' : undefined}
              aria-label={`第${episode}集${title ? `：${title}` : ''}`}
              title={title || `第${episode}集`}
              disabled={!canChange || active}
              onClick={() =>
                roomPlayback.playTogether(
                  playbackHrefFromState({
                    ...state,
                    episode,
                    queueItemId: undefined,
                  })
                )
              }
            >
              {episodeLabel(title, index)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
