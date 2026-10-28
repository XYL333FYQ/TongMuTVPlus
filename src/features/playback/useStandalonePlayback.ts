'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';
import { useAudioFocus } from '@/features/playback/useAudioFocus';

const EXIT_FAILED = '未能退出共同播放，请重试';
const EXIT_TRIES = 3;
const EXIT_RETRY_MS = 250;

/**
 * 独立播放器（TV 播放页）和房间的边界。
 * TV 页面自己播放、不参与房间同步，所以进入播放前必须：
 *   1. 退出“一起看”（个人观看，房间和消息保留）并让房间里的电影停下；
 *   2. 退出完成前 ready=false，页面不要挂载播放器，避免两路同时出声；
 *   3. 视频真正播放时才拿声音归属，其他标签页的播放器自动让出声音。
 * 离开 TV 页面不会自动恢复同步，要用户在房间里明确“恢复一起看”。
 */
export function useStandalonePlayback() {
  const room = useWatchRoomContextSafe()?.currentRoom ?? null;
  const session = usePlaybackSessionSafe();
  const roomId = room?.id ?? null;
  const needsExit = Boolean(roomId && session?.followingRoom);

  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [element, setElement] = useState<HTMLMediaElement | null>(null);

  // 最新的会话放进 ref：异步回来时读最新值，而不是发起时的旧闭包
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    if (!needsExit) {
      setError(null);
      return;
    }
    let current = true;
    const target = roomId;
    const finish = (ok: boolean) => {
      // 房间换了或页面已离开：迟到的结果不处理
      if (!current || roomIdRef.current !== target) return;
      if (ok) {
        setError(null);
        sessionRef.current?.controller?.pause();
      } else setError(EXIT_FAILED);
    };
    // 页面一加载就自动退出时，房间刚好加入完成，会话层随后会重置“跟随”状态，
    // 第一次退出可能被判为已被取代。这不是真失败，所以自动再试几次，仍不行才报错
    const run = async () => {
      for (let tryCount = 0; tryCount < EXIT_TRIES; tryCount += 1) {
        if (tryCount > 0)
          await new Promise((resolve) => setTimeout(resolve, EXIT_RETRY_MS));
        if (!current || roomIdRef.current !== target) return;
        const exit = sessionRef.current?.enterPersonalViewing;
        let ok = false;
        try {
          ok = Boolean(exit && (await exit()));
        } catch {
          ok = false;
        }
        if (ok || tryCount === EXIT_TRIES - 1) {
          finish(ok);
          return;
        }
      }
    };
    void run();
    return () => {
      current = false;
    };
  }, [needsExit, roomId, attempt]);

  const { claimSound } = useAudioFocus(element, false);
  useEffect(() => {
    if (!element) return;
    // 播放器挂载时可能已经开始播放（play 事件早于监听），这时也要拿声音
    if (!element.paused) claimSound();
    element.addEventListener('play', claimSound);
    return () => element.removeEventListener('play', claimSound);
  }, [element, claimSound]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return {
    ready: !needsExit,
    error: needsExit ? error : null,
    retry,
    bindVideo: setElement,
  };
}
