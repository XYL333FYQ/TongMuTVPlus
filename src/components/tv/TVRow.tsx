'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import TVCard from './TVCard';
import { TVSection } from './types';

export default function TVRow({ section }: { section: TVSection }) {
  return (
    <section className='tm-tv-section'>
      <div className='tm-tv-section-heading'>
        <div>
          <h2 className='tm-tv-section-title'>{section.title}</h2>
          {section.subtitle && (
            <p className='tm-tv-section-subtitle'>{section.subtitle}</p>
          )}
        </div>
        {section.href && (
          <Link
            href={section.href}
            className='tm-tv-view-all tv-focusable tm-press'
          >
            查看全部 <ChevronRight className='hidden' aria-hidden='true' />
          </Link>
        )}
      </div>
      <div data-tv-focus-row='horizontal' className='tm-tv-row'>
        {section.items.map((item, index) => (
          <TVCard
            key={`${section.title}-${item.id}`}
            item={item}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
