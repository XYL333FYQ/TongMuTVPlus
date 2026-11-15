'use client';

/*
 * 房间里的其他活动：共享屏幕、一起听、一起看直播。
 * 它们各有自己的页面（/watch-room/screen、/music、/live），这里负责入口和“正在进行”提示。
 */

import { MonitorUp, Music2, Radio } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { liveActivityHref } from '@/features/together/activities/room-live';

import type {
  LiveState,
  MusicSyncState,
  Room,
  ScreenState,
} from '@/types/watch-room';

export function activityOf(room: Room) {
  const state = room.currentState;
  if (!state || state.type === 'play') return null;
  if (state.type === 'live') {
    const live = state as LiveState;
    return {
      icon: Radio,
      label: '正在一起看直播',
      title: live.channelName || '直播',
      href: liveActivityHref(live),
      action: '去看直播',
    };
  }
  if (state.type === 'music') {
    const music = state as MusicSyncState;
    return {
      icon: Music2,
      label: '正在一起听',
      title:
        [music.song?.name, music.song?.artist].filter(Boolean).join(' - ') ||
        '音乐',
      href: '/watch-room/music',
      action: '去听',
    };
  }
  const screen = state as ScreenState;
  return {
    icon: MonitorUp,
    label:
      screen.status === 'sharing'
        ? `${screen.ownerName || '有人'} 正在共享屏幕`
        : '共享屏幕',
    title: screen.hasAudio ? '画面和声音' : '画面',
    href: '/watch-room/screen',
    action: '去看共享',
  };
}

export function ActivityStage({ room }: { room: Room }) {
  const activity = activityOf(room);
  if (!activity) return null;
  const Icon = activity.icon;
  return (
    <div className='tm-t-stage-empty'>
      <Icon size={36} aria-hidden='true' />
      <span>{activity.label}</span>
      <strong>{activity.title}</strong>
      <Link href={activity.href} className='tm-t-btn tm-t-btn-on-art'>
        {activity.action}
      </Link>
    </div>
  );
}

/** 发起活动：需要“换片”权限 */
export function ActivityLaunchers() {
  const [enabled, setEnabled] = useState({ music: false, live: false });
  useEffect(() => {
    const config = (
      window as unknown as { RUNTIME_CONFIG?: Record<string, unknown> }
    ).RUNTIME_CONFIG;
    setEnabled({
      music: !!config?.MUSIC_ENABLED,
      live: !!config?.LIVE_ENABLED,
    });
  }, []);
  return (
    <div className='tm-t-launchers'>
      <Link href='/watch-room/screen' className='tm-t-pill'>
        <MonitorUp size={16} aria-hidden='true' />
        共享屏幕
      </Link>
      {enabled.music && (
        <Link href='/music' className='tm-t-pill'>
          <Music2 size={16} aria-hidden='true' />
          一起听
        </Link>
      )}
      {enabled.live && (
        <Link href='/live' className='tm-t-pill'>
          <Radio size={16} aria-hidden='true' />
          电视直播
        </Link>
      )}
    </div>
  );
}
