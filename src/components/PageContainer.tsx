import type { HTMLAttributes } from 'react';

export default function PageContainer({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`tm-page-container ${className}`} {...props} />;
}
