'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const LEASE_KEY = 'tongmutvplus:audible-tab';
const LEASE_MS = 6500;
interface Lease {
  id: string;
  expiresAt: number;
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
export function useAudioFocus(video: HTMLVideoElement | null) {
  const id = useRef('');
  const [ownsSound, setOwnsSound] = useState(true);
  const ownsRef = useRef(true);
  const preferredMuted = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const previousVideo = useRef<HTMLVideoElement | null>(null);

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
    try {
      localStorage.setItem(
        LEASE_KEY,
        JSON.stringify({ id: id.current, expiresAt: Date.now() + LEASE_MS })
      );
    } catch {
      /* In restricted storage the current tab can still play. */
    }
    channel.current?.postMessage({ type: 'lease' });
    enforce(true);
  }, [enforce]);

  useEffect(() => {
    if (!video) return;
    if (!id.current) id.current = crypto.randomUUID();
    if (previousVideo.current !== video) {
      preferredMuted.current = previousVideo.current
        ? preferredMuted.current
        : video.muted;
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
        const lease = parseAudioLease(
          localStorage.getItem(LEASE_KEY),
          Date.now()
        );
        if (!lease || lease.id === id.current) {
          localStorage.setItem(
            LEASE_KEY,
            JSON.stringify({ id: id.current, expiresAt: Date.now() + LEASE_MS })
          );
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
        if (
          parseAudioLease(localStorage.getItem(LEASE_KEY), Date.now())?.id ===
          id.current
        )
          localStorage.removeItem(LEASE_KEY);
      } catch {
        /* No shared lease was available. */
      }
      channel.current?.postMessage({ type: 'lease' });
    };
    if (channel.current) channel.current.onmessage = reconcile;
    window.addEventListener('storage', storage);
    window.addEventListener('pagehide', release);
    video.addEventListener('volumechange', changedVolume);
    reconcile();
    const timer = window.setInterval(reconcile, 2000);
    return () => {
      clearInterval(timer);
      video.removeEventListener('volumechange', changedVolume);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', release);
      release();
      channel.current?.close();
      channel.current = null;
    };
  }, [video, enforce]);
  return { ownsSound, claimSound };
}
