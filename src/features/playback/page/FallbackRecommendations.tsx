'use client';

import { Sparkles } from 'lucide-react';
import { type MouseEvent, type WheelEvent, useRef } from 'react';

import VideoCard from '@/components/VideoCard';

import type { FallbackRecommendation } from './types';

/** 片源都找不到时，失败页下方的“也许你想看”：一行可横向拖动、滚轮横滚的卡片 */
export default function FallbackRecommendations({
  items,
  query,
}: {
  items: FallbackRecommendation[];
  query: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScrollLeft: 0 });

  if (items.length === 0) return null;

  // 竖向滚轮也横向滚动；滚到头时交还给页面
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth + 1) return;
    const delta =
      Math.abs(event.deltaY) >= Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
    if (delta === 0) return;
    const max = row.scrollWidth - row.clientWidth;
    const willScroll =
      (delta < 0 && row.scrollLeft > 0) || (delta > 0 && row.scrollLeft < max);
    if (!willScroll) return;
    event.preventDefault();
    row.scrollLeft = Math.max(0, Math.min(max, row.scrollLeft + delta));
  };
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth || event.button !== 0)
      return;
    drag.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: row.scrollLeft,
    };
  };
  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row || !drag.current.active) return;
    row.scrollLeft =
      drag.current.startScrollLeft - (event.clientX - drag.current.startX);
  };
  const stopDragging = () => {
    drag.current.active = false;
  };

  return (
    <div className='tm-precs-div-1'>
      <div className='tm-precs-div-2'>
        <Sparkles className='tm-precs-sparkles-1' />
        <h3 className='tm-precs-h3-1'>也许你想看</h3>
      </div>
      <div
        ref={rowRef}
        className='tm-precs-div-3'
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
      >
        <div className='tm-precs-div-4'>
          {items.map((recommendation) => (
            <div key={recommendation.key} className='tm-precs-div-5'>
              <VideoCard
                title={recommendation.item.title}
                query={query}
                poster={recommendation.item.poster}
                episodes={recommendation.episodes}
                source_names={recommendation.sourceNames}
                year={recommendation.item.year}
                douban_id={recommendation.doubanId}
                from='search'
                isAggregate
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
