'use client';

/*
 * 房间页的几块画面：顶部房间栏、画面和正在放映、侧栏（聊天 / 片单 / 成员 / 活动）、各种面板和对话框。状态都在 useRoomViewModel。
 */

import {
  Check,
  Copy,
  Headphones,
  Link2,
  LogOut,
  MessageSquareText,
  Settings,
  VolumeOff,
} from 'lucide-react';

import DanmakuSheet from './DanmakuSheet';
import FilmPicker from './FilmPicker';
import MembersPanel from './MembersPanel';
import Recommendations from './Recommendations';
import { valuesFromRoom } from './room-form-values';
import { ActivityPanel } from './RoomActivities';
import RoomForm, { Dialog } from './RoomForm';
import type { RoomViewModel } from './useRoomViewModel';
import { queueAdd } from '../lib/commands';
import { displayRoomName, maskedRoomId } from '../lib/room-presentation';

/** 从底部 / 右侧拉起的面板和对话框：片单、成员、活动、推荐、弹幕、更多、选片、邀请、设置 */
export function RoomDialogs({ vm }: { vm: RoomViewModel }) {
  const {
    current,
    onLeave,
    session,
    self,
    can,
    isOwner,
    panel,
    setPanel,
    openPanel,
    picker,
    setPicker,
    settings,
    setSettings,
    invite,
    setInvite,
    copied,
    busy,
    error,
    player,
    voice,
    command,
    state,
    act,
    playFilm,
    inviteUrl,
    copy,
    detail,
    openPicker,
    playlist,
  } = vm;
  return (
    <>
      {panel === 'playlist' && (
        <Dialog title='片单' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>{playlist}</div>
        </Dialog>
      )}
      {panel === 'members' && (
        <Dialog title='成员' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>
            <MembersPanel
              room={current}
              self={self}
              canManage={can('manageMembers')}
              isOwner={isOwner}
              command={command}
            />
          </div>
        </Dialog>
      )}
      {panel === 'activities' && (
        <Dialog title='房间活动' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>
            <ActivityPanel room={current} canStart={can('changeMedia')} />
          </div>
        </Dialog>
      )}
      {panel === 'recs' && (
        <Dialog title='今晚看什么' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel tm-room-view-pad'>
            <Recommendations onChoose={(title) => openPicker(title)} />
          </div>
        </Dialog>
      )}
      {panel === 'danmaku' && (
        <Dialog title='弹幕' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>
            <DanmakuSheet
              controller={player.danmaku}
              chat={player.chat}
              title={state?.videoName || detail?.title || ''}
              episodeIndex={player.episodeIndex}
              roomDanmaku={session.danmakuChat}
              onRoomDanmaku={session.setDanmakuChat}
            />
          </div>
        </Dialog>
      )}
      {panel === 'menu' && (
        <Dialog
          title={displayRoomName(current)}
          onClose={() => setPanel(null)}
          sheet
        >
          <div className='tm-room-view-panel tm-room-view-menu'>
            <button
              type='button'
              onClick={() => {
                setPanel(null);
                setInvite(true);
              }}
            >
              <Link2 size={18} />
              邀请朋友
            </button>
            <button type='button' onClick={() => setPanel('danmaku')}>
              <MessageSquareText size={18} />
              弹幕（弹幕源和房间弹幕）
            </button>
            {can('editRoom') && (
              <button
                type='button'
                onClick={() => {
                  setPanel(null);
                  setSettings(true);
                }}
              >
                <Settings size={18} />
                房间设置
              </button>
            )}
            {voice.available && (
              <button type='button' onClick={voice.toggleSpeaker}>
                {voice.speaker ? (
                  <Headphones size={18} />
                ) : (
                  <VolumeOff size={18} />
                )}
                {voice.speaker ? '关闭语音声音' : '打开语音声音'}
              </button>
            )}
            <button type='button' onClick={() => void copy(current.id, 'menu')}>
              {copied === 'menu' ? <Check size={18} /> : <Copy size={18} />}
              {copied === 'menu' ? '房间号已复制' : '复制房间号'}
            </button>
            <button
              type='button'
              data-danger='true'
              onClick={() => {
                setPanel(null);
                onLeave();
              }}
            >
              <LogOut size={18} />
              退出房间
            </button>
          </div>
        </Dialog>
      )}

      {picker && (
        <FilmPicker
          initialQuery={picker.query}
          canPlay={can('changeMedia')}
          canQueue={can('addMedia')}
          onClose={() => setPicker(null)}
          onPlay={(film) => playFilm(film).then(() => undefined)}
          onQueue={(film) =>
            command('queue:add', queueAdd(film)).then(() =>
              openPanel('playlist')
            )
          }
        />
      )}

      {invite && (
        <Dialog title='邀请朋友' onClose={() => setInvite(false)}>
          <div className='tm-room-form'>
            <p className='tm-room-lead'>
              把链接发给朋友，登录后打开就能进来
              {current.hasPassword ? '（还需要输入密码）' : ''}。
            </p>
            <div className='tm-room-view-copy'>
              <code>{inviteUrl}</code>
              <button
                type='button'
                className='tm-room-btn tm-room-btn-primary'
                onClick={() => void copy(inviteUrl, 'link')}
              >
                {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'link' ? '已复制' : '复制链接'}
              </button>
            </div>
            <div className='tm-room-view-copy'>
              <code>房间号 {maskedRoomId(current.id)}</code>
              <button
                type='button'
                className='tm-room-btn'
                onClick={() => void copy(current.id, 'id')}
              >
                {copied === 'id' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'id' ? '已复制' : '复制房间号'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {settings && (
        <Dialog title='房间设置' onClose={() => setSettings(false)} wide>
          <RoomForm
            mode='edit'
            room={current}
            initial={valuesFromRoom(current)}
            busy={busy}
            error={error}
            onCancel={() => setSettings(false)}
            onCover={(image) => act(() => command('room:cover', { image }))}
            onDelete={
              isOwner
                ? () => {
                    if (
                      window.confirm(
                        '删除后房间、片单和聊天记录都会清空，确定删除吗？'
                      )
                    )
                      void act(async () => {
                        await command('room:delete');
                        setSettings(false);
                        onLeave();
                      });
                  }
                : undefined
            }
            onSubmit={(values) =>
              void act(async () => {
                await command('room:settings', {
                  name: values.name,
                  description: values.description,
                  isPublic: values.isPublic,
                  ...(values.password !== undefined
                    ? { password: values.password }
                    : {}),
                  requireApproval: values.requireApproval,
                  maxMembers: values.maxMembers,
                  chatEnabled: values.chatEnabled,
                  waitForBuffering: values.waitForBuffering,
                  autoPlay: values.autoPlay,
                  memberPermissions: values.memberPermissions,
                });
                setSettings(false);
              })
            }
          />
        </Dialog>
      )}
    </>
  );
}
