'use client';

/*
 * 声音归属：同一个浏览器（含多个标签页）同一时刻只有一个播放器出声，其他继续解码但静音。
 *
 * 2026-11-17 重写，规则：
 * 1. 只有“正在播放”的播放器才占着声音。暂停 / 播完立刻让出，不再一直续约。
 *    （以前暂停在另一个标签页的播放器会一直占着，新打开的标签页按播放也没声音。）
 * 2. 用户按播放就拿声音；没有人在出声时，任何播放都直接拿声音。
 *    没有用户操作的自动播放（例如房间同步替别人按的播放）不抢正在出声的播放器。
 * 3. 被静音的播放器，用户自己打开声音 = 要在这里听，直接拿声音（以前会被立刻改回静音）。
 * 4. 出声的标签页在后台时定时器可能被浏览器放慢，续约跟不上也没关系：
 *    别的播放器只有自己也在播放时才会接手。
 *
 * 语音通话不走这里。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { readSettingStrict, removeSetting, writeSetting } from '@/lib/settings';

const LEASE_KEY = 'tongmutvplus:audible-tab';
const LEASE_MS = 6500;
const LOCAL_FOCUS_EVENT = 'tongmu:audio-focus';
interface Lease {
  id: string;
  expiresAt: number;
}
let memoryLease: Lease | null = null;
let memoryOnly = false;
let participants = 0;
function readLease() {
  if (!memoryOnly) {
    // 存储读不了（被禁用）就改成只在本页内存里记
    const raw = readSettingStrict(LEASE_KEY);
    if (raw === undefined) memoryOnly = true;
    else memoryLease = parseAudioLease(raw, Date.now());
  }
  return memoryLease && memoryLease.expiresAt > Date.now() ? memoryLease : null;
}
function writeLease(lease: Lease | null) {
  memoryLease = lease;
  if (!memoryOnly) {
    if (lease) {
      if (!writeSetting(LEASE_KEY, JSON.stringify(lease))) memoryOnly = true;
    } else removeSetting(LEASE_KEY);
  }
}

export function parseAudioLease(
  value: string | null,
  now: number
): Lease | null {
  try {
    const lease = JSON.parse(value || 'null') as Lease | null;
    return lease &&
      typeof lease.id === 'string' &&
      Number.isFinite(lease.expiresAt) &&
      lease.expiresAt > now
      ? lease
      : null;
  } catch {
    return null;
  }
}

/** 这次操作是不是用户刚点的（浏览器不支持时按“是”处理） */
function userIsActing() {
  const activation = (
    navigator as Navigator & { userActivation?: { isActive: boolean } }
  ).userActivation;
  return activation ? activation.isActive : true;
}

function isPlaying(media: HTMLMediaElement) {
  return !media.paused && !media.ended;
}

/** A tab keeps decoding/synchronizing while another player owns sound. */
export function useAudioFocus(
  video: HTMLMediaElement | null,
  initialMuted?: boolean
) {
  const id = useRef('');
  const [ownsSound, setOwnsSound] = useState(true);
  const ownsRef = useRef(true);
  const preferredMuted = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const previousVideo = useRef<HTMLMediaElement | null>(null);
  /** 用户明确点了“在这里听”：即使还没开始播放，也先占住一个续约周期 */
  const claimedAt = useRef(0);

  const myId = () => {
    if (!id.current) id.current = crypto.randomUUID();
    return id.current;
  };
  const notifyOthers = useCallback(() => {
    channel.current?.postMessage({ type: 'lease' });
    window.dispatchEvent(new Event(LOCAL_FOCUS_EVENT));
  }, []);

  const enforce = useCallback(
    (owns: boolean) => {
      ownsRef.current = owns;
      setOwnsSound(owns);
      if (!video) return;
      const muted = owns ? preferredMuted.current : true;
      if (video.muted !== muted) video.muted = muted;
    },
    [video]
  );
  const claimSound = useCallback(() => {
    preferredMuted.current = false;
    claimedAt.current = Date.now();
    writeLease({ id: myId(), expiresAt: Date.now() + LEASE_MS });
    enforce(true);
    notifyOthers();
  }, [enforce, notifyOthers]);

  useEffect(() => {
    if (!video) return;
    participants += 1;
    const self = myId();
    if (previousVideo.current !== video) {
      preferredMuted.current = previousVideo.current
        ? preferredMuted.current
        : initialMuted ?? video.muted;
      previousVideo.current = video;
    }
    try {
      if (typeof BroadcastChannel !== 'undefined')
        channel.current = new BroadcastChannel(LEASE_KEY);
    } catch {
      channel.current = null;
    }
    const reconcile = () => {
      try {
        const lease = readLease();
        if (lease && lease.id !== self) return enforce(false);
        if (isPlaying(video)) {
          // 自己在放：续约（或接手没人占着的声音）
          const fresh = !lease;
          writeLease({ id: self, expiresAt: Date.now() + LEASE_MS });
          if (fresh || !ownsRef.current) notifyOthers();
        } else if (lease && Date.now() - claimedAt.current > LEASE_MS) {
          // 停着就让出来，别的正在播放的播放器可以接手
          writeLease(null);
          notifyOthers();
        }
        enforce(true);
      } catch {
        enforce(true);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === LEASE_KEY) reconcile();
    };
    const changedVolume = () => {
      if (ownsRef.current) {
        preferredMuted.current = video.muted;
        return;
      }
      // 被静音时只有我们会把它设成静音；变成有声音只能是用户（或播放器）打开的
      if (!video.muted) {
        if (userIsActing()) claimSound();
        else video.muted = true;
      }
    };
    const onPlay = () => {
      const lease = readLease();
      if (!lease || lease.id === self || userIsActing()) claimSound();
      else enforce(false);
    };
    const onStop = () => {
      claimedAt.current = 0;
      if (readLease()?.id !== self) return;
      writeLease(null);
      notifyOthers();
    };
    const release = () => {
      try {
        if (readLease()?.id === self) writeLease(null);
      } catch {
        /* No shared lease was available. */
      }
      notifyOthers();
    };
    if (channel.current) channel.current.onmessage = reconcile;
    window.addEventListener('storage', storage);
    window.addEventListener(LOCAL_FOCUS_EVENT, reconcile);
    window.addEventListener('pagehide', release);
    video.addEventListener('volumechange', changedVolume);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onStop);
    video.addEventListener('ended', onStop);
    if (isPlaying(video)) onPlay();
    reconcile();
    const timer = window.setInterval(reconcile, 2000);
    return () => {
      clearInterval(timer);
      video.removeEventListener('volumechange', changedVolume);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onStop);
      video.removeEventListener('ended', onStop);
      window.removeEventListener('storage', storage);
      window.removeEventListener(LOCAL_FOCUS_EVENT, reconcile);
      window.removeEventListener('pagehide', release);
      release();
      channel.current?.close();
      channel.current = null;
      participants -= 1;
      if (!participants) {
        memoryLease = null;
        memoryOnly = false;
      }
    };
  }, [video, enforce, claimSound, notifyOthers, initialMuted]);
  return { ownsSound, claimSound };
}
