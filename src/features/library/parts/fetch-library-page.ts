/*
 * 片库取一页数据：按类型（自定义分类 / 每日放送 / 动画 / 全部 / 其他分类）选接口。
 * 首屏和“加载更多”共用这一份（原来两处各写了一遍）。
 */

import { GetBangumiCalendarData } from '@/lib/bangumi.client';
import {
  getDoubanCategories,
  getDoubanList,
  getDoubanRecommends,
} from '@/lib/douban.client';
import { DoubanResult } from '@/lib/types';

const PAGE_SIZE = 25;

export interface LibraryQuery {
  type: string;
  primarySelection: string;
  secondarySelection: string;
  multiLevelValues: Record<string, string>;
  selectedWeekday: string;
  customCategories: Array<{
    name: string;
    type: 'movie' | 'tv';
    query: string;
  }>;
}

/** 分类接口的参数：剧集 / 综艺的 kind 统一为 tv，category 用类型本身 */
export function libraryCategoryParams(query: LibraryQuery, pageStart: number) {
  const { type, primarySelection, secondarySelection } = query;
  if (type === 'tv' || type === 'show') {
    return {
      kind: 'tv' as const,
      category: type,
      type: secondarySelection,
      pageLimit: PAGE_SIZE,
      pageStart,
    };
  }
  return {
    kind: type as 'tv' | 'movie',
    category: primarySelection,
    type: secondarySelection,
    pageLimit: PAGE_SIZE,
    pageStart,
  };
}

/** 多级筛选里的值：没选就是空串 */
const pick = (values: Record<string, string>, key: string) =>
  values[key] ? values[key] : '';

/**
 * 取第 page 页（从 0 开始）。options 只在首屏刷新时传（可中止、不报全局错）；
 * 每日放送只有一页，加载更多时直接返回空列表。
 */
export async function fetchLibraryPage(
  query: LibraryQuery,
  page: number,
  options?: { signal: AbortSignal; reportError: false }
): Promise<DoubanResult> {
  const { type, primarySelection, secondarySelection, multiLevelValues } =
    query;
  const pageStart = page * PAGE_SIZE;
  if (type === 'custom') {
    const selected = query.customCategories.find(
      (cat) => cat.type === primarySelection && cat.query === secondarySelection
    );
    if (!selected) throw new Error('没有找到对应的分类');
    return getDoubanList(
      {
        tag: selected.query,
        type: selected.type,
        pageLimit: PAGE_SIZE,
        pageStart,
      },
      options
    );
  }
  if (type === 'anime' && primarySelection === '每日放送') {
    if (page > 0) return { code: 200, message: 'success', list: [] };
    const calendar = await GetBangumiCalendarData(
      options ? { force: true, signal: options.signal } : undefined
    );
    const day = calendar.find(
      (item) => item.weekday.en === query.selectedWeekday
    );
    if (!day) throw new Error('没有找到对应的日期');
    return {
      code: 200,
      message: 'success',
      list: day.items
        .filter((item) => item.images) // 过滤掉没有图片的
        .map((item) => ({
          id: item.id?.toString() || '',
          title: item.name_cn || item.name,
          poster:
            item.images.large ||
            item.images.common ||
            item.images.medium ||
            item.images.small ||
            item.images.grid,
          rate: item.rating?.score?.toFixed(1) || '',
          year: item.air_date?.split('-')?.[0] || '',
        })),
    };
  }
  if (type === 'anime') {
    return getDoubanRecommends(
      {
        kind: primarySelection === '番剧' ? 'tv' : 'movie',
        pageLimit: PAGE_SIZE,
        pageStart,
        category: '动画',
        format: primarySelection === '番剧' ? '电视剧' : '',
        region: pick(multiLevelValues, 'region'),
        year: pick(multiLevelValues, 'year'),
        platform: pick(multiLevelValues, 'platform'),
        sort: pick(multiLevelValues, 'sort'),
        label: pick(multiLevelValues, 'label'),
      },
      options
    );
  }
  if (primarySelection === '全部') {
    return getDoubanRecommends(
      {
        kind: type === 'show' ? 'tv' : (type as 'tv' | 'movie'),
        pageLimit: PAGE_SIZE,
        pageStart,
        category: pick(multiLevelValues, 'type'),
        format: type === 'show' ? '综艺' : type === 'tv' ? '电视剧' : '',
        region: pick(multiLevelValues, 'region'),
        year: pick(multiLevelValues, 'year'),
        platform: pick(multiLevelValues, 'platform'),
        sort: pick(multiLevelValues, 'sort'),
        label: pick(multiLevelValues, 'label'),
      },
      options
    );
  }
  return getDoubanCategories(libraryCategoryParams(query, pageStart), options);
}
