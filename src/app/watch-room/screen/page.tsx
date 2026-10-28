'use client';

import { Monitor, MonitorPlay, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MutableRefObject, useCallback, useEffect, useState } from 'react';

import {
  type ScreenShareQualityPreset,
  screenShareQualityOptions,
  useScreenShare,
} from '@/hooks/useScreenShare';

import PageContainer from '@/components/PageContainer';
import Select from '@/components/ui/Select';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';
import { useAudioFocus } from '@/features/playback/useAudioFocus';

const WATCH_ROOM_NO_CONNECT_KEY = 'watch_room_no_connect';
const WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY = 'watch_room_no_connect_timestamp';
const SCREEN_SHARE_QUALITY_KEY = 'watch_room_screen_quality';

function getScreenShareHostSupportError() {
  if (typeof window === 'undefined') return null;

  if (!window.isSecureContext) {
    return '当前环境不是安全上下文（HTTPS/localhost），不支持屏幕共享';
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return '当前浏览器不支持屏幕共享';
  }

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

function getScreenShareViewerSupportError() {
  if (typeof window === 'undefined') return null;

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

export default function WatchRoomScreenPage() {
  const router = useRouter();
  const watchRoom = useWatchRoomContext();
  const { currentRoom, members, leaveRoom } = watchRoom;
  const session = usePlaybackSessionSafe();
  const [qualityPreset, setQualityPreset] =
    useState<ScreenShareQualityPreset>('smooth');
  const {
    currentRoom: screenRoom,
    canShare,
    following,
    isLocalSharing,
    isSharing,
    isStarting,
    error,
    captureSettings,
    localVideoRef,
    remoteVideoRef,
    startSharing,
    stopSharing,
  } = useScreenShare(qualityPreset);
  const screenRoomId = screenRoom?.id;

  // 共享画面自带声音：观众真正播放时，电影等其他播放器让出声音
  const [remoteElement, setRemoteElement] = useState<HTMLVideoElement | null>(
    null
  );
  const attachRemoteVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      (remoteVideoRef as MutableRefObject<HTMLVideoElement | null>).current =
        element;
      setRemoteElement(element);
    },
    [remoteVideoRef]
  );
  const { claimSound } = useAudioFocus(remoteElement, false);
  useEffect(() => {
    if (!remoteElement) return;
    remoteElement.addEventListener('play', claimSound);
    return () => remoteElement.removeEventListener('play', claimSound);
  }, [claimSound, remoteElement]);

  const openDetachedPage = useCallback(() => {
    window.open('/', '_blank', 'noopener,noreferrer');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(SCREEN_SHARE_QUALITY_KEY);
    if (saved === 'smooth' || saved === 'hd' || saved === 'ultra') {
      setQualityPreset(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, qualityPreset);
  }, [qualityPreset]);

  useEffect(() => {
    if (!currentRoom) router.replace('/watch-room');
  }, [currentRoom, router]);

  // 浏览器不支持时只说明原因、禁用共享，不再把人退出房间
  const [supportError, setSupportError] = useState<string | null>(null);
  useEffect(() => {
    setSupportError(
      canShare
        ? getScreenShareHostSupportError()
        : getScreenShareViewerSupportError()
    );
  }, [canShare, screenRoom?.id]);

  // 本设备有资格共享时，别让本浏览器的其他标签页也连进房间（同账号会多出一个连接）
  useEffect(() => {
    if (!screenRoomId || !canShare) return;

    localStorage.setItem(WATCH_ROOM_NO_CONNECT_KEY, '1');
    localStorage.setItem(
      WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY,
      String(Date.now())
    );
    const heartbeat = window.setInterval(() => {
      localStorage.setItem(
        WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY,
        String(Date.now())
      );
    }, 30_000);

    const release = () => {
      localStorage.removeItem(WATCH_ROOM_NO_CONNECT_KEY);
      localStorage.removeItem(WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY);
    };
    // 整页刷新/关闭标签页时 React 不会执行卸载清理，只有 pagehide：
    // 标记留着会让本浏览器在 10 分钟内都连不回房间
    window.addEventListener('pagehide', release);

    return () => {
      release();
      window.removeEventListener('pagehide', release);
      window.clearInterval(heartbeat);
    };
  }, [canShare, screenRoomId]);

  if (!screenRoom) {
    return null;
  }

  const handleLeave = () => {
    if (isLocalSharing) stopSharing(true);
    leaveRoom();
    router.push('/watch-room');
  };

  const captureSettingsText = captureSettings
    ? [
        captureSettings.width && captureSettings.height
          ? `${captureSettings.width}x${captureSettings.height}`
          : '分辨率未知',
        captureSettings.frameRate
          ? `${Math.round(captureSettings.frameRate)} fps`
          : '帧率未知',
      ].join(' / ')
    : '未开始';

  return (
    <div className='min-h-screen bg-canvas text-fg'>
      <PageContainer className='flex min-h-screen flex-col gap-4 py-4'>
        <div className='flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-raised px-5 py-4 shadow-sm'>
          <div>
            <h1 className='flex items-center gap-2 text-[28px] md:text-[32px] font-bold'>
              <Monitor className='h-6 w-6 text-fg' />
              屏幕共享观影室
            </h1>
            <p className='mt-1 text-sm text-muted'>
              房间：{screenRoom.name} · 房主：{screenRoom.ownerName}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Link
              href='/watch-room'
              className='rounded-lg bg-raised px-4 py-2 text-fg min-h-[44px] tm-press inline-flex items-center'
            >
              返回房间
            </Link>
            {canShare && (
              <Link
                href='/'
                target='_blank'
                rel='noreferrer'
                onClick={(event) => {
                  event.preventDefault();
                  openDetachedPage();
                }}
                className='rounded-lg bg-fg px-4 py-2 text-inverse min-h-[44px] tm-press'
              >
                新开主页
              </Link>
            )}
            <button
              onClick={handleLeave}
              className='rounded-lg bg-raised px-4 py-2 text-fg min-h-[44px] tm-press'
            >
              离开房间
            </button>
          </div>
        </div>

        <div className='grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]'>
          <div className='relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-ink'>
            {isLocalSharing || (canShare && !isSharing) ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className='h-full w-full bg-ink object-contain'
              />
            ) : (
              <video
                ref={attachRemoteVideo}
                autoPlay
                playsInline
                controls
                className='h-full w-full bg-ink object-contain'
              />
            )}

            {!isSharing && (
              <div className='absolute px-6 text-center text-[color:var(--tm-room-player-text)]'>
                <MonitorPlay className='mx-auto mb-3 h-12 w-12 text-[color:var(--tm-room-player-text)] opacity-70' />
                <p className='text-sm font-medium'>
                  {!following
                    ? '正在个人观看，房间和消息保留'
                    : canShare
                    ? '点击开始共享，向房员推送浏览器画面'
                    : '等待主持开始共享屏幕'}
                </p>
                {!following && (
                  <button
                    type='button'
                    onClick={() => void session?.resumeRoom()}
                    className='mt-3 rounded-lg bg-fg px-4 py-2 text-inverse min-h-[44px] tm-press'
                  >
                    恢复一起看
                  </button>
                )}
                {canShare && (
                  <p className='mt-2 text-sm text-[color:var(--tm-room-player-text)] opacity-70'>
                    共享期间本页不要关闭；想继续浏览可以点右上角“新开主页”。
                  </p>
                )}
              </div>
            )}
          </div>

          <div className='space-y-4'>
            <div className='rounded-xl border border-line bg-surface p-4'>
              <h2 className='mb-3 font-medium'>共享状态</h2>
              <div className='space-y-2 text-sm text-muted'>
                <p>类型：屏幕共享</p>
                <p>状态：{isSharing ? '共享中' : '未开始'}</p>
                <p>成员：{members.length} 人</p>
              </div>

              {canShare && (
                <div className='mt-2 text-sm text-muted'>
                  实际采集：{captureSettingsText}
                </div>
              )}

              {supportError && (
                <div className='mt-3 rounded-lg border border-danger bg-raised px-3 py-2 text-sm text-fg'>
                  {supportError}
                </div>
              )}

              {error && (
                <div className='mt-3 rounded-lg border border-danger bg-raised px-3 py-2 text-sm text-fg'>
                  {error}
                </div>
              )}

              {canShare && (
                <div className='mt-4'>
                  <label className='mb-2 block text-sm font-medium text-muted'>
                    共享画质
                  </label>
                  <Select
                    value={qualityPreset}
                    onChange={(event) =>
                      setQualityPreset(
                        event.target.value as ScreenShareQualityPreset
                      )
                    }
                    disabled={isStarting || isSharing}
                    className='min-h-[44px] w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {screenShareQualityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className='mt-2 text-[13px] text-muted'>
                    画质越高越清晰，但更依赖网络和设备性能。共享开始后不可切换。
                  </p>
                </div>
              )}

              <div className='mt-4 flex gap-3'>
                {canShare ? (
                  <>
                    <button
                      onClick={() => startSharing()}
                      disabled={
                        isStarting || isLocalSharing || Boolean(supportError)
                      }
                      className='flex-1 rounded-lg bg-fg px-4 py-2 text-inverse disabled:opacity-50 min-h-[44px] tm-press'
                    >
                      {isStarting
                        ? '启动中...'
                        : isLocalSharing
                        ? '共享中'
                        : isSharing
                        ? '重新开始共享'
                        : '开始共享'}
                    </button>
                    <button
                      onClick={() => stopSharing(true)}
                      disabled={!isLocalSharing && !isSharing}
                      className='rounded-lg bg-fg px-4 py-2 text-inverse disabled:opacity-50 min-h-[44px] tm-press'
                    >
                      停止
                    </button>
                  </>
                ) : (
                  <div className='rounded-lg bg-raised px-3 py-2 text-sm text-fg'>
                    无需操作，主持开始共享后会自动显示画面。
                  </div>
                )}
              </div>
            </div>

            <div className='rounded-xl border border-line bg-surface p-4'>
              <h2 className='mb-3 flex items-center gap-2 font-medium'>
                <Users className='h-4 w-4' />
                房间成员
              </h2>
              <div className='space-y-2'>
                {members.map((member) => (
                  <div
                    key={member.id}
                    className='flex items-center justify-between rounded-lg bg-raised px-3 py-2'
                  >
                    <span className='text-sm'>{member.name}</span>
                    {member.isOwner && (
                      <span className='rounded bg-raised px-2 py-1 text-[13px] text-fg'>
                        房主
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className='rounded-xl border border-line bg-raised p-4 text-sm text-fg'>
              建议使用桌面版 Chrome / Edge，并优先共享标签页。
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
