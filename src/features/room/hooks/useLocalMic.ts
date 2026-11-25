'use client';

/*
 * 房间语音：本机麦克风。取流（回声消除、降噪、自动增益）、彻底停掉、静音 / 取消静音（不释放麦克风）。
 */

import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react';

import { logger } from '@/lib/logger';

export function useLocalMic(setError: Dispatch<SetStateAction<string | null>>) {
  const localStreamRef = useRef<MediaStream | null>(null);

  // 获取本地麦克风流
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      logger.info('[VoiceChat] Got local stream');
      return stream;
    } catch (err) {
      logger.error('[VoiceChat] Failed to get local stream:', err);
      setError('无法访问麦克风，请检查权限设置');
      throw err;
    }
  }, [setError]);

  // 停止本地流（完全停止并释放麦克风）
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      logger.info('[VoiceChat] Stopped local stream');
    }
  }, []);

  // 禁用本地音频轨道（静音，但不释放麦克风）
  const muteLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.enabled = false;
      });
      logger.info('[VoiceChat] Muted local stream');
    }
  }, []);

  // 启用本地音频轨道（取消静音）
  const unmuteLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.enabled = true;
      });
      logger.info('[VoiceChat] Unmuted local stream');
    }
  }, []);

  return {
    localStreamRef,
    getLocalStream,
    stopLocalStream,
    muteLocalStream,
    unmuteLocalStream,
  };
}
