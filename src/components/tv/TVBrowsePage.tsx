'use client';

import { PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import './tv-surfaces.css';

import TVLayout from './TVLayout';
import TVRow from './TVRow';
import { TVItem, TVSection } from './types';

const fallbackPosters = [
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=500&q=80',
];

async function loadDouban(
  kind: 'movie' | 'tv',
  tag: string,
  type: TVItem['type']
): Promise<TVItem[]> {
  const res = await fetch(
    `/api/douban?type=${kind}&tag=${encodeURIComponent(tag)}&pageSize=12`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('load failed');
  const data = await res.json();
  return (data.list || []).map((item: TVItem) => ({ ...item, type }));
}

export default function TVBrowsePage({
  title,
  subtitle,
  heroTitle,
  heroSubtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  heroTitle?: string;
  heroSubtitle?: string;
  sections: Array<{
    title: string;
    subtitle?: string;
    kind: 'movie' | 'tv';
    tag: string;
    type: TVItem['type'];
    href?: string;
  }>;
}) {
  const [rows, setRows] = useState<TVSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.allSettled(
      sections.map(async (section) => ({
        title: section.title,
        subtitle: section.subtitle,
        href: section.href,
        items: await loadDouban(section.kind, section.tag, section.type),
      }))
    ).then((results) => {
      if (!alive) return;
      const next = results.reduce<TVSection[]>((acc, result) => {
        if (result.status === 'fulfilled' && result.value.items.length > 0) {
          acc.push(result.value);
        }
        return acc;
      }, []);
      setRows(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [sections]);

  const hero = rows[0]?.items[0];

  return (
    <TVLayout>
      <section className='tm-tv-browse-hero relative overflow-hidden rounded-[24px] border border-[var(--tm-line)] bg-[var(--tm-surface)] p-4 md:p-8'>
        <div className='tm-tv-browse-backdrop absolute inset-0'>
          {hero?.poster ? (
            <img
              src={hero.poster}
              alt=''
              className='h-full w-full object-cover'
            />
          ) : (
            <img
              src={fallbackPosters[0]}
              alt=''
              className='h-full w-full object-cover'
            />
          )}
          <div className='absolute inset-0 bg-[color:color-mix(in_srgb,var(--tm-surface)_80%,transparent)]' />
        </div>
        <div className='relative max-w-4xl py-6 md:py-10'>
          <p className='mb-4 inline-flex rounded-full bg-[var(--tm-surface-raised)] px-4 py-2 text-[13px] font-medium text-[color:var(--tm-text)]'>
            TV 专用大屏模式
          </p>
          <h1 className='font-bold tracking-normal text-[color:var(--tm-text)] text-[28px] md:text-[32px]'>
            {heroTitle || title}
          </h1>
          <p className='mt-5 max-w-3xl text-base leading-[1.7] text-[color:var(--tm-muted)]'>
            {heroSubtitle || subtitle}
          </p>
          <div className='mt-8 inline-flex items-center gap-3 rounded-2xl bg-[var(--tm-surface-raised)] px-5 py-3 text-sm text-[color:var(--tm-muted)]'>
            <PlayCircle className='h-5 w-5 text-[color:var(--tm-text)]' />
            遥控器 OK 键开始浏览
          </div>
        </div>
      </section>

      {loading ? (
        <div
          role='status'
          className='mt-10 flex items-center justify-center gap-4 text-base text-[color:var(--tm-muted)] md:mt-16'
        >
          <span aria-hidden className='tm-skeleton block rounded-md h-6 w-6' />{' '}
          正在加载
        </div>
      ) : (
        rows.map((section) => <TVRow key={section.title} section={section} />)
      )}
    </TVLayout>
  );
}
