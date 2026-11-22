import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** 首页上的区块标题另有一套间距和字号（home.css 的 tm-home-section-*），由 variant='home' 打开 */
const HOME_CLASSES = {
  header: ' tm-home-section-header',
  title: ' tm-home-section-title',
  link: ' tm-home-section-link',
};
const NO_CLASSES = { header: '', title: '', link: '' };

/** 区块标题行：左标题，右「查看全部」或自定义操作。 */
export default function SectionHeader({
  title,
  href,
  actions,
  className = '',
  linkLabel = '查看全部',
  variant,
}: {
  title: string;
  href?: string;
  actions?: ReactNode;
  className?: string;
  linkLabel?: string;
  variant?: 'home';
}) {
  const extra = variant === 'home' ? HOME_CLASSES : NO_CLASSES;
  return (
    <div className={'tm-section-header' + extra.header + ' ' + className}>
      <h2 className={'tm-section-title' + extra.title}>{title}</h2>
      {href ? (
        <Link href={href} className={'tm-section-link' + extra.link}>
          {linkLabel}
          <ChevronRight size={14} aria-hidden />
        </Link>
      ) : (
        actions
      )}
    </div>
  );
}
