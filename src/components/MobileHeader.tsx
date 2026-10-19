'use client';

import { motion } from 'framer-motion';

import { useReducedMotionSetting } from '@/lib/motion';

import { BackButton } from './BackButton';
import { ThemeToggle } from './ThemeToggle';
import ViewerAccountButton from '@/components/shell/ViewerAccountButton';

interface MobileHeaderProps {
  showBackButton?: boolean;
  title: string;
  subtitle?: React.ReactNode;
  compact: boolean;
  scrolled: boolean;
  actions?: React.ReactNode;
}

export default function MobileHeader({
  showBackButton = false,
  title,
  subtitle,
  compact,
  scrolled,
  actions,
}: MobileHeaderProps) {
  const reduced = useReducedMotionSetting();
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
        <motion.h1
          className='tm-mobile-page-title'
          style={reduced ? { fontSize: compact ? 17 : 28 } : undefined}
          animate={{ scale: reduced ? 1 : compact ? 17 / 28 : 1 }}
          transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {title}
        </motion.h1>
        <div className='tm-mobile-account'>
          {actions}
          <ThemeToggle />
          <ViewerAccountButton />
        </div>
      </div>
    </header>
  );
}
