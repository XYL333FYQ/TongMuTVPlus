import type { ReactNode } from 'react';

/**
 * 全站唯一的空状态：居中的图标 + 一句话 + 可选的说明和操作，不加边框、不加底板
 * （layout.css 的 tm-empty）。面板、弹窗里的列表用 compact。
 * 加载失败不是“空”，用 RetryNotice。
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  role,
  titleAs: Title = 'p',
  className,
}: {
  /** 图标元素，例如 <Search size={24} /> */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  /** 整页的“没找到”用 status，出错页用 alert */
  role?: 'status' | 'alert';
  /** 整页只有这一句时用 h1 */
  titleAs?: 'p' | 'h1' | 'h2';
  className?: string;
}) {
  return (
    <div
      className={className ? `tm-empty ${className}` : 'tm-empty'}
      data-compact={compact || undefined}
      role={role}
    >
      {icon ? (
        <span className='tm-empty-icon' aria-hidden='true'>
          {icon}
        </span>
      ) : null}
      <Title className='tm-empty-title'>{title}</Title>
      {description ? <p className='tm-empty-desc'>{description}</p> : null}
      {action ? <div className='tm-empty-actions'>{action}</div> : null}
    </div>
  );
}
