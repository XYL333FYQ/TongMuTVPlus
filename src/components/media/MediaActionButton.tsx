import { cn } from '@/lib/cn';

import { LIBRARY_FOCUS } from './library';

/**
 * 卡片下方的普通操作按钮（非开关型），与 ShelfToggleButton 同一套视觉。
 *
 * 与 ShelfToggleButton 的区别只在语义：这个不输出 aria-pressed。
 */
export default function MediaActionButton({
  tone = 'default',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type='button'
      className={cn(
        'w-full min-h-[44px] rounded-sm border px-3 py-2 text-sm font-medium tm-press disabled:opacity-50',
        LIBRARY_FOCUS,
        tone === 'danger'
          ? 'border-line text-danger hover:border-danger'
          : 'border-line text-muted hover:border-fg hover:text-fg',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
