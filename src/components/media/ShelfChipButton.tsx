import { BookmarkCheck, BookmarkPlus } from 'lucide-react';

import { cn } from '@/lib/cn';

import { SHELF_CHIP } from './library';
import ShelfToggleButton from './ShelfToggleButton';

/**
 * 封面右下角的书架开关，书墙（推荐页）与搜索结果共用。
 * 未收藏使用固定深色遮罩，已收藏使用全站主色反色。
 */
export default function ShelfChipButton({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick: () => void | Promise<void>;
  className?: string;
}) {
  return (
    <ShelfToggleButton
      active={active}
      aria-label={active ? '移出书架' : '加入书架'}
      onClick={onClick}
      className={cn(
        SHELF_CHIP,
        active
          ? 'bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] hover:bg-[var(--tm-text)] hover:text-[color:var(--tm-accent-contrast)]'
          : 'bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_80%,transparent)] text-[color:var(--tm-room-player-text)] hover:bg-[var(--tm-room-cinema-bg)] hover:text-[color:var(--tm-room-player-text)]',
        className
      )}
    >
      {active ? (
        <BookmarkCheck className='h-4 w-4' />
      ) : (
        <BookmarkPlus className='h-4 w-4' />
      )}
    </ShelfToggleButton>
  );
}
