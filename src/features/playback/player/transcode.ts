/*
 * 自己看：本机转码器（localhost:19080）转码播放。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { getTranscoderCookieHeader } from '@/lib/transcoder-cookie.client';

import { ToastProps } from '@/components/feedback/Toast';

import type { Art } from '@/features/player';
import { LinkRefresher } from '@/features/player';

import type { PlaybackSourceBadge } from '../page/types';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface TranscodeContext {
  LOCAL_TRANSCODER_BASE_URL: 'http://localhost:19080';
  artPlayerRef: MutableRefObject<Art | null>;
  isTranscoding: boolean;
  linkRefresher: LinkRefresher;
  proxyAttemptedRef: MutableRefObject<boolean>;
  resolveCurrentExternalPlaybackUrl: () => Promise<string | null>;
  resumeTimeRef: MutableRefObject<number | null>;
  setCorsFailedUrl: Dispatch<SetStateAction<string | null>>;
  setIsTranscoding: Dispatch<SetStateAction<boolean>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setPlaybackSourceBadge: Dispatch<SetStateAction<PlaybackSourceBadge>>;
  setToast: Dispatch<SetStateAction<ToastProps | null>>;
  setVideoError: Dispatch<SetStateAction<string | null>>;
  setVideoLoadingStage: Dispatch<
    SetStateAction<'initing' | 'sourceChanging' | 'episodeChanging'>
  >;
  setVideoQualities: Dispatch<SetStateAction<{ name: string; url: string }[]>>;
  setVideoUrl: Dispatch<SetStateAction<string>>;
}

export function makeHandleCreateTranscodeSession(ctx: TranscodeContext) {
  const {
    LOCAL_TRANSCODER_BASE_URL,
    isTranscoding,
    linkRefresher,
    resolveCurrentExternalPlaybackUrl,
    setIsTranscoding,
    setPlaybackSourceBadge,
    setToast,
    setVideoQualities,
    setVideoUrl,
  } = ctx;
  return async () => {
    if (isTranscoding) return;

    try {
      setIsTranscoding(true);
      const currentPlayTime = ctx.artPlayerRef.current?.currentTime || 0;

      const sourceUrl = await resolveCurrentExternalPlaybackUrl();
      if (!sourceUrl) {
        throw new Error('当前没有可转码的播放链接');
      }

      const requestHeaders: Record<string, string> = {};
      if (sourceUrl.startsWith(window.location.origin)) {
        // 登录凭证脚本读不到了，向本站要一份短效副本交给转码程序
        const cookie = await getTranscoderCookieHeader();
        if (cookie) {
          requestHeaders.Cookie = cookie;
        }
        requestHeaders.Referer = `${window.location.origin}/`;
      }

      let response: Response;
      try {
        response = await fetch(`${LOCAL_TRANSCODER_BASE_URL}/v1/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: sourceUrl,
            headers:
              Object.keys(requestHeaders).length > 0
                ? requestHeaders
                : undefined,
            subtitle: {
              mode: 'burn_embedded',
              stream: 'auto',
            },
            refresh: false,
          }),
        });
      } catch {
        throw new Error('转码服务连接失败');
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || `转码请求失败 (${response.status})`
        );
      }

      const playUrl = data?.playlist_url || data?.play_url;
      if (!playUrl) {
        throw new Error('转码器未返回播放地址');
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));

      linkRefresher.clear();
      ctx.proxyAttemptedRef.current = false;
      ctx.resumeTimeRef.current = currentPlayTime > 0 ? currentPlayTime : null;
      setVideoQualities([]);
      ctx.setVideoError(null);
      ctx.setCorsFailedUrl(null);
      ctx.setIsVideoLoading(true);
      ctx.setVideoLoadingStage('sourceChanging');
      setPlaybackSourceBadge(null);
      setVideoUrl(playUrl);
      setToast({
        message: '转码任务已创建，等待 3 秒后已切换到转码地址',
        type: 'success',
        onClose: () => setToast(null),
      });
    } catch (error) {
      console.error('创建转码任务失败:', error);
      setToast({
        message: error instanceof Error ? error.message : '创建转码任务失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setIsTranscoding(false);
    }
  };
}
