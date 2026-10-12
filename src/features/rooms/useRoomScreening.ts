'use client';

import { useEffect, useState } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';

/** Presentation only: never sends playback or room commands. */
export default function useRoomScreening(
  video: HTMLVideoElement | null,
  following: boolean
) {
  const reducedMotion = useReducedMotionSetting();
  const [screening, setScreening] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.tmRoomPresentation = 'true';
    return () => {
      delete document.documentElement.dataset.tmRoomPresentation;
    };
  }, []);
  useEffect(() => {
    setScreening(false);
    if (!video || !following || reducedMotion) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setScreening(false);
      clearTimeout(timer);
      if (
        !video.paused &&
        !video.ended &&
        !video.error &&
        video.readyState >= 2
      )
        timer = setTimeout(() => {
          if (
            !document.querySelector('[role="dialog"]') &&
            !video.paused &&
            !video.ended &&
            !video.error &&
            video.readyState >= 2
          )
            setScreening(true);
        }, 3000);
    };
    const stop = () => {
      clearTimeout(timer);
      setScreening(false);
    };
    const stopped = ['pause', 'ended', 'waiting', 'error'];
    video.addEventListener('playing', wake);
    stopped.forEach((event) => video.addEventListener(event, stop));
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('scroll', wake, true);
    wake();
    return () => {
      clearTimeout(timer);
      video.removeEventListener('playing', wake);
      stopped.forEach((event) => video.removeEventListener(event, stop));
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('scroll', wake, true);
    };
  }, [video, following, reducedMotion]);
  useEffect(() => {
    if (screening) document.documentElement.dataset.tmRoomScreening = 'true';
    else delete document.documentElement.dataset.tmRoomScreening;
    return () => {
      delete document.documentElement.dataset.tmRoomScreening;
    };
  }, [screening]);
  return screening;
}
