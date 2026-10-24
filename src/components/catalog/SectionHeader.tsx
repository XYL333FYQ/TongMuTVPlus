import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** 区块标题行：左标题，右「查看全部」或自定义操作。 */
export default function SectionHeader({
  title,
  href,
  actions,
  className = '',
  linkLabel = '查看全部',
}: {
  title: string;
  href?: string;
  actions?: ReactNode;
  className?: string;
  linkLabel?: string;
}) {
  return (
    <div className={'tm-section-header ' + className}>
      <h2 className='tm-section-title'>{title}</h2>
      {href ? (
        <Link href={href} className='tm-section-link'>
          {linkLabel}
          <ChevronRight size={14} aria-hidden />
        </Link>
      ) : (
        actions
      )}
    </div>
  );
}
