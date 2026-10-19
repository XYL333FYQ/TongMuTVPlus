import { cn } from '@/lib/cn';

import { ImagePlaceholder } from '@/components/ImagePlaceholder';

import { BOOK_COVER_LIFT } from './library';

/**
 * 媒体卡片骨架。结构与 MediaCard 一一对应，避免加载完成时的布局跳动。
 */
export default function MediaCardSkeleton({
  aspect = '3/4',
  className,
}: {
  aspect?: '3/4' | '2/3';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className='overflow-hidden rounded-[14px] border border-[var(--tm-line)] bg-[var(--tm-surface)]'
        aria-hidden
      >
        <div className={cn('bg-[var(--tm-surface-raised)]', BOOK_COVER_LIFT)}>
          <ImagePlaceholder
            aspectRatio={aspect === '3/4' ? 'aspect-[3/4]' : 'aspect-[2/3]'}
            className='rounded-none'
          />
        </div>
        <div className='space-y-2 px-2.5 pb-2.5 pt-2'>
          <div className='tm-skeleton h-[24px] w-3/4 rounded-sm' />
          <div className='tm-skeleton h-[22px] w-1/2 rounded-sm' />
        </div>
      </div>
    </div>
  );
}
