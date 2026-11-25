/*
 * 首页大图（HomeHero）的入参和海报条目。
 */

import type { ReactNode, TouchEventHandler } from 'react';

export interface HeroDeckItem {
  id: string;
  title: string;
  src: string;
}

export interface HomeHeroProps {
  id: string;
  title: string;
  meta: ReactNode;
  description?: string;
  art: ReactNode;
  contain: boolean;
  deck?: HeroDeckItem[];
  renderPoster?: (item: HeroDeckItem) => ReactNode;
  onPlay: () => void;
  onWatchInRoom: () => void;
  onDetail?: () => void;
  titles: string[];
  index: number;
  onSelect: (index: number) => void;
  onAutoSelect?: (index: number) => void;
  autoPlayInterval?: number;
  autoPlayDisabled?: boolean;
  extraControls?: ReactNode;
  onTouchStart?: TouchEventHandler<HTMLElement>;
  onTouchMove?: TouchEventHandler<HTMLElement>;
  onTouchEnd?: TouchEventHandler<HTMLElement>;
}
