import Link from 'next/link';
import type { ReactNode } from 'react';

export default function SectionHeader({
  title,
  href,
  actions,
  className = '',
  linkClassName = 'tm-home-view-all tm-press',
}: {
  title: string;
  href?: string;
  actions?: ReactNode;
  className?: string;
  linkClassName?: string;
}) {
  return (
    <div className={'tm-home-section-heading tm-section-header ' + className}>
      <h2 className='tm-home-section-title'>{title}</h2>
      {href ? (
        <Link href={href} className={linkClassName}>
          查看全部
        </Link>
      ) : (
        actions
      )}
    </div>
  );
}
