import { cn } from '@/lib/cn';

import { BOOK_RAIL, BOOK_SHELF_BOARD } from './library';
import MediaSectionHeader from './MediaSectionHeader';

/**
 * 书架式横滑列表，保留原布局与中性分隔线。
 *
 * 与网格的区别是浏览方式——rail 用来放"最近/在追"这类短列表，网格用来放全部。
 */
export default function MediaRail({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3 md:space-y-4', className)}>
      <MediaSectionHeader title={title} subtitle={subtitle} action={action} />
      <div
        className={BOOK_SHELF_BOARD}
        style={{
          boxShadow:
            '0 6px 12px -10px color-mix(in srgb, var(--tm-room-cinema-bg) 45%, transparent)',
        }}
      >
        <div data-tm-reveal-group className={BOOK_RAIL}>
          {children}
        </div>
      </div>
    </section>
  );
}
