'use client';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';
export default function PosterAmbient({
  imageKey,
  children,
}: {
  imageKey: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotionSetting();
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={imageKey}
        className='tm-detail-ambient'
        aria-hidden='true'
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.12 : 0.6 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
