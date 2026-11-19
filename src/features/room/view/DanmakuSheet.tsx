'use client';

/*
 * 房间里的弹幕面板，两种弹幕分开管：
 * 弹幕源：弹幕库里其他观众的弹幕，只在自己这台设备上显示，可以换源、上传；
 * 房间弹幕：房间聊天飘成弹幕（带名字），可以关掉，也可以不显示自己发的。
 */

import './DanmakuSheet.css';
import { useEffect, useState } from 'react';

import DanmakuPanel from '@/components/DanmakuPanel';

import type { ChatDanmaku } from '../player/core/plugins/chat-danmaku';
import type { DanmakuController } from '../player/core/plugins/danmaku';

function Switch(props: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange(on: boolean): void;
}) {
  return (
    <label className='tm-room-switch-row' htmlFor={props.id}>
      <span>
        <span className='tm-room-switch-label'>{props.label}</span>
        {props.hint && <small>{props.hint}</small>}
      </span>
      <input
        id={props.id}
        type='checkbox'
        role='switch'
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

export default function DanmakuSheet(props: {
  controller: DanmakuController;
  chat: ChatDanmaku;
  title: string;
  episodeIndex: number;
  roomDanmaku: boolean;
  onRoomDanmaku(on: boolean): void;
}) {
  const { controller, chat } = props;
  const [state, setState] = useState(controller.state);
  const [sourceOn, setSourceOn] = useState(() => !controller.plugin?.isHide);
  const [showSelf, setShowSelf] = useState(chat.showSelf);

  useEffect(() => {
    setState(controller.state);
    const off = controller.subscribe(setState);
    return () => {
      off();
    };
  }, [controller]);

  const toggleSource = (on: boolean) => {
    const plugin = controller.plugin;
    if (!plugin) return;
    if (on) plugin.show();
    else plugin.hide();
    setSourceOn(on);
  };

  return (
    <div className='tm-room-danmaku'>
      <section className='tm-room-danmaku-section'>
        <h3>弹幕源</h3>
        <p className='tm-room-hint'>
          弹幕库里其他观众的弹幕，白字，只在你这台设备上显示。
        </p>
        <Switch
          id='tm-room-danmaku-source'
          label='显示弹幕源'
          checked={sourceOn}
          onChange={toggleSource}
        />
        <p className='tm-room-danmaku-current'>
          {state.loading
            ? '正在加载弹幕…'
            : state.selection
            ? `当前：${state.selection.animeTitle}${
                state.selection.episodeTitle
                  ? ` · ${state.selection.episodeTitle}`
                  : ''
              } · ${state.count.toLocaleString()} 条${
                state.originalCount
                  ? `（原始 ${state.originalCount.toLocaleString()}）`
                  : ''
              }`
            : '还没有加载弹幕源，可以在下面搜索'}
        </p>
        <div className='tm-room-danmaku-search'>
          <DanmakuPanel
            videoTitle={props.title}
            currentEpisodeIndex={props.episodeIndex}
            currentSelection={state.selection}
            onDanmakuSelect={(selection) =>
              void controller.select(selection, true)
            }
            onUploadDanmaku={(comments) => void controller.upload(comments)}
          />
        </div>
      </section>
      <section className='tm-room-danmaku-section'>
        <h3>房间弹幕</h3>
        <p className='tm-room-hint'>
          房间里的聊天飘成弹幕，带名字和描边。全屏时控制条里也能直接发。
        </p>
        <Switch
          id='tm-room-danmaku-room'
          label='聊天消息飘成弹幕'
          checked={props.roomDanmaku}
          onChange={props.onRoomDanmaku}
        />
        <Switch
          id='tm-room-danmaku-self'
          label='显示我自己发的'
          checked={showSelf}
          onChange={(on) => {
            chat.setShowSelf(on);
            setShowSelf(on);
          }}
        />
      </section>
    </div>
  );
}
