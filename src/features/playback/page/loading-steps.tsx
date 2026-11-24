import { FileText, Hourglass, Link2, Play, Search, Star } from 'lucide-react';

import type { LoadingStep } from '@/components/feedback/LoadingStyle';

/*
 * 初始化加载动画的步骤（后台「个性化配置 → 初始化加载样式」可切换旧版 / 方格 / 魔法阵）。
 *
 * 步骤按真实入口生成，不是固定四步：
 *   directplay 入口 → 直链 → 就绪（两步，不经优选）
 *   其余入口       → 搜索/详情 → 优选 → 就绪（优选会被优选开关整个跳过）
 * 「搜索」用于没带 source/id 的入口，「详情」用于带 source+id 的入口，
 * 两者是第一步的两副面孔，不是先后两步。
 */
export type LoadingStepKey =
  | 'search'
  | 'detail'
  | 'direct'
  | 'prefer'
  | 'ready';

export type LoadingStage = 'searching' | 'preferring' | 'fetching' | 'ready';

export const LOADING_STEP_META: Record<LoadingStepKey, LoadingStep> = {
  search: { label: '搜索', icon: <Search /> },
  detail: { label: '详情', icon: <FileText /> },
  direct: { label: '直链', icon: <Link2 /> },
  prefer: { label: '优选', icon: <Star /> },
  ready: { label: '就绪', icon: <Play /> },
};

/* 播放器遮罩只有两步：初始化，然后播放。
 * 换源、换集对观众都只是「要播了」，用「换源」这类内部说法没人看得懂。 */
export const VIDEO_LOAD_STEPS: LoadingStep[] = [
  { label: '初始化', icon: <Hourglass /> },
  { label: '播放', icon: <Play /> },
];

export interface InitialLoadParams {
  source: string | null;
  id: string | null;
  prefer: string | null;
}

/**
 * 入口参数用首帧定格的值：拿到详情后会把 source/id 写回地址、删掉 prefer，
 * 若跟着地址现算，方格会在「就绪」那一刻从 3 格塌成 2 格。
 */
export function loadingStepModel(
  entry: InitialLoadParams,
  stage: LoadingStage,
  optimizationEnabled: boolean
) {
  const loadEntry: LoadingStepKey =
    entry.source === 'directplay'
      ? 'direct'
      : entry.source && entry.id
      ? 'detail'
      : 'search';
  // 优选只在开了优选开关，且是搜索入口或带 prefer 标记时才有这一格。
  // 带 source+id 的详情入口默认不优选，只剩「获取详情 → 就绪」两格
  const willPrefer =
    optimizationEnabled &&
    loadEntry !== 'direct' &&
    (loadEntry === 'search' || entry.prefer === 'true');
  const steps: LoadingStepKey[] =
    loadEntry === 'direct'
      ? ['direct', 'ready']
      : willPrefer
      ? [loadEntry, 'prefer', 'ready']
      : [loadEntry, 'ready'];
  const activeKey: LoadingStepKey =
    stage === 'ready' ? 'ready' : stage === 'preferring' ? 'prefer' : loadEntry;
  return {
    steps: steps.map((key) => LOADING_STEP_META[key]),
    activeIndex: Math.max(0, steps.indexOf(activeKey)),
  };
}

/** 方格 / 符阵不出现 emoji：阶段语义由描边图标承担，文案只留纯中文 */
export function plainLoadingMessage(message: string) {
  return message.replace(/^[^一-龥]+/, '').replace(/[\s.．。]+$/, '');
}
