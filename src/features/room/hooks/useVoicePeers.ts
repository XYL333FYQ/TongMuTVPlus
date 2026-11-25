'use client';

/*
 * 房间语音：点对点连接。建连接、发 offer / 回 answer / 收 ICE、播放和停掉对方的声音、全部挂断。
 */

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { logger } from '@/lib/logger';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';

import { type VoiceStrategy, createVoicePeer } from './voice-peer';

export function useVoicePeers({
  socket,
  isSpeakerEnabled,
  strategy,
  localStreamRef,
  nextPlayTimeRef,
  setIsConnected,
  setIsConnecting,
  switchToServerRelayRef,
}: {
  socket: WatchRoomSocket | null;
  isSpeakerEnabled: boolean;
  strategy: VoiceStrategy;
  localStreamRef: MutableRefObject<MediaStream | null>;
  nextPlayTimeRef: MutableRefObject<Map<string, number>>;
  setIsConnected: Dispatch<SetStateAction<boolean>>;
  setIsConnecting: Dispatch<SetStateAction<boolean>>;
  switchToServerRelayRef: MutableRefObject<(() => void) | null>;
}) {
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(
    new Map()
  );
  const disconnectionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map()); // 跟踪连接断开的定时器
  const playRemoteStreamRef = useRef<
    ((peerId: string, stream: MediaStream) => void) | null
  >(null);

  // 创建 RTCPeerConnection（状态机在 voice-peer.ts）
  const createPeerConnection = useCallback(
    (peerId: string) =>
      createVoicePeer(peerId, {
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
      }),
    [
      socket,
      isSpeakerEnabled,
      strategy,
      switchToServerRelayRef,
      setIsConnected,
      setIsConnecting,
    ]
  );

  // 播放远程音频流
  const playRemoteStream = useCallback(
    (peerId: string, stream: MediaStream) => {
      let audio = remoteAudioElementsRef.current.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        remoteAudioElementsRef.current.set(peerId, audio);
      }
      audio.srcObject = stream;
    },
    []
  );

  // 将播放函数存储到ref中，供createPeerConnection使用
  useEffect(() => {
    playRemoteStreamRef.current = playRemoteStream;
  }, [playRemoteStream]);

  // 停止播放远程音频流
  const stopRemoteStream = useCallback(
    (peerId: string) => {
      const audio = remoteAudioElementsRef.current.get(peerId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        remoteAudioElementsRef.current.delete(peerId);
      }
      remoteStreamsRef.current.delete(peerId);

      // 清除该用户的播放时间记录
      nextPlayTimeRef.current.delete(peerId);
    },
    [nextPlayTimeRef]
  );

  // 清理WebRTC连接
  const cleanupWebRTC = useCallback(() => {
    // 清除所有断开定时器
    disconnectionTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    disconnectionTimersRef.current.clear();

    // 关闭所有peer connections
    peerConnectionsRef.current.forEach((pc, peerId) => {
      pc.close();
      stopRemoteStream(peerId);
    });
    peerConnectionsRef.current.clear();

    logger.info('[VoiceChat] WebRTC cleaned up');
  }, [stopRemoteStream]);

  // 向对等端发起连接（创建offer）
  const initiateConnection = useCallback(
    async (peerId: string) => {
      if (!socket || !localStreamRef.current) return;

      logger.info('[VoiceChat] Initiating connection to', peerId);
      const pc = createPeerConnection(peerId);

      // 添加本地流
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });

      // 创建offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('voice:offer', {
          targetUserId: peerId,
          offer: offer,
        });
        logger.info('[VoiceChat] Sent offer to', peerId);
      } catch (err) {
        logger.error('[VoiceChat] Failed to create offer:', err);
      }
    },
    [socket, createPeerConnection, localStreamRef]
  );

  // 处理接收到的offer
  const handleOffer = useCallback(
    async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
      if (!socket) return;

      logger.info('[VoiceChat] Received offer from', data.userId);
      const pc = createPeerConnection(data.userId);

      // 如果有本地流，添加音频轨道
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
            logger.info('[VoiceChat] Added local track to answer');
          }
        });
      } else {
        logger.info(
          '[VoiceChat] No local stream, creating answer without sending audio'
        );
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('voice:answer', {
          targetUserId: data.userId,
          answer: answer,
        });
        logger.info('[VoiceChat] Sent answer to', data.userId);
      } catch (err) {
        logger.error('[VoiceChat] Failed to handle offer:', err);
      }
    },
    [socket, createPeerConnection, localStreamRef]
  );

  // 处理接收到的answer
  const handleAnswer = useCallback(
    async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
      logger.info('[VoiceChat] Received answer from', data.userId);
      const pc = peerConnectionsRef.current.get(data.userId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        logger.error('[VoiceChat] Failed to handle answer:', err);
      }
    },
    []
  );

  // 处理接收到的ICE候选
  const handleIceCandidate = useCallback(
    async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        logger.error('[VoiceChat] Failed to add ICE candidate:', err);
      }
    },
    []
  );

  return {
    peerConnectionsRef,
    remoteStreamsRef,
    remoteAudioElementsRef,
    playRemoteStream,
    cleanupWebRTC,
    initiateConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  };
}
