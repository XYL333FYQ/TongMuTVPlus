/*
 * 屏幕共享的信令：共享者收观众的 answer / ICE、给新来的观众发 offer；观众收 offer 回 answer。
 * 共享停止或断线时，观众这边关掉连接、清空画面。返回取消订阅。
 */

import type { MutableRefObject } from 'react';

import { logger } from '@/lib/logger';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';

export interface ScreenSignalingDeps {
  localSharingRef: MutableRefObject<boolean>;
  peerConnectionsRef: MutableRefObject<Map<string, RTCPeerConnection>>;
  displayStreamRef: MutableRefObject<MediaStream | null>;
  createPeerConnection: (
    userId: string,
    initiator: boolean
  ) => RTCPeerConnection;
  closeAllPeerConnections: () => void;
  clearRemoteVideo: () => void;
  sendOfferToMember: (userId: string) => unknown;
  setError: (message: string | null) => void;
}

export function bindScreenSignaling(
  socket: WatchRoomSocket,
  {
    localSharingRef,
    peerConnectionsRef,
    displayStreamRef,
    createPeerConnection,
    closeAllPeerConnections,
    clearRemoteVideo,
    sendOfferToMember,
    setError,
  }: ScreenSignalingDeps
) {
  const handleOffer = async (data: {
    userId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    // 共享者只发不收；其余设备都是观众
    if (localSharingRef.current) return;

    try {
      const pc = createPeerConnection(data.userId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('screen:answer', {
        targetUserId: data.userId,
        answer,
      });
    } catch (err) {
      logger.error('[ScreenShare] Failed to handle offer:', err);
      setError('接收共享画面失败');
    }
  };

  const handleAnswer = async (data: {
    userId: string;
    answer: RTCSessionDescriptionInit;
  }) => {
    if (!localSharingRef.current) return;

    const pc = peerConnectionsRef.current.get(data.userId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (err) {
      logger.error('[ScreenShare] Failed to handle answer:', err);
    }
  };

  const handleIce = async (data: {
    userId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    const pc = peerConnectionsRef.current.get(data.userId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      logger.error('[ScreenShare] Failed to handle ICE:', err);
    }
  };

  const handleScreenStop = () => {
    if (!localSharingRef.current) {
      closeAllPeerConnections();
      clearRemoteVideo();
    }
  };

  const handleSocketDisconnect = () => {
    if (!localSharingRef.current) {
      closeAllPeerConnections();
      clearRemoteVideo();
    }
  };

  const handleViewerReady = (data: { userId: string }) => {
    if (!localSharingRef.current || !displayStreamRef.current) return;
    sendOfferToMember(data.userId);
  };

  socket.on('screen:offer', handleOffer);
  socket.on('screen:answer', handleAnswer);
  socket.on('screen:ice', handleIce);
  socket.on('screen:stop', handleScreenStop);
  socket.on('screen:viewer-ready', handleViewerReady);
  socket.on('disconnect', handleSocketDisconnect);

  return () => {
    socket.off('screen:offer', handleOffer);
    socket.off('screen:answer', handleAnswer);
    socket.off('screen:ice', handleIce);
    socket.off('screen:stop', handleScreenStop);
    socket.off('screen:viewer-ready', handleViewerReady);
    socket.off('disconnect', handleSocketDisconnect);
  };
}
