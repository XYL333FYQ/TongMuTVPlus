import type { SearchResult } from '@/lib/types';

/** 剧集是否完结：先看备注里的关键词，再比较已有集数和总集数 */
export function seriesStatus(
  detail: SearchResult | null
): 'completed' | 'ongoing' | 'unknown' {
  if (!detail) return 'unknown';

  // 方法1：通过 vod_remarks 判断
  if (detail.vod_remarks) {
    const remarks = detail.vod_remarks.toLowerCase();
    // 判定为完结的关键词
    const completedKeywords = ['全', '完结', '大结局', 'end', '完'];
    // 判定为连载的关键词
    const ongoingKeywords = ['更新至', '连载', '第', '更新到'];

    // 如果包含连载关键词，则为连载中
    if (ongoingKeywords.some((keyword) => remarks.includes(keyword))) {
      return 'ongoing';
    }

    // 如果包含完结关键词，则为已完结
    if (completedKeywords.some((keyword) => remarks.includes(keyword))) {
      return 'completed';
    }
  }

  // 方法2：通过 vod_total 和实际集数对比判断
  if (
    detail.vod_total &&
    detail.vod_total > 0 &&
    detail.episodes &&
    detail.episodes.length > 0
  ) {
    // 如果实际集数 >= 总集数，则为已完结
    if (detail.episodes.length >= detail.vod_total) {
      return 'completed';
    }
    // 如果实际集数 < 总集数，则为连载中
    return 'ongoing';
  }

  // 无法判断，返回 unknown
  return 'unknown';
}
