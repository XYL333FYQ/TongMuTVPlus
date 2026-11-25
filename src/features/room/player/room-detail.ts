/*
 * 房间影片的详情（选集、标题）：同一片源同一影片只取一次；直链不请求，直接拼一份。
 * 取失败的不缓存，下次再取。
 */

import type { SearchResult } from '@/lib/types';
import { base58Decode } from '@/lib/utils';

import { fetchSourceDetail } from '@/features/room/media/catalog';

import type { PlayState } from '@/types/watch-room';

const detailCache = new Map<string, Promise<SearchResult | null>>();

export function roomDetail(
  state: Pick<
    PlayState,
    'source' | 'videoId' | 'videoName' | 'searchTitle' | 'poster'
  >
) {
  const key = `${state.source}\u0000${state.videoId}`;
  let pending = detailCache.get(key);
  if (!pending) {
    if (state.source === 'directplay') {
      let url = '';
      try {
        url = base58Decode(state.videoId);
      } catch {
        url = '';
      }
      pending = Promise.resolve(
        url
          ? ({
              id: state.videoId,
              title: state.videoName || '直链播放',
              poster: state.poster || '',
              episodes: [url],
              episodes_titles: ['直链'],
              source: 'directplay',
              source_name: '直链',
              class: '',
              year: '',
              desc: '',
              type_name: '',
              douban_id: 0,
            } as SearchResult)
          : null
      );
    } else
      pending = fetchSourceDetail(
        state.source,
        state.videoId,
        state.searchTitle || state.videoName || ''
      ).catch(() => null);
    detailCache.set(key, pending);
    void pending.then((value) => {
      if (!value) detailCache.delete(key);
    });
  }
  return pending;
}
