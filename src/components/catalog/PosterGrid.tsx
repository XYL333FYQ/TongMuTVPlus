import type { HTMLAttributes } from 'react';

export default function PosterGrid({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`tm-poster-grid ${className}`} {...props} />;
}
