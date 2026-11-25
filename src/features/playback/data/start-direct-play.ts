/*
 * 自己看（进入播放页取详情）：直链播放：地址解码成一集，直接开播（不搜片源、不优选），地址栏规范成 source=directplay。
 */

import { logger } from '@/lib/logger';
import { SearchResult } from '@/lib/types';
import { base58Decode } from '@/lib/utils';

import type { LoadSourceDetailContext } from './load-source-detail-context';

export function startDirectPlay(ctx: LoadSourceDetailContext) {
  const {
    commitPlaybackHref,
    currentId,
    playbackSession,
    searchParams,
    setAvailableSources,
    setBackgroundSourcesLoading,
    setCorrectedDesc,
    setCurrentEpisodeIndex,
    setCurrentId,
    setCurrentSource,
    setDetail,
    setError,
    setLoading,
    setLoadingMessage,
    setLoadingStage,
    setNeedPrefer,
    setSourceProxyMode,
    setSourceSearchError,
    setSourceSearchLoading,
    setVideoCover,
    setVideoDoubanId,
    setVideoTitle,
    setVideoYear,
  } = ctx;
  if (!currentId) {
    setError('缺少直链地址');
    setLoading(false);
    return;
  }

  setLoading(true);
  setLoadingStage('fetching');
  setLoadingMessage('正在准备直链播放...');

  let directUrl = '';
  try {
    directUrl = base58Decode(currentId);
  } catch (decodeError) {
    logger.error('直链地址解析失败:', decodeError);
    setError('直链地址解析失败');
    setLoading(false);
    return;
  }

  const directTitle = searchParams.get('title')?.trim() || '直链播放';
  const directDetail: SearchResult = {
    id: currentId,
    title: directTitle,
    poster: '',
    episodes: [directUrl],
    episodes_titles: ['直链'],
    source: 'directplay',
    source_name: '直链',
    class: '',
    year: '',
    desc: '',
    type_name: '',
    douban_id: 0,
  };

  setNeedPrefer(false);
  setCurrentSource('directplay');
  setCurrentId(currentId);
  setVideoTitle(directTitle);
  setVideoYear('');
  setVideoCover('');
  setVideoDoubanId(0);
  setCorrectedDesc('');
  setDetail(directDetail);
  setSourceProxyMode(false);
  setAvailableSources([directDetail]);
  setCurrentEpisodeIndex(0);
  setSourceSearchError(null);
  setSourceSearchLoading(false);
  setBackgroundSourcesLoading(false);

  const newUrl = new URL(
    playbackSession.href || '/play',
    window.location.origin
  );
  newUrl.searchParams.set('source', 'directplay');
  newUrl.searchParams.set('id', currentId);
  newUrl.searchParams.delete('prefer');
  newUrl.searchParams.delete('fileName');
  commitPlaybackHref(newUrl);

  setLoadingStage('ready');
  setLoadingMessage('准备就绪，即将开始播放...');
  setTimeout(() => {
    setLoading(false);
  }, 500);
}
