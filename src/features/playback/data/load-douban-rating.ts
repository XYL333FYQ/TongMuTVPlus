/*
 * 自己看：取豆瓣评分、别名、年份（useEffect 的回调）。
 */

import type { Dispatch, SetStateAction } from 'react';

import { getDoubanDetail } from '@/lib/douban.client';
import { logger } from '@/lib/logger';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface LoadDoubanRatingContext {
  isDirectPlay: boolean;
  setDoubanAka: Dispatch<SetStateAction<string[]>>;
  setDoubanCardSubtitle: Dispatch<SetStateAction<string>>;
  setDoubanRating: Dispatch<
    SetStateAction<{ value: number; count: number; star_count: number } | null>
  >;
  setDoubanYear: Dispatch<SetStateAction<string>>;
  videoDoubanId: number;
}

export function makeLoadDoubanRating(ctx: LoadDoubanRatingContext) {
  const {
    isDirectPlay,
    setDoubanAka,
    setDoubanCardSubtitle,
    setDoubanRating,
    setDoubanYear,
    videoDoubanId,
  } = ctx;
  return () => {
    const fetchDoubanRating = async () => {
      if (isDirectPlay) {
        setDoubanRating(null);
        setDoubanCardSubtitle('');
        setDoubanAka([]);
        setDoubanYear('');
        return;
      }

      if (!videoDoubanId || videoDoubanId === 0) {
        setDoubanRating(null);
        setDoubanCardSubtitle('');
        setDoubanAka([]);
        setDoubanYear('');
        return;
      }

      try {
        const doubanData = await getDoubanDetail(videoDoubanId.toString());

        // 设置评分
        if (doubanData.rating) {
          setDoubanRating({
            value: doubanData.rating.value,
            count: doubanData.rating.count,
            star_count: doubanData.rating.star_count,
          });
        } else {
          setDoubanRating(null);
        }

        // 设置 card_subtitle
        if (doubanData.card_subtitle) {
          setDoubanCardSubtitle(doubanData.card_subtitle);
        }

        // 设置 aka（别名）
        if (doubanData.aka && doubanData.aka.length > 0) {
          setDoubanAka(doubanData.aka);
        }

        // 处理 pubdate 获取年份
        if (doubanData.pubdate && doubanData.pubdate.length > 0) {
          const pubdateStr = doubanData.pubdate[0];
          // 删除括号中的内容，包括括号
          const yearMatch = pubdateStr.replace(/\([^)]*\)/g, '').trim();
          if (yearMatch) {
            setDoubanYear(yearMatch);
          }
        }
      } catch (error) {
        logger.error('获取豆瓣评分失败:', error);
        setDoubanRating(null);
        setDoubanCardSubtitle('');
        setDoubanAka([]);
        setDoubanYear('');
      }
    };

    fetchDoubanRating();
  };
}
