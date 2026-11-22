/*
 * 自己看：网盘片源的资料常常只有文件夹名。TMDB 资料到了以后补上简介、海报、年份和 TMDB 编号
 * （详情还没回来时先存着，等详情到了再合并）。
 */

import { type Dispatch, type SetStateAction, useEffect } from 'react';

import { isNetdiskSource } from '@/lib/netdisk/source';
import type { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import type { TmdbPlayDetails } from '../data/load-tmdb-backdrop';

export interface NetdiskTmdbMeta {
  desc?: string;
  poster?: string;
  year?: string;
  tmdbId?: number;
}

interface UseNetdiskTmdbMergeOptions {
  detail: SearchResult | null;
  pendingNetdiskTMDBData: TmdbPlayDetails | null;
  setPendingNetdiskTMDBData: Dispatch<SetStateAction<TmdbPlayDetails | null>>;
  setNetdiskTMDBMeta: Dispatch<SetStateAction<NetdiskTmdbMeta | null>>;
  setDetail: Dispatch<SetStateAction<SearchResult | null>>;
  setVideoCover: Dispatch<SetStateAction<string>>;
  setVideoYear: Dispatch<SetStateAction<string>>;
  setCorrectedDesc: Dispatch<SetStateAction<string>>;
}

export function useNetdiskTmdbMerge({
  detail,
  pendingNetdiskTMDBData,
  setPendingNetdiskTMDBData,
  setNetdiskTMDBMeta,
  setDetail,
  setVideoCover,
  setVideoYear,
  setCorrectedDesc,
}: UseNetdiskTmdbMergeOptions) {
  useEffect(() => {
    if (pendingNetdiskTMDBData && isNetdiskSource(detail?.source)) {
      const currentDetail = detail;
      if (!currentDetail) {
        return;
      }
      const pending = pendingNetdiskTMDBData;
      setPendingNetdiskTMDBData(null);
      const tmdbYear = pending.releaseDate?.split('-')[0] || '';
      const shouldReplaceDesc =
        !currentDetail.desc ||
        currentDetail.desc.startsWith('临时播放目录：') ||
        currentDetail.desc.startsWith('移动云盘分享：');
      const resolvedTmdbId =
        typeof pending.tmdbId === 'string'
          ? Number(String(pending.tmdbId).split(':')[1] || 0)
          : pending.tmdbId;

      setNetdiskTMDBMeta({
        desc: shouldReplaceDesc
          ? pending.overview || currentDetail.desc
          : currentDetail.desc,
        poster: currentDetail.poster || pending.poster || '',
        year: currentDetail.year || tmdbYear,
        tmdbId: currentDetail.tmdb_id || resolvedTmdbId,
      });

      setDetail((prev) =>
        prev && isNetdiskSource(prev.source)
          ? {
              ...prev,
              poster: prev.poster || pending.poster || '',
              year: prev.year || tmdbYear,
              desc: shouldReplaceDesc
                ? pending.overview || prev.desc
                : prev.desc,
              tmdb_id: prev.tmdb_id || resolvedTmdbId,
            }
          : prev
      );

      if (pending.poster && !currentDetail.poster) {
        setVideoCover(processImageUrl(pending.poster));
      }
      if (tmdbYear && !currentDetail.year) {
        setVideoYear(tmdbYear);
      }
      if (pending.overview) {
        setCorrectedDesc(pending.overview);
      }
    }
    // 其余都是页面传进来的 setState，不会变
  }, [
    pendingNetdiskTMDBData,
    detail,
    setPendingNetdiskTMDBData,
    setNetdiskTMDBMeta,
    setDetail,
    setVideoCover,
    setVideoYear,
    setCorrectedDesc,
  ]);
}
