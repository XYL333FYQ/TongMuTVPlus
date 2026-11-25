/*
 * 首页大图推荐的数据形状和地址：TMDB / 腾讯 / 豆瓣三种来源的条目，原图地址、预告片地址。
 */

import { readSetting } from '@/lib/settings';
import type { TMDBItem } from '@/lib/tmdb.client';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';

// 扩展TMDBItem类型以支持TX数据源的额外字段
export interface BannerItem extends TMDBItem {
  subtitle?: string; // TX数据源的子标题
  tags?: string[]; // TX数据源的标签
  trailer_url?: string | null; // 豆瓣预告片直链
  genres?: string[]; // 豆瓣数据源的类型标签
}

// 获取图片原始URL（处理TX完整URL和TMDB路径）
export const bannerImageUrl = (path: string | null) => {
  if (!path) return '';
  // 如果是完整URL（TX数据源或豆瓣），直接返回原始地址
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // 豆瓣中图只有 540 宽，铺满大图会糊；换成同一张的大图（1080 宽）
    return path.replace(/\/[sm]_ratio_poster\//, '/l_ratio_poster/');
  }
  // 否则使用TMDB的URL拼接原始地址
  return getTMDBImageUrl(path, 'original');
};

// 获取视频URL（处理豆瓣视频代理）
export const bannerVideoUrl = (url: string | null) => {
  if (!url) return null;
  // 豆瓣视频直接使用服务器代理
  if (url.includes('doubanio.com')) {
    return `/api/video-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export type HomeBannerHeightScale = '1' | '1.5' | '2';

export const getSavedBannerHeightScale = (): HomeBannerHeightScale => {
  if (typeof window === 'undefined') return '1';

  const saved = readSetting('homeBannerHeightScale');
  return saved === '1.5' || saved === '2' ? saved : '1';
};
