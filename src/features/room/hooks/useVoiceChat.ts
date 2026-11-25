// React Hook for Voice Chat in Watch Room
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';

import { useLocalMic } from './useLocalMic';
import { useVoicePeers } from './useVoicePeers';
import { useVoiceRelay } from './useVoiceRelay';
import { type VoiceStrategy, getVoiceStrategy } from './voice-peer';

import type { Member } from '@/types/watch-room';

interface UseVoiceChatOptions {
  socket: WatchRoomSocket | null;
  roomId: string | null;
  isMicEnabled: boolean;
  isSpeakerEnabled: boolean;
  members: Member[];
  /** 站点是否开放语音；关闭时不监听语音事件、不申请麦克风、不播放，已有连接会挂断 */
  enabled: boolean;
}

export function useVoiceChat({
  socket,
  roomId,
  isMicEnabled,
  isSpeakerEnabled,
  members,
  enabled,
}: UseVoiceChatOptions) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy] = useState<VoiceStrategy>(getVoiceStrategy());

  // 点对点全部失败时切到服务器中转（连接状态机里调用）
  const switchToServerRelayRef = useRef<(() => void) | null>(null);

  const {
    localStreamRef,
    getLocalStream,
    stopLocalStream,
    muteLocalStream,
    unmuteLocalStream,
  } = useLocalMic(setError);
  const {
    nextPlayTimeRef,
    startServerRelay,
    stopServerRelay,
    playServerRelayAudio,
    resetRelay,
  } = useVoiceRelay({
    socket,
    roomId,
    isSpeakerEnabled,
    localStreamRef,
    setError,
  });
  const {
    peerConnectionsRef,
    remoteStreamsRef,
    remoteAudioElementsRef,
    playRemoteStream,
    cleanupWebRTC,
    initiateConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  } = useVoicePeers({
    socket,
    isSpeakerEnabled,
    strategy,
    localStreamRef,
    nextPlayTimeRef,
    setIsConnected,
    setIsConnecting,
    switchToServerRelayRef,
  });

  // 切换到服务器中转模式
  const switchToServerRelay = useCallback(async () => {
    logger.info('[VoiceChat] Switching to server relay mode');
    setError('P2P连接失败，切换到服务器中转模式');

    // 清理WebRTC连接
    cleanupWebRTC();

    // 启动服务器中转
    if (isMicEnabled && localStreamRef.current) {
      // 确保音频轨道是启用的
      const tracks = localStreamRef.current.getTracks();
      const hasEnabledTrack = tracks.some(
        (track) => track.enabled && track.readyState === 'live'
      );

      if (hasEnabledTrack) {
        startServerRelay();
      } else {
        logger.error(
          '[VoiceChat] Cannot start server relay - no enabled audio tracks'
        );
        setError('服务器中转启动失败：麦克风未启用');
      }
    } else {
      logger.error(
        '[VoiceChat] Cannot start server relay - mic disabled or no stream'
      );
      setError('服务器中转启动失败：麦克风未开启');
    }
  }, [isMicEnabled, cleanupWebRTC, startServerRelay, localStreamRef]);

  // 将回退函数存储到ref中，供createPeerConnection使用
  useEffect(() => {
    switchToServerRelayRef.current = switchToServerRelay;
  }, [switchToServerRelay]);

  // ==================== 清理函数 ====================

  // 清理所有连接
  const cleanup = useCallback(() => {
    stopLocalStream();
    cleanupWebRTC();
    resetRelay();

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);

    logger.info('[VoiceChat] All cleaned up');
  }, [stopLocalStream, cleanupWebRTC, resetRelay]);

  // ==================== 主要控制逻辑 ====================

  // 监听麦克风状态变化
  useEffect(() => {
    if (!socket || !roomId || !enabled) return;

    if (isMicEnabled) {
      // 开启麦克风
      // 检查是否已经有本地流（可能只是被静音了）
      if (localStreamRef.current) {
        // 已有本地流，只需取消静音
        logger.info('[VoiceChat] Unmuting existing local stream');
        unmuteLocalStream();
        // 重新启动服务器中转（如果需要）
        if (
          strategy === 'server-only' ||
          peerConnectionsRef.current.size === 0
        ) {
          startServerRelay();
        }
        return;
      }

      // 没有本地流，需要重新获取
      setIsConnecting(true);
      setError(null);

      getLocalStream()
        .then(() => {
          logger.info('[VoiceChat] Local stream ready');

          if (strategy === 'server-only') {
            // 仅使用服务器中转
            startServerRelay();
          } else {
            // 使用WebRTC P2P连接
            logger.info(
              '[VoiceChat] WebRTC mode - initiating peer connections'
            );

            // 向房间内的其他成员发起连接
            const otherMembers = members.filter((m) => m.id !== socket.id);
            logger.info(
              '[VoiceChat] Found',
              otherMembers.length,
              'other members, initiating connections'
            );

            if (otherMembers.length > 0) {
              otherMembers.forEach((member) => {
                logger.info(
                  '[VoiceChat] Initiating connection to',
                  member.name,
                  member.id
                );
                initiateConnection(member.id);
              });
            } else {
              // 如果没有其他成员，先启动服务器中转作为后备
              logger.info(
                '[VoiceChat] No other members, using server relay as fallback'
              );
              startServerRelay();
            }
          }

          setIsConnecting(false);
        })
        .catch(() => {
          setIsConnecting(false);
        });
    } else {
      // 关闭麦克风 - 只静音，不断开连接
      muteLocalStream();
      // 停止服务器中转（因为不需要发送音频了）
      stopServerRelay();
    }

    // 不需要 cleanup，因为我们希望保持连接
    // cleanup 只在房间变化时调用
  }, [
    localStreamRef,
    peerConnectionsRef,
    enabled,
    isMicEnabled,
    socket,
    roomId,
    strategy,
    members,
    getLocalStream,
    muteLocalStream,
    unmuteLocalStream,
    stopServerRelay,
    startServerRelay,
    initiateConnection,
  ]);

  // 监听喇叭状态变化
  useEffect(() => {
    // 远程音频元素表是同一个 Map，清理时用这一次拿到的
    const remoteAudios = remoteAudioElementsRef.current;
    if (isSpeakerEnabled) {
      // 开启喇叭 - 播放所有远程流
      remoteStreamsRef.current.forEach((stream, peerId) => {
        playRemoteStream(peerId, stream);
      });
    } else {
      // 关闭喇叭 - 静音所有远程流
      remoteAudios.forEach((audio) => {
        audio.muted = true;
      });
    }

    // 恢复音量
    return () => {
      if (isSpeakerEnabled) {
        remoteAudios.forEach((audio) => {
          audio.muted = false;
        });
      }
    };
  }, [
    isSpeakerEnabled,
    playRemoteStream,
    remoteAudioElementsRef,
    remoteStreamsRef,
  ]);

  // 监听Socket.IO事件
  useEffect(() => {
    // 语音未开放：不接任何语音事件，陌生来电不会被自动接听，也不会出声
    if (!socket || !enabled) return;

    // WebRTC信令事件
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice', handleIceCandidate);

    // 监听其他用户开启麦克风的通知
    socket.on('voice:mic-enabled', (data: { userId: string }) => {
      logger.info('[VoiceChat] User', data.userId, 'enabled microphone');
      // 其他用户开启了麦克风，我们不需要做任何事，等待接收他们的offer即可
    });

    // 服务器中转事件
    const handleAudioChunk = (data: {
      userId: string;
      audioData: number[];
      sampleRate?: number;
    }) => {
      // 过滤掉自己发送的音频，避免回声
      if (data.userId === socket.id) {
        return;
      }

      if (
        strategy === 'server-only' ||
        !peerConnectionsRef.current.has(data.userId)
      ) {
        // 只有在服务器中转模式或WebRTC连接失败时才播放服务器中转的音频
        playServerRelayAudio(
          data.userId,
          data.audioData,
          data.sampleRate || 16000
        );
      }
    };

    socket.on('voice:audio-chunk', handleAudioChunk);

    return () => {
      socket.off('voice:offer', handleOffer);
      socket.off('voice:answer', handleAnswer);
      socket.off('voice:ice', handleIceCandidate);
      socket.off('voice:mic-enabled');
      socket.off('voice:audio-chunk', handleAudioChunk);
    };
  }, [
    peerConnectionsRef,
    socket,
    enabled,
    strategy,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    playServerRelayAudio,
  ]);

  // 监听房间成员变化 - 处理新成员加入的情况
  useEffect(() => {
    // 只在WebRTC模式、麦克风开启、有本地流的情况下才处理
    if (
      strategy !== 'webrtc-fallback' ||
      !isMicEnabled ||
      !localStreamRef.current ||
      !socket
    ) {
      return;
    }

    // 检查是否有新成员加入
    const currentPeerIds = Array.from(peerConnectionsRef.current.keys());
    const memberIds = members
      .filter((m) => m.id !== socket.id)
      .map((m) => m.id);

    // 找出新加入的成员（在memberIds中但不在currentPeerIds中）
    const newMemberIds = memberIds.filter((id) => !currentPeerIds.includes(id));

    if (newMemberIds.length > 0) {
      logger.info(
        '[VoiceChat] New members joined, initiating connections:',
        newMemberIds
      );
      newMemberIds.forEach((memberId) => {
        const member = members.find((m) => m.id === memberId);
        if (member) {
          logger.info(
            '[VoiceChat] Initiating connection to new member:',
            member.name,
            member.id
          );
          initiateConnection(member.id);
        }
      });
    }
  }, [
    members,
    strategy,
    isMicEnabled,
    socket,
    initiateConnection,
    localStreamRef,
    peerConnectionsRef,
  ]);

  // 房间变化时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [roomId, cleanup]);

  // 语音被关闭时挂断所有连接并释放麦克风
  useEffect(() => {
    if (!enabled) cleanup();
  }, [enabled, cleanup]);

  return {
    isConnecting,
    isConnected,
    error,
    strategy,
    initiateConnection, // 暴露给外部使用，用于向新加入的成员发起连接
  };
}
