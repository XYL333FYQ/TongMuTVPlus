'use client';

/*
 * 片单：当前影片的选集 + 待看片单（谁加的、播过没有，可以调整顺序、移除、开播）。
 */

import {
  ArrowDown,
  ArrowUp,
  Film,
  Play,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';

import type { SearchResult } from '@/lib/types';

import { episodeLabel } from '@/features/watch/panels/EpisodesPanel';

import type { RoomQueueItem } from '@/types/watch-room';

export default function PlaylistPanel(props: {
  detail: SearchResult | null;
  episodeIndex: number;
  playing: boolean;
  queue: RoomQueueItem[];
  self: string;
  canChangeMedia: boolean;
  canAdd: boolean;
  canManage: boolean;
  onEpisode(index: number): void;
  onPlayItem(item: RoomQueueItem): void;
  onRemove(item: RoomQueueItem): void;
  onMove(item: RoomQueueItem, position: number): void;
  onClearPlayed(): void;
  onAdd(): void;
  onStop(): void;
}) {
  const detail = props.detail;
  const total = detail?.episodes?.length || 0;
  const waiting = props.queue.filter((item) => !item.playedAt);
  const played = props.queue.filter((item) => item.playedAt);

  return (
    <div className='tm-t-playlist'>
      {props.playing && detail && (
        <section className='tm-t-block'>
          <div className='tm-t-block-head'>
            <h3>{detail.title}</h3>
            {props.canChangeMedia && (
              <button
                type='button'
                className='tm-t-link'
                onClick={props.onStop}
              >
                <Square size={14} />
                停止放映
              </button>
            )}
          </div>
          {total > 1 && (
            <div className='tm-t-episodes'>
              {Array.from({ length: total }, (_, index) => (
                <button
                  key={index}
                  type='button'
                  className='tm-w-episode'
                  aria-current={
                    index === props.episodeIndex ? 'true' : undefined
                  }
                  disabled={!props.canChangeMedia}
                  onClick={() => props.onEpisode(index)}
                  title={
                    detail.episodes_titles?.[index] || `第 ${index + 1} 集`
                  }
                >
                  <span className='tm-w-episode-no'>
                    {episodeLabel(detail.episodes_titles?.[index], index)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!props.canChangeMedia && total > 1 && (
            <p className='tm-t-hint'>房主没有开放成员换集</p>
          )}
        </section>
      )}

      <section className='tm-t-block'>
        <div className='tm-t-block-head'>
          <h3>待看片单{waiting.length ? ` · ${waiting.length}` : ''}</h3>
          {props.canAdd && (
            <button type='button' className='tm-t-link' onClick={props.onAdd}>
              <Plus size={14} />
              添加
            </button>
          )}
        </div>
        {!waiting.length && (
          <p className='tm-t-empty'>
            片单是空的。{props.canAdd ? '添加几部，大家一起排着看。' : ''}
          </p>
        )}
        <ol className='tm-t-queue'>
          {waiting.map((item, index) => {
            const mine = item.addedBy === props.self;
            return (
              <li key={item.id} className='tm-t-queue-item'>
                <span className='tm-t-queue-poster'>
                  {item.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.poster}
                      alt=''
                      loading='lazy'
                      referrerPolicy='no-referrer'
                    />
                  ) : (
                    <Film size={16} />
                  )}
                </span>
                <span className='tm-t-queue-text'>
                  <strong>{item.title}</strong>
                  <small>
                    {item.episode && item.episode > 1
                      ? `第 ${item.episode} 集 · `
                      : ''}
                    {mine ? '我加的' : `${item.addedBy} 加的`}
                  </small>
                </span>
                <span className='tm-t-queue-actions'>
                  {props.canChangeMedia && (
                    <button
                      type='button'
                      className='tm-t-icon'
                      onClick={() => props.onPlayItem(item)}
                      aria-label={`现在放《${item.title}》`}
                    >
                      <Play size={16} />
                    </button>
                  )}
                  {props.canManage && index > 0 && (
                    <button
                      type='button'
                      className='tm-t-icon'
                      onClick={() => props.onMove(item, index - 1)}
                      aria-label='上移'
                    >
                      <ArrowUp size={16} />
                    </button>
                  )}
                  {props.canManage && index < waiting.length - 1 && (
                    <button
                      type='button'
                      className='tm-t-icon'
                      onClick={() => props.onMove(item, index + 1)}
                      aria-label='下移'
                    >
                      <ArrowDown size={16} />
                    </button>
                  )}
                  {(props.canManage || mine) && (
                    <button
                      type='button'
                      className='tm-t-icon'
                      onClick={() => props.onRemove(item)}
                      aria-label='移除'
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {played.length > 0 && (
        <section className='tm-t-block'>
          <div className='tm-t-block-head'>
            <h3>放过的</h3>
            {props.canManage && (
              <button
                type='button'
                className='tm-t-link'
                onClick={props.onClearPlayed}
              >
                清除
              </button>
            )}
          </div>
          <ol className='tm-t-queue tm-t-queue-played'>
            {played.map((item) => (
              <li key={item.id} className='tm-t-queue-item'>
                <span className='tm-t-queue-text'>
                  <strong>{item.title}</strong>
                </span>
                {props.canChangeMedia && (
                  <button
                    type='button'
                    className='tm-t-icon'
                    onClick={() => props.onPlayItem(item)}
                    aria-label={`再放一次《${item.title}》`}
                  >
                    <Play size={16} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
