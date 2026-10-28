'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
    try {
      memoryLease = parseAudioLease(
        localStorage.getItem(LEASE_KEY),
        Date.now()
      );
    } catch {
      memoryOnly = true;
    }
  }
  return memoryLease && memoryLease.expiresAt > Date.now() ? memoryLease : null;
}
function writeLease(lease: Lease | null) {
  memoryLease = lease;
  if (!memoryOnly) {
    try {
      if (lease) localStorage.setItem(LEASE_KEY, JSON.stringify(lease));
      else localStorage.removeItem(LEASE_KEY);
    } catch {
      memoryOnly = true;
    }
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

/** A tab keeps decoding/synchronizing while another tab owns sound. */
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

  const enforce = useCallback(
    (owns: boolean) => {
      ownsRef.current = owns;
      setOwnsSound(owns);
      if (video) video.muted = owns ? preferredMuted.current : true;
    },
    [video]
  );
  const claimSound = useCallback(() => {
    if (!id.current) id.current = crypto.randomUUID();
    preferredMuted.current = false;
    writeLease({ id: id.current, expiresAt: Date.now() + LEASE_MS });
    channel.current?.postMessage({ type: 'lease' });
    window.dispatchEvent(new Event(LOCAL_FOCUS_EVENT));
    enforce(true);
  }, [enforce]);

  useEffect(() => {
    if (!video) return;
    participants += 1;
    if (!id.current) id.current = crypto.randomUUID();
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
        if (!lease || lease.id === id.current) {
          writeLease({ id: id.current, expiresAt: Date.now() + LEASE_MS });
          if (!ownsRef.current) channel.current?.postMessage({ type: 'lease' });
          enforce(true);
        } else enforce(false);
      } catch {
        enforce(true);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === LEASE_KEY) reconcile();
    };
    const changedVolume = () => {
      if (!ownsRef.current) {
        if (!video.muted) video.muted = true;
      } else preferredMuted.current = video.muted;
    };
    const release = () => {
      try {
        if (readLease()?.id === id.current) writeLease(null);
      } catch {
        /* No shared lease was available. */
      }
      channel.current?.postMessage({ type: 'lease' });
      window.dispatchEvent(new Event(LOCAL_FOCUS_EVENT));
    };
    if (channel.current) channel.current.onmessage = reconcile;
    window.addEventListener('storage', storage);
    window.addEventListener(LOCAL_FOCUS_EVENT, reconcile);
    window.addEventListener('pagehide', release);
    video.addEventListener('volumechange', changedVolume);
    reconcile();
    const timer = window.setInterval(reconcile, 2000);
    return () => {
      clearInterval(timer);
      video.removeEventListener('volumechange', changedVolume);
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
  }, [video, enforce, initialMuted]);
  return { ownsSound, claimSound };
}
