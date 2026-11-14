'use client';

import { useEffect, useMemo, useRef } from 'react';

import { getShell } from '@/lib/shell-bridge';

import { useWatchSessionSafe } from '@/features/watch/session/context';

/**
 * 锁屏 / 通知栏共用现有播放控制器与房间权限；只观察媒体，不重建播放实例。
 */
export default function MediaSessionBridge() {
  const watch = useWatchSessionSafe();
  const player = watch?.engine?.player || null;
  const video = player?.video || null;
  // 独立看的播放器：锁屏控制直接作用于它（房间有自己的播放器）
  const controller = useMemo(
    () =>
      player && video
        ? { video, play: () => player.play(), pause: () => player.pause() }
        : null,
    [player, video]
  );
  const title =
    watch?.engine?.media.detail?.title || watch?.engine?.media.params.title;
  // 独立看的播放器不受房间权限限制（一起看有自己的播放器）
  const locked = false;
  const selected = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const shell = getShell();
    return () => {
      try {
        shell?.setMediaState?.(
          JSON.stringify({
            v: 1,
            active: false,
            playing: false,
            canControl: false,
            title: '',
          })
        );
      } catch {
        /* A destroyed host needs no further state. */
      }
    };
  }, []);
  useEffect(() => {
    const shell = getShell();
    // A capable host owns one native session. Old hosts and browsers retain Web MediaSession.
    const session = shell?.setMediaState ? undefined : navigator.mediaSession;
    let lastSnapshot = '';
    let current = selected.current;
    let disposed = false;
    const sync = (preferred?: HTMLMediaElement) => {
      const all = Array.from(
        document.querySelectorAll<HTMLMediaElement>('video,audio')
      );
      const active = (media: HTMLMediaElement | null | undefined) =>
        Boolean(media && all.includes(media) && !media.paused && !media.ended);
      current = active(preferred)
        ? preferred!
        : active(current)
        ? current
        : all.find((media) => active(media)) ||
          (current && all.includes(current) && !current.ended ? current : null);
      selected.current = current;
      const mediaTitle =
        (current === controller?.video && title) ||
        document.title.split(' · ')[0] ||
        'TongMuTV Plus';
      if (shell?.setMediaState) {
        const snapshot = JSON.stringify({
          v: 1,
          active: Boolean(current),
          playing: Boolean(current && !current.paused && !current.ended),
          canControl: Boolean(
            current && !(current === controller?.video && locked)
          ),
          title: current ? Array.from(mediaTitle).slice(0, 160).join('') : '',
          videoWidth:
            current instanceof HTMLVideoElement ? current.videoWidth : 0,
          videoHeight:
            current instanceof HTMLVideoElement ? current.videoHeight : 0,
        });
        if (snapshot !== lastSnapshot) {
          try {
            shell.setMediaState(snapshot);
            lastSnapshot = snapshot;
          } catch {
            /* Unavailable native state must not interrupt page playback. */
          }
        }
      }
      if (!session) return;
      try {
        session.playbackState = current
          ? current.paused
            ? 'paused'
            : 'playing'
          : 'none';
      } catch {
        /* Partially supported MediaSession. */
      }
      try {
        session.metadata = current
          ? new MediaMetadata({
              title: mediaTitle,
              artist: 'TongMuTV Plus',
            })
          : null;
      } catch {
        /* Controls still work without MediaMetadata. */
      }
    };
    const onMedia = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      if (event.type === 'play' && media.isConnected) current = media;
      sync(media);
    };
    const action = (name: string) => {
      if (name !== 'play' && name !== 'pause') return false;
      if (disposed) return true;
      sync();
      if (!current) return true;
      const target =
        controller && current === controller.video ? controller : current;
      if (current === controller?.video && locked) return true;
      try {
        if (name === 'play')
          void Promise.resolve(target.play()).catch(() => {
            /* The media events report the actual state after a rejected play. */
          });
        else target.pause();
      } catch {
        /* A rejected gesture or destroyed source must not escape to native. */
      }
      return true;
    };
    window.__tmShellMediaAction = action;
    const events = [
      'play',
      'playing',
      'pause',
      'ended',
      'emptied',
      'loadedmetadata',
      'resize',
    ];
    events.forEach((event) => document.addEventListener(event, onMedia, true));
    const hasMedia = (node: Node) =>
      node instanceof Element &&
      (node.matches('video,audio') ||
        Boolean(node.querySelector('video,audio')));
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) =>
          [
            ...Array.from(record.addedNodes),
            ...Array.from(record.removedNodes),
          ].some(hasMedia)
        )
      )
        sync();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    const actions = ['play', 'pause'] as const;
    actions.forEach((name) => {
      try {
        session?.setActionHandler(name, () => {
          action(name);
        });
      } catch {
        /* Register supported actions independently. */
      }
    });
    sync(controller?.video);
    return () => {
      disposed = true;
      events.forEach((event) =>
        document.removeEventListener(event, onMedia, true)
      );
      observer.disconnect();
      if (window.__tmShellMediaAction === action)
        delete window.__tmShellMediaAction;
      actions.forEach((name) => {
        try {
          session?.setActionHandler(name, null);
        } catch {
          /* Unsupported action. */
        }
      });
      try {
        if (session) {
          session.playbackState = 'none';
          session.metadata = null;
        }
      } catch {
        /* Unsupported state. */
      }
    };
  }, [controller, title, locked]);

  return null;
}
