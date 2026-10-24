import { cn } from '@/lib/cn';

import { LIBRARY_MUTED, LIBRARY_SERIF } from './library';

/**
 * 保留原区块与分隔线，排版遵循 TYPOGRAPHY 的同级标题规则。
 */
export default function MediaSectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className='flex items-baseline gap-3'>
        <h2 className={cn('tm-section-title shrink-0', LIBRARY_SERIF)}>
          {title}
        </h2>
        <span className='h-px min-w-4 flex-1 bg-line' aria-hidden />
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
      {subtitle && (
        <p className={cn('mt-1.5 text-[13px]', LIBRARY_MUTED)}>{subtitle}</p>
      )}
    </div>
  );
}
