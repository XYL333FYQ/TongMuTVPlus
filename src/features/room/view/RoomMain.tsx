'use client';

/*
 * 房间页的几块画面：顶部房间栏、画面和正在放映、侧栏（聊天 / 片单 / 成员 / 活动）、各种面板和对话框。状态都在 useRoomViewModel。
 */

import { Clapperboard, ListVideo, MonitorUp, Plus, Users } from 'lucide-react';

import BusyDots from '@/components/feedback/BusyDots';
import FilmPoster from '@/components/poster/FilmPoster';

import Recommendations from './Recommendations';
import { ActivityLaunchers, activityOf, ActivityStage } from './RoomActivities';
import type { RoomViewModel } from './useRoomViewModel';
import { filmFromState } from '../lib/commands';
import { episodeLabel } from '../lib/room-presentation';

/** 画面、正在放映、选集、今晚看什么 */
export function RoomMain({ vm }: { vm: RoomViewModel }) {
  const {
    current,
    session,
    can,
    layout,
    compact,
    setPanel,
    busy,
    error,
    player,
    state,
    waiting,
    requests,
    act,
    playFilm,
    detail,
    total,
    poster,
    canPick,
    statusLabel,
    openPicker,
  } = vm;
  return (
    <div className='tm-room-view-main'>
      <div className='tm-room-view-stage'>
        <div
          ref={session.attachStage}
          className='tm-room-view-stage-slot'
          data-hidden={state ? undefined : 'true'}
        />
        <ActivityStage room={current} />
        {!state && !activityOf(current) && (
          <div className='tm-room-stage-empty'>
            <span className='tm-room-stage-icon'>
              <Clapperboard size={30} aria-hidden='true' />
            </span>
            <strong>还没开始放映</strong>
            {!can('changeMedia') && <span>房主选片后会自动开始</span>}
            {can('changeMedia') && (
              <button
                type='button'
                className='tm-room-btn tm-room-btn-on-art'
                onClick={() => openPicker()}
              >
                <ListVideo size={18} />
                选片
              </button>
            )}
          </div>
        )}
        {state && player.loading && !player.error && (
          <div className='tm-room-view-stage-status'>
            <BusyDots size={28} />
            正在准备画面…
          </div>
        )}
        {state && player.error && (
          <div className='tm-room-view-stage-status' role='alert'>
            <strong>{player.error}</strong>
            {can('changeMedia') && (
              <button
                type='button'
                className='tm-room-btn tm-room-btn-on-art'
                onClick={() => openPicker()}
              >
                换一部
              </button>
            )}
          </div>
        )}
      </div>

      {layout === 'desktop' && (
        <div className='tm-room-view-tools'>
          <button
            type='button'
            className='tm-room-pill tm-room-view-badge'
            onClick={() => setPanel('playlist')}
          >
            <ListVideo size={16} aria-hidden='true' />
            片单
            {waiting > 0 && <span className='tm-room-view-num'>{waiting}</span>}
          </button>
          <button
            type='button'
            className='tm-room-pill tm-room-view-badge'
            onClick={() => setPanel('members')}
          >
            <Users size={16} aria-hidden='true' />
            成员
            {requests > 0 && (
              <span className='tm-room-view-num' data-alert='true'>
                {requests}
              </span>
            )}
          </button>
          {can('changeMedia') && <ActivityLaunchers />}
        </div>
      )}

      {/* 电脑上正在放映和选集是同一张卡；手机平板上这层不占位 */}
      <div className='tm-room-view-nowcard'>
        <section className='tm-room-view-now' aria-label='正在放映'>
          <FilmPoster
            src={poster}
            title={state?.videoName || detail?.title}
            eager
            className='tm-room-view-now-poster'
          />
          <div className='tm-room-view-now-text'>
            <span
              className='tm-room-view-now-label'
              data-state={
                state ? (state.isPlaying ? 'playing' : 'paused') : 'idle'
              }
            >
              {statusLabel}
            </span>
            <h2>
              {state ? state.videoName || detail?.title : '没有在放的影片'}
              {state && total > 1 && (
                <span className='tm-room-view-now-episode'>
                  {' '}
                  · 第 {player.episodeIndex + 1} 集
                </span>
              )}
            </h2>
            <span className='tm-room-view-now-meta'>
              {state
                ? [
                    total > 1
                      ? detail?.episodes_titles?.[player.episodeIndex] ||
                        `第 ${player.episodeIndex + 1} 集`
                      : '',
                    detail?.source_name,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : can('changeMedia')
                ? '选一部开始放映'
                : '房主选片后自动开始'}
            </span>
          </div>
          <div className='tm-room-view-now-actions'>
            {compact && (
              <>
                <button
                  type='button'
                  className='tm-room-icon tm-room-view-badge'
                  onClick={() => setPanel('playlist')}
                  aria-label={`片单和选集${
                    waiting ? `，待看 ${waiting} 部` : ''
                  }`}
                  title='片单和选集'
                >
                  <ListVideo size={19} />
                  {waiting > 0 && (
                    <span className='tm-room-view-num'>{waiting}</span>
                  )}
                </button>
                <button
                  type='button'
                  className='tm-room-icon tm-room-view-badge'
                  onClick={() => setPanel('members')}
                  aria-label={`成员${
                    requests ? `，${requests} 人申请加入` : ''
                  }`}
                  title='成员'
                >
                  <Users size={19} />
                  {requests > 0 && (
                    <span className='tm-room-view-num' data-alert='true'>
                      {requests}
                    </span>
                  )}
                </button>
                {/* 所有人都能打开：看正在进行的活动；没有权限的人在面板里看到原因 */}
                <button
                  type='button'
                  className='tm-room-icon'
                  onClick={() => setPanel('activities')}
                  aria-label='房间活动：共享屏幕、一起听、电视直播'
                  title='房间活动'
                >
                  <MonitorUp size={19} />
                </button>
              </>
            )}
            {canPick && (
              <button
                type='button'
                className='tm-room-btn tm-room-btn-primary'
                onClick={() => openPicker()}
              >
                <Plus size={16} />
                {can('changeMedia') ? '选片' : '加入片单'}
              </button>
            )}
          </div>
        </section>

        {state && total > 1 && (
          <nav className='tm-room-view-strip' aria-label='选集'>
            {Array.from({ length: total }, (_, index) => (
              <button
                key={index}
                type='button'
                className='tm-room-view-ep'
                aria-current={
                  index === player.episodeIndex ? 'true' : undefined
                }
                disabled={!can('changeMedia') || busy}
                onClick={() =>
                  void act(() =>
                    playFilm(filmFromState(state), index + 1, state.queueItemId)
                  )
                }
                title={detail?.episodes_titles?.[index] || `第 ${index + 1} 集`}
              >
                <span className='tm-room-view-ep-no'>
                  {episodeLabel(detail?.episodes_titles?.[index], index)}
                </span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {canPick &&
        (layout !== 'desktop' ? (
          <Recommendations
            variant='strip'
            onChoose={(title) => openPicker(title)}
            onMore={() => setPanel('recs')}
          />
        ) : (
          <Recommendations onChoose={(title) => openPicker(title)} />
        ))}

      {error && (
        <p className='tm-room-error' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
}
