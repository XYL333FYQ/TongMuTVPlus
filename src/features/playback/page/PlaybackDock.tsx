'use client';

import {
  Ellipsis,
  FileText,
  ListVideo,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';

import type { PlaybackPanel } from './types';

interface PlaybackDockProps {
  sheetOpen: boolean;
  onOpen: (sheet: PlaybackPanel | 'tools') => void;
  onClose: () => void;
  /** 选集按钮下面的小字 */
  episodeHint: string;
  sourceName: string;
  danmakuCount: number;
  showTools: boolean;
  /** 详情按钮下面的小字；null 表示没有详情 */
  detailHint: string | null;
  onDetail: () => void;
}

/** 手机 / 平板：底部操作坞，点开是半屏面板，画面一直在上面 */
export default function PlaybackDock({
  sheetOpen,
  onOpen,
  onClose,
  episodeHint,
  sourceName,
  danmakuCount,
  showTools,
  detailHint,
  onDetail,
}: PlaybackDockProps) {
  return (
    <>
      <button
        type='button'
        className='tm-solo-sheet-backdrop'
        data-open={sheetOpen ? 'true' : undefined}
        tabIndex={-1}
        aria-hidden='true'
        onClick={onClose}
      />
      <nav className='tm-solo-dock' aria-label='播放工具'>
        <button type='button' onClick={() => onOpen('episodes')}>
          <ListVideo className='h-5 w-5' aria-hidden='true' />
          <span>选集</span>
          <em>{episodeHint}</em>
        </button>
        <button type='button' onClick={() => onOpen('sources')}>
          <RefreshCw className='h-5 w-5' aria-hidden='true' />
          <span>换源</span>
          <em>{sourceName}</em>
        </button>
        <button type='button' onClick={() => onOpen('danmaku')}>
          <MessageSquareText className='h-5 w-5' aria-hidden='true' />
          <span>弹幕</span>
          <em>
            {danmakuCount > 0
              ? `${danmakuCount.toLocaleString()} 条`
              : '未加载'}
          </em>
        </button>
        {showTools && (
          <button type='button' onClick={() => onOpen('tools')}>
            <Ellipsis className='h-5 w-5' aria-hidden='true' />
            <span>工具</span>
            <em>下载等</em>
          </button>
        )}
        {detailHint !== null && (
          <button type='button' onClick={onDetail}>
            <FileText className='h-5 w-5' aria-hidden='true' />
            <span>详情</span>
            <em>{detailHint}</em>
          </button>
        )}
      </nav>
    </>
  );
}
