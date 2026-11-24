'use client';

import {
  Cloud,
  Ellipsis,
  FileText,
  Keyboard,
  ListVideo,
  MessageSquareText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import type { PlaybackDrawer } from './PlaybackDrawers';
import type { PlaybackPanel } from './types';

interface PlaybackRailProps {
  /** 当前展开的面板；null 表示面板收起 */
  activePanel: PlaybackPanel | null;
  onPanel: (panel: PlaybackPanel) => void;
  showTools: boolean;
  toolsOpen: boolean;
  onToggleTools: () => void;
  showDetail: boolean;
  showAiChat: boolean;
  showNetdisk: boolean;
  onDrawer: (drawer: PlaybackDrawer) => void;
  onShortcuts: () => void;
}

/** 电脑：画面右边的细竖栏。选集 / 换源 / 弹幕开合右边的面板，其余打开抽屉 */
export default function PlaybackRail({
  activePanel,
  onPanel,
  showTools,
  toolsOpen,
  onToggleTools,
  showDetail,
  showAiChat,
  showNetdisk,
  onDrawer,
  onShortcuts,
}: PlaybackRailProps) {
  return (
    <nav className='tm-solo-rail' aria-label='播放面板'>
      {(
        [
          ['episodes', '选集', ListVideo],
          ['sources', '换源', RefreshCw],
          ['danmaku', '弹幕', MessageSquareText],
        ] as const
      ).map(([panel, label, Icon]) => (
        <button
          key={panel}
          type='button'
          aria-pressed={activePanel === panel}
          onClick={() => onPanel(panel)}
        >
          <Icon className='tm-prail-icon-1' aria-hidden='true' />
          {label}
        </button>
      ))}
      <span className='tm-solo-rail-sep' aria-hidden='true' />
      {showTools && (
        <button type='button' aria-pressed={toolsOpen} onClick={onToggleTools}>
          <Ellipsis className='tm-prail-icon-1' aria-hidden='true' />
          工具
        </button>
      )}
      {showDetail && (
        <button type='button' onClick={() => onDrawer('detail')}>
          <FileText className='tm-prail-icon-1' aria-hidden='true' />
          详情
        </button>
      )}
      {showAiChat && (
        <button type='button' onClick={() => onDrawer('aiChat')}>
          <Sparkles className='tm-prail-icon-1' aria-hidden='true' />
          AI 问片
        </button>
      )}
      {showNetdisk && (
        <button type='button' onClick={() => onDrawer('pansou')}>
          <Cloud className='tm-prail-icon-1' aria-hidden='true' />
          网盘
        </button>
      )}
      <button type='button' className='tm-solo-rail-end' onClick={onShortcuts}>
        <Keyboard className='tm-prail-icon-1' aria-hidden='true' />
        快捷键
      </button>
    </nav>
  );
}
