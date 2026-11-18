'use client';

/*
 * 两种小窗（自己看 / 一起看）共用的按钮层：一块画面，按钮叠在上面。
 * 左上放大回去、右上收起或聊天 + 关闭、中间播放暂停、右下声音、左下片名。
 * bar 形态是“收起”后的一条胶囊：片名 + 播放 + 声音 + 放大 + 关闭。
 * 只负责外观和点击，播放实例、拖动和房间逻辑都由调用方提供。
 */

import {
  Film,
  Maximize2,
  MessageCircle,
  Minus,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';

export interface MiniAction {
  label: string;
  onClick?: () => void;
  /** 有链接时渲染成链接（例如回到房间页） */
  href?: string;
}

export interface MiniPlayerControlsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'mini' | 'bar';
  title: string;
  /** 片名下面的小字（例如“此页静音”），只在胶囊形态显示 */
  hint?: string;
  poster?: string;
  expand: MiniAction;
  /** 点片名做什么；默认和“放大”一样 */
  titleAction?: MiniAction;
  close: MiniAction;
  /** 右上第二个按钮：自己看是“收起”，一起看是“聊天” */
  extra?: MiniAction & { kind: 'fold' | 'chat'; badge?: number };
  /** 没有播放权限时不传，中间不出按钮 */
  play?: {
    paused: boolean;
    disabled?: boolean;
    playLabel: string;
    pauseLabel: string;
    onToggle(): void;
  };
  sound: {
    muted: boolean;
    muteLabel: string;
    unmuteLabel: string;
    onToggle(): void;
  };
}

function ActionButton({
  action,
  slot,
  className = 'tm-mini-btn',
  children,
}: {
  action: MiniAction;
  slot: string;
  className?: string;
  children: ReactNode;
}) {
  if (action.href)
    return (
      <Link
        href={action.href}
        onClick={action.onClick}
        data-mini={slot}
        className={className}
        aria-label={action.label}
        title={action.label}
      >
        {children}
      </Link>
    );
  return (
    <button
      type='button'
      onClick={action.onClick}
      data-mini={slot}
      className={className}
      aria-label={action.label}
      title={action.label}
    >
      {children}
    </button>
  );
}

export default function MiniPlayerControls({
  variant = 'mini',
  title,
  hint,
  poster,
  expand,
  titleAction: titleOverride,
  close,
  extra,
  play,
  sound,
  className = '',
  ...rest
}: MiniPlayerControlsProps) {
  const titleBase = titleOverride || expand;
  const titleAction = { ...titleBase, label: `${titleBase.label}：${title}` };
  const playButton = play && (
    <button
      type='button'
      data-mini='play'
      className='tm-mini-btn'
      onClick={play.onToggle}
      disabled={play.disabled}
      aria-label={play.paused ? play.playLabel : play.pauseLabel}
      title={play.paused ? play.playLabel : play.pauseLabel}
    >
      {play.paused ? (
        <Play size={variant === 'bar' ? 18 : 20} aria-hidden='true' />
      ) : (
        <Pause size={variant === 'bar' ? 18 : 20} aria-hidden='true' />
      )}
    </button>
  );
  const soundButton = (
    <button
      type='button'
      data-mini='mute'
      className='tm-mini-btn'
      onClick={sound.onToggle}
      aria-label={sound.muted ? sound.unmuteLabel : sound.muteLabel}
      title={sound.muted ? sound.unmuteLabel : sound.muteLabel}
    >
      {sound.muted ? (
        <VolumeX size={16} aria-hidden='true' />
      ) : (
        <Volume2 size={16} aria-hidden='true' />
      )}
    </button>
  );
  const extraButton = extra && (
    <ActionButton action={extra} slot={extra.kind}>
      {extra.kind === 'chat' ? (
        <MessageCircle size={16} aria-hidden='true' />
      ) : (
        <Minus size={17} aria-hidden='true' />
      )}
      {!!extra.badge && (
        <b className='tm-mini-badge'>
          {extra.badge > 99 ? '99+' : extra.badge}
        </b>
      )}
    </ActionButton>
  );

  if (variant === 'bar')
    return (
      <div
        {...rest}
        className={`tm-mini-controls ${className}`}
        data-variant='bar'
      >
        <ActionButton
          action={titleAction}
          slot='title'
          className='tm-mini-title'
        >
          <span className='tm-mini-thumb' aria-hidden='true'>
            {poster ? (
              <Image src={poster} alt='' fill sizes='56px' unoptimized />
            ) : (
              <Film size={18} />
            )}
          </span>
          <span className='tm-mini-copy'>
            <strong>{title}</strong>
            {hint && <small>{hint}</small>}
          </span>
        </ActionButton>
        {playButton}
        {soundButton}
        <ActionButton action={expand} slot='full'>
          <Maximize2 size={16} aria-hidden='true' />
        </ActionButton>
        <ActionButton action={close} slot='close'>
          <X size={17} aria-hidden='true' />
        </ActionButton>
      </div>
    );

  return (
    <div
      {...rest}
      className={`tm-mini-controls ${className}`}
      data-variant='mini'
    >
      <ActionButton action={expand} slot='full'>
        <Maximize2 size={16} aria-hidden='true' />
      </ActionButton>
      {extraButton}
      <ActionButton action={close} slot='close'>
        <X size={17} aria-hidden='true' />
      </ActionButton>
      {playButton}
      {soundButton}
      <ActionButton action={titleAction} slot='title' className='tm-mini-btn'>
        <strong>{title}</strong>
      </ActionButton>
    </div>
  );
}
