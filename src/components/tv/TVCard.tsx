'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { useReducedMotionSetting } from '@/lib/motion';

import FilmPoster from '@/components/poster/FilmPoster';

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
      <FilmPoster
        src={item.poster}
        title={item.title}
        alt={item.title}
        className='tm-tv-card-poster'
      >
        <span className='tm-tv-card-rating-slot'>
          {item.rate && <span className='tm-tv-card-rating'>{item.rate}</span>}
        </span>
      </FilmPoster>
      <h3 className='tm-tv-card-title'>{item.title}</h3>
      <p className='tm-tv-card-meta'>{item.year || ''}</p>
    </motion.button>
  );
}
