'use client';

import { ArrowLeft, ExternalLink, LogOut, MonitorUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MutableRefObject, useCallback, useEffect, useState } from 'react';

import {
  type ScreenShareQualityPreset,
  screenShareQualityOptions,
  useScreenShare,
} from '@/hooks/useScreenShare';

import Select from '@/components/ui/Select';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import { useAudioFocus } from '@/features/playback/useAudioFocus';

const WATCH_ROOM_NO_CONNECT_KEY = 'watch_room_no_connect';
const WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY = 'watch_room_no_connect_timestamp';
const SCREEN_SHARE_QUALITY_KEY = 'watch_room_screen_quality';

/** 浏览器给的英文错误换成能看懂的话 */
function readableShareError(message: string | null) {
  if (!message) return null;
  if (/permission denied|notallowed|denied by/i.test(message))
    return '没有开始共享：选择窗口时取消了，或系统没有允许。最小化的窗口不会出现在选择列表里，先把它还原再试。';
  if (/notfound|no source|could not start/i.test(message))
    return '没有找到可以共享的画面，换一个窗口或整个屏幕再试。';
  if (/notreadable|abort/i.test(message))
    return '画面被系统占用或采集中断，请再试一次。';
  return message;
}

/** 画面按真实宽高比显示，不留上下黑边 */
function useVideoAspect(element: HTMLVideoElement | null) {
  const [ratio, setRatio] = useState<string | null>(null);
  useEffect(() => {
    if (!element) return;
    const update = () =>
      setRatio(
        element.videoWidth && element.videoHeight
          ? `${element.videoWidth} / ${element.videoHeight}`
          : null
      );
    update();
    element.addEventListener('loadedmetadata', update);
    element.addEventListener('resize', update);
    return () => {
      element.removeEventListener('loadedmetadata', update);
      element.removeEventListener('resize', update);
    };
  }, [element]);
  return ratio;
}

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
  const [qualityPreset, setQualityPreset] =
    useState<ScreenShareQualityPreset>('smooth');
  const {
    currentRoom: screenRoom,
    canShare,
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
  const [localElement, setLocalElement] = useState<HTMLVideoElement | null>(
    null
  );
  const attachLocalVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      (localVideoRef as MutableRefObject<HTMLVideoElement | null>).current =
        element;
      setLocalElement(element);
    },
    [localVideoRef]
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

  const ratio = useVideoAspect(
    isLocalSharing || (canShare && !isSharing) ? localElement : remoteElement
  );

  if (!screenRoom) {
    return null;
  }

  const handleLeave = () => {
    if (isLocalSharing) stopSharing(true);
    leaveRoom();
    router.push('/watch-room');
  };

  const captureText =
    captureSettings && captureSettings.width && captureSettings.height
      ? `${captureSettings.width}×${captureSettings.height}${
          captureSettings.frameRate
            ? ` · ${Math.round(captureSettings.frameRate)} fps`
            : ''
        }`
      : '';
  const status = isSharing
    ? isLocalSharing
      ? `你正在共享${captureText ? ` · ${captureText}` : ''}`
      : '正在共享'
    : '还没开始共享';
  const shownError = readableShareError(error);
  const showLocal = isLocalSharing || (canShare && !isSharing);

  return (
    <div className='tm-t-share'>
      <header className='tm-t-head'>
        <Link
          href='/watch-room'
          className='tm-t-icon tm-t-head-back'
          aria-label='返回房间'
          title='返回房间'
        >
          <ArrowLeft size={20} />
        </Link>
        <div className='tm-t-head-title'>
          <h1>共享屏幕</h1>
          <div className='tm-t-head-meta'>
            <span className='tm-t-chip'>
              <span
                className='tm-t-dot'
                data-on={isSharing ? 'true' : undefined}
              />
              {status}
            </span>
            <span className='tm-t-chip'>{screenRoom.name}</span>
          </div>
        </div>
        <div className='tm-t-head-actions'>
          {canShare && (
            <Link
              href='/'
              target='_blank'
              rel='noreferrer'
              onClick={(event) => {
                event.preventDefault();
                openDetachedPage();
              }}
              className='tm-t-btn'
              title='共享时这一页要留着，新开一个页面继续逛'
            >
              <ExternalLink size={16} />
              <span>新开主页</span>
            </Link>
          )}
          <button
            type='button'
            onClick={handleLeave}
            className='tm-t-icon'
            aria-label='离开房间'
            title='离开房间'
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className='tm-t-share-layout'>
        <div
          className='tm-t-share-stage'
          style={{ aspectRatio: ratio || '16 / 9' }}
        >
          {showLocal ? (
            <video ref={attachLocalVideo} autoPlay muted playsInline />
          ) : (
            <video ref={attachRemoteVideo} autoPlay playsInline controls />
          )}
          {!isSharing && (
            <div className='tm-t-stage-empty'>
              <span className='tm-t-stage-icon'>
                <MonitorUp size={28} aria-hidden='true' />
              </span>
              <strong>
                {canShare
                  ? '共享一个窗口或整个屏幕'
                  : '等待有控制权的人开始共享屏幕'}
              </strong>
              {canShare && <span>共享期间这一页不要关</span>}
            </div>
          )}
        </div>

        <aside className='tm-t-share-side'>
          {supportError && (
            <p className='tm-t-error' role='alert'>
              {supportError}
            </p>
          )}
          {shownError && (
            <p className='tm-t-error' role='alert'>
              {shownError}
            </p>
          )}
          {canShare ? (
            <>
              <label className='tm-t-field'>
                <span>画质</span>
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
              </label>
              <div className='tm-t-share-actions'>
                <button
                  type='button'
                  onClick={() => startSharing()}
                  disabled={
                    isStarting || isLocalSharing || Boolean(supportError)
                  }
                  className='tm-t-btn tm-t-btn-primary'
                >
                  {isStarting
                    ? '等待选择画面…'
                    : isLocalSharing
                    ? '共享中'
                    : isSharing
                    ? '重新开始共享'
                    : '开始共享'}
                </button>
                <button
                  type='button'
                  onClick={() => stopSharing(true)}
                  disabled={!isLocalSharing && !isSharing}
                  className='tm-t-btn'
                >
                  停止
                </button>
              </div>
            </>
          ) : (
            <p className='tm-t-hint'>开始共享后画面会自动出现在这里。</p>
          )}
          <div className='tm-t-share-members'>
            <span className='tm-t-share-label'>
              在看的人 · {members.length}
            </span>
            <ul>
              {members.map((member) => (
                <li key={member.id}>
                  <span className='tm-t-share-face' aria-hidden='true'>
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  {member.name}
                  {member.isOwner && <small>房主</small>}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
