'use client';
import { motion, useInView } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';
export default function PosterMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionSetting();
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { once: true, amount: 0.1 });
  const [column, setColumn] = useState(0);
  useEffect(() => {
    const measure = () => {
      const element = root.current;
      if (!element?.parentElement) return;
      const siblings = Array.from(element.parentElement.children);
      setColumn(
        siblings
          .slice(0, siblings.indexOf(element))
          .filter(
            (sibling) =>
              (sibling as HTMLElement).offsetTop === element.offsetTop
          ).length
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <motion.div
      ref={root}
      className='tm-home-poster-motion'
      initial={false}
      animate={visible ? 'visible' : 'hidden'}
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 16 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{
        duration: reduced ? 0.12 : 0.36,
        delay: reduced ? 0 : column * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
