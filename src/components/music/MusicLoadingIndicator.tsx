import { cn } from '@/lib/cn';

import { MUSIC_MUTED } from './tokens';

/** Shared monochrome music loading indicator. */
export default function MusicLoadingIndicator({
  text,
  size = 'md',
  className = '',
}: {
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-[13px]' : 'text-[13px]';

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3',
        MUSIC_MUTED,
        className
      )}
    >
      <div className='flex items-end gap-1.5'>
        {[0, 1, 2].map((index) => (
          <svg
            key={index}
            className={cn(iconSize, 'text-[color:var(--tm-text)]')}
            fill='currentColor'
            viewBox='0 0 24 24'
            style={{
              animation: `music-note-bounce 0.9s ease-in-out ${
                index * 0.14
              }s infinite`,
            }}
          >
            <path d='M12 3v11.55A3.98 3.98 0 0010 14c-2.21 0-4 1.34-4 3s1.79 3 4 3 4-1.34 4-3V8h4V3h-6z' />
          </svg>
        ))}
      </div>
      {text ? (
        <span className={cn(textSize, 'font-medium tracking-wide')}>
          {text}
        </span>
      ) : null}
    </div>
  );
}
