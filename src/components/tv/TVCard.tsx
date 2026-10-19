'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useReducedMotionSetting } from '@/lib/motion';
import { processImageUrl } from '@/lib/utils';

import { TVItem } from './types';

export default function TVCard({
  item,
  index = 0,
}: {
  item: TVItem;
  index?: number;
}) {
  const router = useRouter();
  const reduced = useReducedMotionSetting();
  const poster = item.poster ? processImageUrl(item.poster) : '';
  const playUrl =
    item.href ||
    `/tv/detail?title=${encodeURIComponent(item.title)}${
      item.year ? `&year=${encodeURIComponent(item.year)}` : ''
    }${item.type ? `&stype=${item.type}` : ''}`;

  return (
    <motion.button
      type='button'
      onClick={() => router.push(playUrl)}
      className='tm-tv-card group tv-focusable'
      aria-label={item.title}
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileTap={{
        scale: reduced ? 1 : 0.97,
        transition: { duration: reduced ? 0 : 0.12, delay: 0 },
      }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: reduced ? 0.12 : 0.36,
        delay: reduced ? 0 : Math.min(index, 5) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className='tm-tv-card-poster'>
        {poster ? (
          <img
            src={poster}
            alt={item.title}
            className='tm-tv-card-image'
            ref={(node) => {
              if (node?.complete && node.naturalWidth > 0)
                node.dataset.loaded = 'true';
            }}
            onLoad={(event) => {
              event.currentTarget.dataset.loaded = 'true';
            }}
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center bg-[var(--tm-surface)] text-[color:var(--tm-muted)]'>
            <Play className='h-14 w-14' />
          </div>
        )}
        <div className='tm-tv-card-rating-slot'>
          {item.rate && <span className='tm-tv-card-rating'>{item.rate}</span>}
        </div>
      </div>
      <h3 className='tm-tv-card-title'>{item.title}</h3>
      <p className='tm-tv-card-meta'>{item.year || ''}</p>
    </motion.button>
  );
}
