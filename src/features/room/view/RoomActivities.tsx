'use client';

/*
 * 房间里的其他活动：共享屏幕、一起听、一起看直播。
 * 它们各有自己的页面（/watch-room/screen、/music、/live），这里负责入口和“正在进行”提示。
 */

import { ChevronRight, Lock, MonitorUp, Music2, Radio } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import './RoomActivities.css';

import { liveActivityHref } from '@/features/room/activities/room-live';

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
    <div className='tm-room-stage-empty'>
      <Icon size={36} aria-hidden='true' />
      <span>{activity.label}</span>
      <strong>{activity.title}</strong>
      <Link href={activity.href} className='tm-room-btn tm-room-btn-on-art'>
        {activity.action}
      </Link>
    </div>
  );
}

/** 哪些活动开着（后台配置） */
function useActivityAvailability() {
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
  return enabled;
}

const LAUNCHERS = [
  {
    key: 'screen',
    href: '/watch-room/screen',
    icon: MonitorUp,
    title: '共享屏幕',
    hint: '把整个屏幕或一个窗口给房间里的人看',
  },
  {
    key: 'music',
    href: '/music',
    icon: Music2,
    title: '一起听',
    hint: '同一首歌，同一个进度',
  },
  {
    key: 'live',
    href: '/live',
    icon: Radio,
    title: '电视直播',
    hint: '大家看同一个频道',
  },
] as const;

function useLaunchers() {
  const enabled = useActivityAvailability();
  return LAUNCHERS.filter((item) => item.key === 'screen' || enabled[item.key]);
}

/** 发起活动（电脑房间页画面下面那一排）：需要“换片”权限 */
export function ActivityLaunchers() {
  const launchers = useLaunchers();
  return (
    <div className='tm-room-activity-launchers'>
      {launchers.map((item) => (
        <Link key={item.key} href={item.href} className='tm-room-pill'>
          <item.icon size={16} aria-hidden='true' />
          {item.title}
        </Link>
      ))}
    </div>
  );
}

/**
 * 房间活动面板（2026-11-18 设计稿）：正在进行的活动排最上面（白色卡片），
 * 下面是能发起的活动，每个带一句说明；没有“换片”权限时整组变灰并说明原因。
 */
export function ActivityPanel({
  room,
  canStart,
}: {
  room: Room;
  canStart: boolean;
}) {
  const launchers = useLaunchers();
  const current = activityOf(room);
  const CurrentIcon = current?.icon;
  return (
    <div className='tm-room-activity'>
      {current && CurrentIcon && (
        <section className='tm-room-activity-section' aria-label='正在进行'>
          <span className='tm-room-activity-label'>正在进行</span>
          <div className='tm-room-activity-now'>
            <span className='tm-room-activity-now-icon' aria-hidden='true'>
              <CurrentIcon size={22} />
            </span>
            <span className='tm-room-activity-text'>
              <strong>{current.label}</strong>
              <small>{current.title}</small>
            </span>
            <Link href={current.href} className='tm-room-activity-go'>
              去看
            </Link>
          </div>
        </section>
      )}
      <section className='tm-room-activity-section' aria-label='发起一个'>
        <span className='tm-room-activity-label'>发起一个</span>
        <ul
          className='tm-room-activity-list'
          data-disabled={canStart ? undefined : 'true'}
        >
          {launchers.map((item) => (
            <li key={item.key}>
              {canStart ? (
                <Link href={item.href} className='tm-room-activity-item'>
                  <span
                    className='tm-room-activity-item-icon'
                    aria-hidden='true'
                  >
                    <item.icon size={22} />
                  </span>
                  <span className='tm-room-activity-text'>
                    <strong>{item.title}</strong>
                    <small>{item.hint}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden='true' />
                </Link>
              ) : (
                <span className='tm-room-activity-item' aria-disabled='true'>
                  <span
                    className='tm-room-activity-item-icon'
                    aria-hidden='true'
                  >
                    <item.icon size={22} />
                  </span>
                  <span className='tm-room-activity-text'>
                    <strong>{item.title}</strong>
                    <small>{item.hint}</small>
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
        {canStart ? (
          <p className='tm-room-activity-note'>
            每个活动有自己的页面；发起后房间里所有人在这里都能看到入口。
          </p>
        ) : (
          <p className='tm-room-activity-note'>
            <Lock size={15} aria-hidden='true' />
            房主没有给你发起活动的权限
          </p>
        )}
      </section>
    </div>
  );
}
