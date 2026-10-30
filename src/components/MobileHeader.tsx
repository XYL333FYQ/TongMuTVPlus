'use client';

import { motion } from 'framer-motion';

import { useReducedMotionSetting } from '@/lib/motion';

import ViewerAccountButton from '@/components/shell/ViewerAccountButton';

import { BackButton } from './BackButton';
import { ThemeToggle } from './ThemeToggle';

interface MobileHeaderProps {
  showBackButton?: boolean;
  title: string;
  subtitle?: React.ReactNode;
  compact: boolean;
  scrolled: boolean;
  actions?: React.ReactNode;
  /** 页名是否作为本页一级标题；页面自己有可见标题时传 false，页名只作普通文字 */
  heading?: boolean;
}

export default function MobileHeader({
  showBackButton = false,
  title,
  subtitle,
  compact,
  scrolled,
  actions,
  heading = true,
}: MobileHeaderProps) {
  const reduced = useReducedMotionSetting();
  const Title = heading ? motion.h1 : motion.p;
  return (
    <header
      className='tm-mobile-header-v2'
      data-compact={compact}
      data-scrolled={scrolled}
      data-room-actions={Boolean(actions)}
      data-has-subtitle={Boolean(subtitle)}
    >
      <div className='tm-header-glass tm-glass' aria-hidden='true' />
      <div className='tm-mobile-title-row'>
        {subtitle && <div className='tm-mobile-page-subtitle'>{subtitle}</div>}
        {showBackButton && (
          <div className='tm-mobile-back'>
            <BackButton />
          </div>
        )}
        <Title
          className='tm-mobile-page-title'
          style={reduced ? { fontSize: 19 } : undefined}
          animate={{ scale: 1 }}
          transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {title}
        </Title>
        <div className='tm-mobile-account'>
          {actions}
          <ThemeToggle />
          <ViewerAccountButton />
        </div>
      </div>
    </header>
  );
}
