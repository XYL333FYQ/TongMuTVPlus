'use client';
import { Heart, Play, Users } from 'lucide-react';
import type { MouseEventHandler } from 'react';

export interface DetailActionProps {
  onPlay?: () => void;
  onTogether?: () => void;
  onFavorite?: MouseEventHandler<HTMLButtonElement>;
  favorited?: boolean;
}
export default function DetailActions({
  onPlay,
  onTogether,
  onFavorite,
  favorited,
}: DetailActionProps) {
  if (!onPlay && !onTogether && !onFavorite) return null;
  return (
    <div className='tm-detail-actions'>
      {onPlay && (
        <button
          type='button'
          className='tm-detail-primary tm-press'
          onClick={onPlay}
        >
          <Play size={18} fill='currentColor' />
          播放
        </button>
      )}
      {onTogether && (
        <button
          type='button'
          className='tm-detail-secondary tm-glass tm-press'
          onClick={onTogether}
        >
          <Users size={18} />
          一起看
        </button>
      )}
      {onFavorite && (
        <button
          type='button'
          className='tm-detail-favorite tm-detail-icon tm-press'
          aria-label={favorited ? '取消收藏' : '收藏'}
          aria-pressed={favorited}
          onClick={onFavorite}
        >
          <Heart size={20} fill={favorited ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
}
