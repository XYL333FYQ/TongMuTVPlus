'use client';

/*
 * 房间页（直播式）：
 * 手机和平板竖屏：顶部房间栏（返回、房间名、在线、麦克风、“更多”）→ 画面 → 正在放映一行
 *   （片单、成员、房间活动、选片）→ 今晚看什么一排片名 → 剩下整块是聊天，输入框在最底下。
 *   片单、成员、活动、完整推荐都从底部拉起面板，画面一直在上面。
 * 电脑：左边大画面 + 正在放映 + 选集条 + 今晚看什么；右边一整列聊天。
 *   片单、成员从右侧滑出。
 * 平板（触屏，横竖都是；2026-11-18 设计稿方案 A）：不要站点顶栏，房间栏 → 画面（按屏幕高度收）
 *   + 正在放映 + 大号选集 + 今晚看什么；侧栏是“聊天 / 片单 / 成员 / 活动”四个标签。
 *   横屏左右两栏，竖屏上下排。
 */

import { CSSProperties } from 'react';

import './RoomView.css';
import './RoomView-room-view-now.css';
import './RoomView-room-view-ep.css';
import './RoomView-room-view-tabs.css';

import { processImageUrl } from '@/lib/utils';

import { RoomDialogs } from './RoomDialogs';
import { RoomHeader } from './RoomHeader';
import { RoomMain } from './RoomMain';
import { RoomSide } from './RoomSide';
import { type RoomViewProps, useRoomViewModel } from './useRoomViewModel';

export default function RoomView(props: RoomViewProps) {
  const vm = useRoomViewModel(props);
  const { layout, poster } = vm;
  return (
    <div
      className='tm-room-view'
      style={
        poster
          ? ({
              '--tm-room-view-ambient': `url("${processImageUrl(poster)}")`,
            } as CSSProperties)
          : undefined
      }
      data-ambient={poster ? 'true' : undefined}
      data-layout={layout}
    >
      <div className='tm-room-view-ambient' aria-hidden='true' />

      <RoomHeader vm={vm} />

      <div className='tm-room-view-body'>
        <RoomMain vm={vm} />

        <RoomSide vm={vm} />
      </div>

      <RoomDialogs vm={vm} />
    </div>
  );
}
