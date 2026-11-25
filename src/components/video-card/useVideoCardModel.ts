'use client';

/*
 * 影片卡片的全部状态集中一处：基础 → 动作 → 上映 / 预告片 / 菜单，按原来的顺序调用。
 */

import type { ForwardedRef } from 'react';

import { useVideoCardActions } from './useVideoCardActions';
import { useVideoCardBase } from './useVideoCardBase';
import { useVideoCardMenu } from './useVideoCardMenu';
import type { VideoCardHandle, VideoCardProps } from '../VideoCard';

export function useVideoCardModel(
  props: VideoCardProps,
  ref: ForwardedRef<VideoCardHandle>
) {
  const base = useVideoCardBase(props, ref);
  const actions = useVideoCardActions(base);
  const menu = useVideoCardMenu({ ...base, ...actions });
  return { ...base, ...actions, ...menu };
}

export type VideoCardModel = ReturnType<typeof useVideoCardModel>;
