'use client';

/*
 * 片单面板（2026-11-18 设计稿）：一屏看清三件事。
 *   正在放映：海报、片名、第几集 / 共几集、片源，选集格子，结束放映；
 *   接下来：每部带海报和“谁加的”，行尾只有“现在放”和“更多”（上移 / 下移 / 移除）；
 *   放过的：默认收起，点开可以再放一次、清除。
 * 手机竖屏上“正在放映”压成一行，选集点开再看。
 */

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Film,
  ListPlus,
  MoreHorizontal,
  Play,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import type { SearchResult } from '@/lib/types';
import { useDeviceTier } from '@/hooks/useDeviceTier';

import { episodeLabel } from '../lib/room-presentation';

import type { RoomQueueItem } from '@/types/watch-room';

function Poster({ src, size }: { src?: string; size: 'sm' | 'lg' }) {
  return (
    <span className='tm-pl-poster' data-size={size}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt='' loading='lazy' referrerPolicy='no-referrer' />
      ) : (
        <Film size={size === 'lg' ? 22 : 16} aria-hidden='true' />
      )}
    </span>
  );
}

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
  const phone = useDeviceTier() === 'phone';
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [playedOpen, setPlayedOpen] = useState(false);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const detail = props.detail;
  const total = detail?.episodes?.length || 0;
  const waiting = props.queue.filter((item) => !item.playedAt);
  const played = props.queue.filter((item) => item.playedAt);
  const showEpisodes = total > 1 && (!phone || episodesOpen);

  return (
    <div className='tm-pl'>
      {props.playing && detail && (
        <section className='tm-pl-now' aria-label='正在放映'>
          <div className='tm-pl-now-main'>
            <Poster src={detail.poster} size={phone ? 'sm' : 'lg'} />
            <div className='tm-pl-now-text'>
              <span className='tm-pl-label'>正在放映</span>
              <strong>{detail.title}</strong>
              <small>
                {total > 1
                  ? `第 ${props.episodeIndex + 1} 集 / 共 ${total} 集 · `
                  : ''}
                {detail.source_name}
              </small>
            </div>
            {phone && props.canChangeMedia && (
              <button
                type='button'
                className='tm-pl-icon'
                onClick={props.onStop}
                aria-label='结束放映'
                title='结束放映'
              >
                <Square size={16} aria-hidden='true' />
              </button>
            )}
          </div>
          {phone && total > 1 && (
            <button
              type='button'
              className='tm-pl-toggle'
              aria-expanded={episodesOpen}
              onClick={() => setEpisodesOpen((open) => !open)}
            >
              <span>选集 · 第 {props.episodeIndex + 1} 集</span>
              <ChevronRight size={16} aria-hidden='true' />
            </button>
          )}
          {showEpisodes && (
            <div className='tm-pl-episodes'>
              {Array.from({ length: total }, (_, index) => (
                <button
                  key={index}
                  type='button'
                  aria-current={
                    index === props.episodeIndex ? 'true' : undefined
                  }
                  disabled={!props.canChangeMedia}
                  onClick={() => props.onEpisode(index)}
                  title={
                    detail.episodes_titles?.[index] || `第 ${index + 1} 集`
                  }
                >
                  {episodeLabel(detail.episodes_titles?.[index], index)}
                </button>
              ))}
            </div>
          )}
          {!props.canChangeMedia && total > 1 && showEpisodes && (
            <p className='tm-pl-hint'>房主没有开放成员换集</p>
          )}
          {!phone && props.canChangeMedia && (
            <button
              type='button'
              className='tm-pl-secondary'
              onClick={props.onStop}
            >
              <Square size={14} aria-hidden='true' />
              结束放映
            </button>
          )}
        </section>
      )}

      <section className='tm-pl-section' aria-label='接下来'>
        <div className='tm-pl-head'>
          <h3>
            接下来
            {waiting.length > 0 && <span> · {waiting.length}</span>}
          </h3>
          {props.canAdd && waiting.length > 0 && (
            <button type='button' className='tm-pl-add' onClick={props.onAdd}>
              <Plus size={14} aria-hidden='true' />
              添加
            </button>
          )}
        </div>

        {!waiting.length ? (
          <div className='tm-pl-empty'>
            <span className='tm-pl-empty-icon' aria-hidden='true'>
              <ListPlus size={24} />
            </span>
            <strong>片单是空的</strong>
            <span>加几部进来，放完一部自动放下一部。</span>
            {props.canAdd && (
              <button
                type='button'
                className='tm-pl-add'
                data-size='lg'
                onClick={props.onAdd}
              >
                <Plus size={16} aria-hidden='true' />
                添加影片
              </button>
            )}
          </div>
        ) : (
          <ol className='tm-pl-list'>
            {waiting.map((item, index) => {
              const mine = item.addedBy === props.self;
              const canRemove = props.canManage || mine;
              const hasMore =
                (props.canManage && waiting.length > 1) || canRemove;
              const open = moreFor === item.id;
              return (
                <li key={item.id} className='tm-pl-item'>
                  <div className='tm-pl-row'>
                    <Poster src={item.poster} size='sm' />
                    <span className='tm-pl-text'>
                      <strong>{item.title}</strong>
                      <small>
                        {item.episode && item.episode > 1
                          ? `第 ${item.episode} 集 · `
                          : ''}
                        {mine ? '我加的' : `${item.addedBy} 加的`}
                      </small>
                    </span>
                    {props.canChangeMedia && (
                      <button
                        type='button'
                        className='tm-pl-icon'
                        onClick={() => props.onPlayItem(item)}
                        aria-label={`现在放《${item.title}》`}
                        title='现在放'
                      >
                        <Play size={18} aria-hidden='true' />
                      </button>
                    )}
                    {hasMore && (
                      <button
                        type='button'
                        className='tm-pl-icon'
                        aria-expanded={open}
                        onClick={() => setMoreFor(open ? null : item.id)}
                        aria-label={`更多操作：《${item.title}》`}
                        title='更多'
                      >
                        <MoreHorizontal size={18} aria-hidden='true' />
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className='tm-pl-more'>
                      {props.canManage && (
                        <button
                          type='button'
                          disabled={index === 0}
                          onClick={() => props.onMove(item, index - 1)}
                        >
                          <ArrowUp size={15} aria-hidden='true' />
                          上移
                        </button>
                      )}
                      {props.canManage && (
                        <button
                          type='button'
                          disabled={index === waiting.length - 1}
                          onClick={() => props.onMove(item, index + 1)}
                        >
                          <ArrowDown size={15} aria-hidden='true' />
                          下移
                        </button>
                      )}
                      {canRemove && (
                        <button
                          type='button'
                          onClick={() => {
                            setMoreFor(null);
                            props.onRemove(item);
                          }}
                        >
                          <Trash2 size={15} aria-hidden='true' />
                          移除
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {played.length > 0 && (
        <section className='tm-pl-section' aria-label='放过的'>
          <button
            type='button'
            className='tm-pl-toggle'
            data-rule='true'
            aria-expanded={playedOpen}
            onClick={() => setPlayedOpen((open) => !open)}
          >
            <span>放过的 · {played.length}</span>
            <ChevronRight size={16} aria-hidden='true' />
          </button>
          {playedOpen && (
            <>
              <ol className='tm-pl-list'>
                {played.map((item) => (
                  <li key={item.id} className='tm-pl-item'>
                    <div className='tm-pl-row' data-played='true'>
                      <span className='tm-pl-text'>
                        <strong>{item.title}</strong>
                      </span>
                      {props.canChangeMedia && (
                        <button
                          type='button'
                          className='tm-pl-icon'
                          onClick={() => props.onPlayItem(item)}
                          aria-label={`再放一次《${item.title}》`}
                          title='再放一次'
                        >
                          <Play size={16} aria-hidden='true' />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {props.canManage && (
                <button
                  type='button'
                  className='tm-pl-secondary'
                  onClick={props.onClearPlayed}
                >
                  清除放过的
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
