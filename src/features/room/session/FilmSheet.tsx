'use client';

/*
 * 人在房间里时，在站内任何地方点开一部影片，先问一句怎么看：
 * 加入房间片单 / 现在在房间里放 / 我自己看（房间画面先停，人还在房间里）。
 * 片子没带片源（只有片名）时，去房间里选片源。
 */

import { Clapperboard, ListPlus, Loader2, MonitorPlay, X } from 'lucide-react';
import { useState } from 'react';

import './FilmSheet.css';

import ModalLayer from '@/components/feedback/ModalLayer';

import type { FilmRef } from '../lib/commands';

export interface FilmChoice {
  href: string;
  film: FilmRef | null;
  title: string;
}

export default function FilmSheet(props: {
  choice: FilmChoice;
  roomName: string;
  canQueue: boolean;
  canPlay: boolean;
  onQueue(): Promise<unknown>;
  onPlay(): Promise<unknown>;
  onPick(): void;
  onSolo(): void;
  onClose(): void;
}) {
  const [busy, setBusy] = useState<'' | 'queue' | 'play'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const run = async (kind: 'queue' | 'play', task: () => Promise<unknown>) => {
    setBusy(kind);
    setError('');
    try {
      await task();
      if (kind === 'queue') {
        setDone(true);
        window.setTimeout(props.onClose, 900);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '没有完成，请重试');
    } finally {
      setBusy('');
    }
  };

  const hasSource = !!props.choice.film;
  return (
    <ModalLayer
      label={`怎么看《${props.choice.title}》`}
      onClose={props.onClose}
      className='tm-room-dialog-layer'
    >
      <div className='tm-room-dialog tm-room-sheet'>
        <header className='tm-room-dialog-head'>
          <div>
            <h2>{props.choice.title}</h2>
            <p className='tm-room-sheet-sub'>你正在「{props.roomName}」里</p>
          </div>
          <button
            type='button'
            className='tm-room-icon'
            onClick={props.onClose}
            aria-label='关闭'
          >
            <X size={20} />
          </button>
        </header>
        <div className='tm-room-sheet-actions'>
          {hasSource && props.canQueue && (
            <button
              type='button'
              className='tm-room-sheet-choice'
              disabled={!!busy || done}
              onClick={() => void run('queue', props.onQueue)}
            >
              {busy === 'queue' ? (
                <Loader2 size={22} className='tm-room-spin' />
              ) : (
                <ListPlus size={22} />
              )}
              <span>
                <strong>{done ? '已加入片单' : '加入房间片单'}</strong>
                <small>排在片单最后，大家一起排着看</small>
              </span>
            </button>
          )}
          {hasSource && props.canPlay && (
            <button
              type='button'
              className='tm-room-sheet-choice'
              disabled={!!busy || done}
              onClick={() => void run('play', props.onPlay)}
            >
              {busy === 'play' ? (
                <Loader2 size={22} className='tm-room-spin' />
              ) : (
                <Clapperboard size={22} />
              )}
              <span>
                <strong>现在在房间里放</strong>
                <small>房间里的人会同时切到这部</small>
              </span>
            </button>
          )}
          {!hasSource && (props.canQueue || props.canPlay) && (
            <button
              type='button'
              className='tm-room-sheet-choice'
              onClick={props.onPick}
            >
              <ListPlus size={22} />
              <span>
                <strong>在房间里选片源</strong>
                <small>找到能播的片源，再放或加入片单</small>
              </span>
            </button>
          )}
          <button
            type='button'
            className='tm-room-sheet-choice'
            disabled={!!busy}
            onClick={props.onSolo}
          >
            <MonitorPlay size={22} />
            <span>
              <strong>我自己看</strong>
              <small>房间画面先停下，人还在房间里</small>
            </span>
          </button>
        </div>
        {error && (
          <p className='tm-room-error tm-room-sheet-error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </ModalLayer>
  );
}
