import type { SearchResult } from '@/lib/types';
import type { PlaybackMedia, PlaybackPort } from '@/features/playback/port';
import { playbackIdentity } from '@/features/playback/session';

export interface RoomMediaDescriptor {
  id: string;
  source: string;
  filmId: string;
  episodeIndex: number;
  title: string;
  episodeTitle: string;
  streamPath: string;
  posterPath?: string | null;
  subtitles: {
    label: string;
    url: string;
    language?: string;
    format?: string;
  }[];
}
export function roomPlaybackSelection(
  descriptor: RoomMediaDescriptor
): PlaybackMedia {
  const { id, source, filmId, episodeIndex } = descriptor;
  if (
    !/^tmmedia_[a-f0-9]{32}$/.test(id) ||
    !source ||
    !filmId ||
    !Number.isSafeInteger(episodeIndex) ||
    episodeIndex < 0 ||
    episodeIndex > 10000 ||
    !descriptor.streamPath.startsWith('/api/together/media/' + id + '/stream.')
  )
    throw new Error('房间影片资料无效');
  const params = new URLSearchParams({
    source,
    id: filmId,
    episode: String(episodeIndex + 1),
    title: descriptor.title,
    mediaRef: id,
  });
  const episodes = Array<string>(episodeIndex + 1).fill(''),
    titles = Array<string>(episodeIndex + 1).fill('');
  episodes[episodeIndex] = descriptor.streamPath;
  titles[episodeIndex] = descriptor.episodeTitle;
  const subtitles: NonNullable<SearchResult['subtitles']> = Array.from(
    { length: episodeIndex + 1 },
    () => []
  );
  subtitles[episodeIndex] = descriptor.subtitles;
  return {
    href: '/play?' + params.toString(),
    detail: {
      source,
      id: filmId,
      title: descriptor.title,
      source_name: '一起看',
      year: '',
      poster: descriptor.posterPath || '',
      episodes,
      episodes_titles: titles,
      subtitles,
      initialEpisodeIndex: episodeIndex,
    },
  };
}
/** Do not apply a room snapshot to the old personal element while the selected film loads. */
export function waitForSelectedPlayer(
  port: PlaybackPort,
  href: string,
  signal: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 30000;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException('Playback selection cancelled', 'AbortError'));
    };
    const poll = () => {
      if (signal.aborted) {
        aborted();
        return;
      }
      const state = port.read();
      if (
        state.ready &&
        state.mediaHref &&
        playbackIdentity(state.mediaHref) === playbackIdentity(href)
      ) {
        cleanup();
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        cleanup();
        reject(new Error('等待影片加载超时'));
        return;
      }
      timer = setTimeout(poll, 50);
    };
    signal.addEventListener('abort', aborted, { once: true });
    poll();
  });
}
