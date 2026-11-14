'use client';

/*
 * 小窗：离开播放页后在角落继续播放。
 * 可拖到任意位置（松手吸附最近的角）、收起成胶囊、点画面回到播放页、关闭结束播放。
 */

import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Pause,
  Play,
  SkipForward,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  CSSProperties,
  PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { WatchEngineApi } from '../session/context';

type Corner = 'br' | 'bl' | 'tr' | 'tl';
const CORNER_KEY = 'tm-watch-mini-corner';
const COLLAPSE_KEY = 'tm-watch-mini-collapsed';

function readCorner(): Corner {
  try {
    const value = localStorage.getItem(CORNER_KEY);
    return value === 'bl' || value === 'tr' || value === 'tl' ? value : 'br';
  } catch {
    return 'br';
  }
}

export default function MiniPlayer({
  engine,
  onSlot,
  onClose,
}: {
  engine: WatchEngineApi;
  onSlot(element: HTMLElement | null): void;
  onClose(): void;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement | null>(null);
  const [corner, setCorner] = useState<Corner>('br');
  const [collapsed, setCollapsed] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{
    x: number;
    y: number;
    moved: boolean;
    id: number;
  } | null>(null);

  useEffect(() => {
    setCorner(readCorner());
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true');
    } catch {
      // 忽略
    }
  }, []);

  const { media, playback, player } = engine;
  const detail = media.detail;
  const title = detail?.title || media.params.title || '正在播放';
  const multi = (detail?.episodes?.length || 0) > 1;
  const episode = multi
    ? detail?.episodes_titles?.[media.episodeIndex] ||
      `第 ${media.episodeIndex + 1} 集`
    : '';

  const back = useCallback(() => {
    router.push(currentHref(engine));
  }, [router, engine]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, String(!value));
      } catch {
        // 忽略
      }
      return !value;
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      id: event.pointerId,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!origin.moved && Math.hypot(dx, dy) < 6) return;
    if (!origin.moved) {
      origin.moved = true;
      root.current?.setPointerCapture(event.pointerId);
    }
    setDrag({ x: dx, y: dy });
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    if (!origin.moved) return;
    root.current?.releasePointerCapture(event.pointerId);
    const rect = root.current?.getBoundingClientRect();
    setDrag(null);
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const next: Corner = `${centerY < window.innerHeight / 2 ? 't' : 'b'}${
      centerX < window.innerWidth / 2 ? 'l' : 'r'
    }` as Corner;
    setCorner(next);
    try {
      localStorage.setItem(CORNER_KEY, next);
    } catch {
      // 忽略
    }
  };

  const style = drag
    ? ({
        '--tm-mini-dx': `${drag.x}px`,
        '--tm-mini-dy': `${drag.y}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={root}
      className='tm-mini'
      data-corner={corner}
      data-collapsed={collapsed ? 'true' : undefined}
      data-dragging={drag ? 'true' : undefined}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role='region'
      aria-label='小窗播放'
    >
      <div className='tm-mini-stage'>
        <div ref={onSlot} className='tm-mini-video' />
        {playback.loading && <div className='tm-mini-status'>加载中…</div>}
        {playback.error && (
          <div className='tm-mini-status'>{playback.error}</div>
        )}
        <button
          type='button'
          className='tm-mini-expand'
          onClick={back}
          aria-label='回到播放页'
        >
          <Maximize2 size={18} />
        </button>
      </div>
      <div className='tm-mini-bar'>
        <button type='button' className='tm-mini-title' onClick={back}>
          <span className='tm-mini-name'>{title}</span>
          {episode && <span className='tm-mini-episode'>{episode}</span>}
        </button>
        <button
          type='button'
          className='tm-mini-btn'
          aria-label={playback.playing ? '暂停' : '播放'}
          onClick={() =>
            playback.playing ? player?.pause() : void player?.play()
          }
        >
          {playback.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        {media.hasNext && (
          <button
            type='button'
            className='tm-mini-btn'
            aria-label='下一集'
            onClick={() => media.next()}
          >
            <SkipForward size={18} />
          </button>
        )}
        <button
          type='button'
          className='tm-mini-btn'
          aria-label={collapsed ? '展开小窗' : '收起小窗'}
          onClick={toggleCollapsed}
        >
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button
          type='button'
          className='tm-mini-btn'
          aria-label='关闭'
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

/** 小窗回到播放页的地址：带上当前集 */
function currentHref(engine: WatchEngineApi) {
  const detail = engine.media.detail;
  const params = new URLSearchParams();
  if (detail) {
    params.set('source', detail.source);
    params.set('id', detail.id);
    if (detail.source !== 'directplay') {
      params.set('title', detail.title);
      if (detail.year) params.set('year', detail.year);
    }
  } else {
    const p = engine.media.params;
    if (p.source) params.set('source', p.source);
    if (p.id) params.set('id', p.id);
    if (p.title) params.set('title', p.title);
  }
  if (engine.media.params.searchTitle)
    params.set('stitle', engine.media.params.searchTitle);
  if (engine.media.params.searchType)
    params.set('stype', engine.media.params.searchType);
  params.set('episode', String(engine.media.episodeIndex + 1));
  return `/play?${params.toString()}`;
}
