'use client';

/*
 * 房间语音：服务器中转。点对点不通（或策略就是只走服务器）时，把麦克风切成小段经服务器转发，
 * 收到别人的小段按时间顺序排着播放；队列堆积太多就丢掉追到现在。
 */

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from 'react';

import { logger } from '@/lib/logger';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';

import {
  decodeRelayChunk,
  encodeMicChunk,
  RELAY_SAMPLE_RATE,
  scheduleRelayChunk,
} from './voice-relay-audio';

export function useVoiceRelay({
  socket,
  roomId,
  isSpeakerEnabled,
  localStreamRef,
  setError,
}: {
  socket: WatchRoomSocket | null;
  roomId: string | null;
  isSpeakerEnabled: boolean;
  localStreamRef: MutableRefObject<MediaStream | null>;
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<Map<string, number>>(new Map()); // 跟踪每个用户的下一个播放时间
  // 浏览器直连时是 MediaRecorder；服务器中转时存的是 ScriptProcessorNode（停止时断开）
  const mediaRecorderRef = useRef<MediaRecorder | ScriptProcessorNode | null>(
    null
  );

  // 启动服务器中转
  const startServerRelay = useCallback(() => {
    if (!socket || !localStreamRef.current) {
      logger.error(
        '[VoiceChat] Cannot start server relay - missing socket or stream'
      );
      return;
    }

    if (!roomId) {
      logger.error('[VoiceChat] Cannot start server relay - missing roomId');
      return;
    }

    logger.info('[VoiceChat] Starting server relay');

    try {
      const audioContext = new AudioContext({ sampleRate: RELAY_SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(
        localStreamRef.current
      );

      // 使用ScriptProcessorNode处理音频数据
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      // 保存roomId的引用，避免闭包问题
      const currentRoomId = roomId;

      processor.onaudioprocess = (e) => {
        if (!socket || !socket.connected) return;
        // 静音或几乎全零的包不发
        const audioData = encodeMicChunk(e.inputBuffer.getChannelData(0));
        if (!audioData) return;
        socket.emit('voice:audio-chunk', {
          roomId: currentRoomId,
          audioData,
          sampleRate: RELAY_SAMPLE_RATE,
        });
      };

      source.connect(processor);

      // ScriptProcessorNode需要连接到某个节点才能触发onaudioprocess
      // 但连接到destination会产生本地回声，所以创建一个静音的GainNode
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0; // 静音，不输出到喇叭
      processor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 保存引用以便清理
      audioContextRef.current = audioContext;
      mediaRecorderRef.current = processor; // 存储processor用于清理

      logger.info('[VoiceChat] Server relay started');
    } catch (err) {
      logger.error('[VoiceChat] Failed to start server relay:', err);
      setError('服务器中转启动失败');
    }
  }, [socket, roomId, localStreamRef, setError]);

  // 停止服务器中转
  const stopServerRelay = useCallback(() => {
    if (mediaRecorderRef.current) {
      // ScriptProcessorNode没有stop方法，需要断开连接
      const processor = mediaRecorderRef.current;
      if ('disconnect' in processor) {
        processor.disconnect();
      }
      mediaRecorderRef.current = null;
      logger.info('[VoiceChat] Server relay stopped');
    }
  }, []);

  // 播放服务器中转的音频 - 使用Web Audio API播放PCM数据
  const playServerRelayAudio = useCallback(
    async (userId: string, audioData: number[], sampleRate = 16000) => {
      if (!isSpeakerEnabled) return;

      try {
        // 创建AudioContext（如果不存在）
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const audioContext = audioContextRef.current;
        const next = scheduleRelayChunk(
          audioContext,
          decodeRelayChunk(audioData),
          sampleRate,
          nextPlayTimeRef.current.get(userId) || undefined
        );
        if (next === null) {
          // 播放队列堆积太多（网络延迟），丢掉这一段并把队列追到现在
          logger.warn(
            `[VoiceChat] Dropping audio from ${userId} due to queue buildup`
          );
          nextPlayTimeRef.current.set(userId, audioContext.currentTime);
          return;
        }
        nextPlayTimeRef.current.set(userId, next);
      } catch (err) {
        logger.error('[VoiceChat] Failed to play audio:', err);
        setError('音频播放失败: ' + (err as Error).message);
      }
    },
    [isSpeakerEnabled, setError]
  );

  // 挂断时：停掉中转，关掉播放用的 AudioContext，清空播放队列
  const resetRelay = useCallback(() => {
    stopServerRelay();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    nextPlayTimeRef.current.clear();
  }, [stopServerRelay]);

  return {
    nextPlayTimeRef,
    startServerRelay,
    stopServerRelay,
    playServerRelayAudio,
    resetRelay,
  };
}
