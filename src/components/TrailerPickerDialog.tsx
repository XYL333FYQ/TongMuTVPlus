'use client';

import {
  ExternalLink,
  Film,
  Loader2,
  PlayCircle,
  X,
  Youtube,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { TMDBVideoItem } from '@/lib/tmdb.client';

interface TrailerPickerDialogProps {
  isOpen: boolean;
  title: string;
  videos: TMDBVideoItem[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRetry?: () => void;
  onSelect: (video: TMDBVideoItem) => void;
}

export default function TrailerPickerDialog({
  isOpen,
  title,
  videos,
  loading = false,
  error = null,
  onClose,
  onRetry,
  onSelect,
}: TrailerPickerDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const sortedVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      const aOfficial = a.official ? 1 : 0;
      const bOfficial = b.official ? 1 : 0;
      if (aOfficial !== bOfficial) return bOfficial - aOfficial;
      const aTrailer = a.type === 'Trailer' ? 1 : 0;
      const bTrailer = b.type === 'Trailer' ? 1 : 0;
      if (aTrailer !== bTrailer) return bTrailer - aTrailer;
      return (b.published_at || '').localeCompare(a.published_at || '');
    });
  }, [videos]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className='fixed inset-0 z-[10000] flex items-end sm:items-center justify-center'>
      <div
        className='absolute inset-0 bg-ink/60 backdrop-blur-sm'
        onClick={onClose}
      />
      <div className='relative w-full sm:max-w-2xl max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-surface shadow-2xl border border-line'>
        <div className='flex items-start justify-between gap-4 border-b border-line px-4 sm:px-6 py-4'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 text-muted text-sm mb-1'>
              <Film size={16} />
              选择预告片
            </div>
            <h3 className='text-lg font-medium text-fg truncate'>{title}</h3>
          </div>
          <button
            onClick={onClose}
            className='rounded-full p-2 text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
            aria-label='关闭'
          >
            <X size={20} />
          </button>
        </div>

        <div className='max-h-[calc(85vh-72px)] overflow-y-auto p-4 sm:p-6'>
          {loading ? (
            <div className='space-y-3'>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className='flex items-center gap-4 rounded-xl border border-line bg-raised px-4 py-4 tm-skeleton'
                >
                  <div className='h-11 w-11 rounded-full bg-raised' />
                  <div className='flex-1 space-y-2'>
                    <div className='h-4 w-2/3 rounded bg-raised' />
                    <div className='h-3 w-1/3 rounded bg-raised' />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className='rounded-xl border border-danger bg-raised p-4 text-sm text-fg'>
              <div className='mb-3 font-medium'>{error}</div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className='inline-flex items-center gap-2 rounded-lg bg-fg px-4 py-2 text-inverse transition-colors hover:opacity-90 min-h-[44px] tm-press'
                >
                  <Loader2 size={16} className='animate-spin' />
                  重试
                </button>
              )}
            </div>
          ) : sortedVideos.length === 0 ? (
            <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-raised px-6 py-12 text-center'>
              <Youtube className='mb-3 h-12 w-12 text-muted' />
              <h4 className='text-base font-medium text-fg'>未找到预告片</h4>
              <p className='mt-2 text-sm text-muted'>
                该影片在 TMDB 中没有可用的 YouTube 视频。
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {sortedVideos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => onSelect(video)}
                  className='group w-full rounded-xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-line hover:shadow-lg hover:shadow-ink/5 min-h-[44px] tm-press'
                >
                  <div className='flex items-start gap-4'>
                    <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-fg'>
                      <PlayCircle size={22} />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h4 className='truncate text-sm font-medium text-fg'>
                          {video.name}
                        </h4>
                        {video.official && (
                          <span className='rounded-full bg-raised px-2 py-0.5 text-[13px] font-medium text-fg'>
                            官方
                          </span>
                        )}
                        {video.type && (
                          <span className='rounded-full bg-raised px-2 py-0.5 text-[13px] font-medium text-muted'>
                            {video.type}
                          </span>
                        )}
                      </div>
                      <p className='mt-1 text-[13px] text-muted'>
                        {video.site} · {video.published_at || '发布时间未知'}
                      </p>
                    </div>
                    <ExternalLink
                      size={16}
                      className='mt-1 shrink-0 text-muted transition-colors group-hover:text-fg'
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
