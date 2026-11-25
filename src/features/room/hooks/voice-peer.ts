/*
 * 房间语音的点对点连接：ICE 服务器、用哪种策略、建一条连接并管它的状态——
 * 连上了算接通；断开给 5 秒恢复；彻底失败时，别的连接也都不通才整体切服务器中转，否则只关这一条。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { logger } from '@/lib/logger';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';

// ICE服务器配置（使用多个免费的STUN服务器作为备份）
const ICE_SERVERS: RTCIceServer[] = [
  // Cloudflare STUN 服务器（主选，全球 CDN）
  { urls: 'stun:stun.cloudflare.com:3478' },
  // Numb/Viagenie（备选，老牌稳定服务）
  { urls: 'stun:stun.numb.viagenie.ca:3478' },
  // Annatel（备选）
  { urls: 'stun:stun.annatel.net:3478' },
  // Google STUN 服务器（最后备选）
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// 语音聊天策略类型
export type VoiceStrategy = 'webrtc-fallback' | 'server-only';

// 获取语音聊天策略配置
export function getVoiceStrategy(): VoiceStrategy {
  if (typeof window === 'undefined') return 'webrtc-fallback';
  const strategy =
    window.RUNTIME_CONFIG?.VOICE_CHAT_STRATEGY || 'webrtc-fallback';
  return strategy as VoiceStrategy;
}

export interface VoicePeerDeps {
  socket: WatchRoomSocket | null;
  isSpeakerEnabled: boolean;
  strategy: VoiceStrategy;
  peerConnectionsRef: MutableRefObject<Map<string, RTCPeerConnection>>;
  remoteStreamsRef: MutableRefObject<Map<string, MediaStream>>;
  disconnectionTimersRef: MutableRefObject<Map<string, NodeJS.Timeout>>;
  playRemoteStreamRef: MutableRefObject<
    ((peerId: string, stream: MediaStream) => void) | null
  >;
  switchToServerRelayRef: MutableRefObject<(() => void) | null>;
  setIsConnected: Dispatch<SetStateAction<boolean>>;
  setIsConnecting: Dispatch<SetStateAction<boolean>>;
}

export function createVoicePeer(
  peerId: string,
  {
    socket,
    isSpeakerEnabled,
    strategy,
    peerConnectionsRef,
    remoteStreamsRef,
    disconnectionTimersRef,
    playRemoteStreamRef,
    switchToServerRelayRef,
    setIsConnected,
    setIsConnecting,
  }: VoicePeerDeps
) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // ICE候选收集
  pc.onicecandidate = (event) => {
    if (event.candidate && socket) {
      socket.emit('voice:ice', {
        targetUserId: peerId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  // 接收远程音频流
  pc.ontrack = (event) => {
    logger.info('[VoiceChat] Received remote track from', peerId);
    const remoteStream = event.streams[0];
    remoteStreamsRef.current.set(peerId, remoteStream);

    // 创建音频元素播放远程流
    if (isSpeakerEnabled) {
      playRemoteStreamRef.current?.(peerId, remoteStream);
    }
  };

  // ICE 连接状态变化 - 更准确地反映连接质量
  pc.oniceconnectionstatechange = () => {
    logger.info(
      '[VoiceChat] ICE connection state with',
      peerId,
      ':',
      pc.iceConnectionState
    );

    if (
      pc.iceConnectionState === 'connected' ||
      pc.iceConnectionState === 'completed'
    ) {
      // 连接成功，清除断开定时器
      const timer = disconnectionTimersRef.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        disconnectionTimersRef.current.delete(peerId);
      }
      setIsConnected(true);
      setIsConnecting(false);
    } else if (pc.iceConnectionState === 'disconnected') {
      // 连接断开，但给它5秒恢复时间
      logger.info(
        '[VoiceChat] ICE disconnected for',
        peerId,
        ', waiting for recovery...'
      );

      // 清除之前的定时器(如果有)
      const existingTimer = disconnectionTimersRef.current.get(peerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 设置新的定时器
      const timer = setTimeout(() => {
        logger.info('[VoiceChat] ICE connection recovery timeout for', peerId);
        // 5秒后仍未恢复，检查是否所有连接都断开了
        if (
          strategy === 'webrtc-fallback' &&
          pc.iceConnectionState === 'disconnected'
        ) {
          // 检查是否还有其他活跃的连接
          let hasActiveConnection = false;
          peerConnectionsRef.current.forEach((otherPc, otherPeerId) => {
            if (otherPeerId !== peerId) {
              const state = otherPc.iceConnectionState;
              if (
                state === 'connected' ||
                state === 'completed' ||
                state === 'checking'
              ) {
                hasActiveConnection = true;
              }
            }
          });

          // 只有当所有连接都断开时才切换到服务器中转
          if (!hasActiveConnection) {
            logger.info(
              '[VoiceChat] All ICE connections failed, switching to server relay'
            );
            switchToServerRelayRef.current?.();
          } else {
            logger.info(
              '[VoiceChat] Other connections still active, not switching to server relay'
            );
            // 只关闭这个失败的连接
            pc.close();
            peerConnectionsRef.current.delete(peerId);
          }
        }
        disconnectionTimersRef.current.delete(peerId);
      }, 5000); // 给5秒恢复时间

      disconnectionTimersRef.current.set(peerId, timer);
    } else if (pc.iceConnectionState === 'failed') {
      // ICE 连接彻底失败
      logger.info('[VoiceChat] ICE connection failed for', peerId);
      if (strategy === 'webrtc-fallback') {
        // 检查是否还有其他活跃的连接
        let hasActiveConnection = false;
        peerConnectionsRef.current.forEach((otherPc, otherPeerId) => {
          if (otherPeerId !== peerId) {
            const state = otherPc.iceConnectionState;
            if (
              state === 'connected' ||
              state === 'completed' ||
              state === 'checking'
            ) {
              hasActiveConnection = true;
            }
          }
        });

        if (!hasActiveConnection) {
          logger.info(
            '[VoiceChat] All ICE connections failed, switching to server relay'
          );
          switchToServerRelayRef.current?.();
        } else {
          logger.info(
            '[VoiceChat] Other connections still active, not switching to server relay'
          );
          // 只关闭这个失败的连接
          pc.close();
          peerConnectionsRef.current.delete(peerId);
        }
      }
    }
  };

  // 连接状态变化 - 作为辅助监控
  pc.onconnectionstatechange = () => {
    logger.info(
      '[VoiceChat] Connection state with',
      peerId,
      ':',
      pc.connectionState
    );
    if (pc.connectionState === 'connected') {
      setIsConnected(true);
      setIsConnecting(false);
    } else if (pc.connectionState === 'failed') {
      // 只在 failed 状态时切换，不在 disconnected 时切换
      if (strategy === 'webrtc-fallback') {
        logger.info(
          '[VoiceChat] Connection failed, falling back to server relay'
        );
        switchToServerRelayRef.current?.();
      }
    }
  };

  peerConnectionsRef.current.set(peerId, pc);
  return pc;
}
