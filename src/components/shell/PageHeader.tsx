import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** 标题右侧的按钮区 */
  actions?: ReactNode;
  className?: string;
}

/** 页面大标题：左边标题和一句说明，右边放操作按钮。 */
export default function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`tm-page-head ${className}`}>
      <div className='min-w-0'>
        <h1 className='tm-page-title'>{title}</h1>
        {description && <p className='tm-page-desc'>{description}</p>}
      </div>
      {actions && <div className='tm-page-actions'>{actions}</div>}
    </header>
  );
}
