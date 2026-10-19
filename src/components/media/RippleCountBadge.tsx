'use client';

import { motion } from 'framer-motion';

import { useReducedMotionSetting } from '@/lib/motion';

/** 未读数出现时轻弹一次；保留全局旧 keyframes 供其它调用方使用。 */
export default function RippleCountBadge({ count }: { count: number }) {
  const reduced = useReducedMotionSetting();
  return (
    <div className='pointer-events-none absolute right-2 top-2 z-20 h-7 w-7'>
      <motion.span
        key={count}
        className='tm-media-card-motion absolute inset-0 flex items-center justify-center rounded-full bg-fg text-[13px] font-medium tabular-nums text-inverse'
        initial={{ opacity: 0, scale: reduced ? 1 : 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.34, 1.56, 0.64, 1],
        }}
      >
        +{count}
      </motion.span>
    </div>
  );
}
