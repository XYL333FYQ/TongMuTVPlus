import { cn } from '@/lib/cn';

/**
 * 媒体网格。两套功能原本各自复制了同一串 grid 类名。
 */
export default function MediaGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-tm-reveal-group
      className={cn(
        'tm-media-grid grid grid-cols-2 gap-x-3 gap-y-6 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-6',
        className
      )}
    >
      {children}
    </div>
  );
}
