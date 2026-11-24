'use client';

/*
 * 两种小窗（自己看 / 一起看）共用的按钮层：一块画面，按钮叠在上面。
 * 左上放大回去、右上收起或聊天 + 关闭、中间播放暂停、右下声音、左下片名。
 * bar 形态是“收起”后的一条胶囊：片名 + 播放 + 声音 + 放大 + 关闭。
 * 只负责外观和点击，播放实例、拖动和房间逻辑都由调用方提供。
 */

import {
  Maximize2,
  MessageCircle,
  Minus,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import FilmPoster from '@/components/poster/FilmPoster';

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
  /** 画面对应的视频：小窗底边的进度线跟着它走 */
  video?: HTMLVideoElement | null;
}

/** 按钮多久没人碰就收起 */
export const MINI_REVEAL_MS = 3000;

/**
 * 小窗按钮什么时候出现（2026-11-18 设计稿）：平时只有画面；
 * 鼠标移上去、触屏点一下画面、键盘聚焦时出现，3 秒没有操作收起。
 * 拖动小窗不算点：拖动结束后的那次 click 由 useMiniPlayerDrag 吞掉。
 */
function useReveal() {
  const [revealed, setRevealed] = useState(false);
  const timer = useRef(0);
  const pointer = useRef('mouse');
  const hideLater = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRevealed(false), MINI_REVEAL_MS);
  }, []);
  const show = useCallback(() => {
    setRevealed(true);
    hideLater();
  }, [hideLater]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const handlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      pointer.current = event.pointerType;
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType === 'mouse') show();
    },
    onPointerLeave(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType !== 'mouse') return;
      window.clearTimeout(timer.current);
      setRevealed(false);
    },
    onClick(event: MouseEvent<HTMLDivElement>) {
      const onButton = (event.target as HTMLElement).closest(
        '.tm-mini-btn, a, button'
      );
      if (onButton) return hideLater();
      // 触屏点空白处：出 / 收按钮；鼠标点空白处保持出现
      if (pointer.current === 'mouse') return show();
      if (revealed) {
        window.clearTimeout(timer.current);
        setRevealed(false);
      } else show();
    },
    onFocus: show,
    onBlur(event: FocusEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        setRevealed(false);
    },
  };
  return { revealed, handlers };
}

/** 底边 3px 进度线：直接改宽度，不触发重渲染 */
function MiniProgress({ video }: { video?: HTMLVideoElement | null }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!video) return;
    const update = () => {
      const ratio =
        video.duration > 0
          ? Math.min(1, video.currentTime / video.duration)
          : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${ratio})`;
    };
    update();
    video.addEventListener('timeupdate', update);
    video.addEventListener('durationchange', update);
    video.addEventListener('emptied', update);
    return () => {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('durationchange', update);
      video.removeEventListener('emptied', update);
    };
  }, [video]);
  return (
    <span className='tm-mini-progress' aria-hidden='true'>
      <span ref={bar} />
    </span>
  );
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
  video,
  className = '',
  ...rest
}: MiniPlayerControlsProps) {
  const reveal = useReveal();
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
          <FilmPoster
            src={poster}
            title={title}
            ratio='landscape'
            className='tm-mini-thumb'
          />
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
      {...reveal.handlers}
      className={`tm-mini-controls ${className}`}
      data-variant='mini'
      data-revealed={reveal.revealed ? 'true' : undefined}
    >
      <MiniProgress video={video} />
      {!!extra?.badge && extra.kind === 'chat' && (
        <span className='tm-mini-dot' aria-hidden='true' />
      )}
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
