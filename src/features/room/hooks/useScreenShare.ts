'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  type ScreenShareCaptureSettings,
  type ScreenShareQualityPreset,
  captureScreen,
  captureSettingsOf,
  iceServers,
} from './screen-share-media';
import { bindScreenSignaling } from './screen-share-signaling';

// 屏幕共享页从这里拿画质选项（页面测试也按这个模块打桩）
export {
  type ScreenShareCaptureSettings,
  type ScreenShareQualityPreset,
  screenShareQualityOptions,
} from './screen-share-media';

import type { Member, ScreenState } from '@/types/watch-room';

// 没有房间时的成员表：固定一个空数组，依赖它的 effect 不会每次渲染都重跑
const NO_MEMBERS: Member[] = [];

/**
 * 屏幕共享和房间的连接：
 * - 谁能共享看“当前设备的控制权 + 是否跟随”，不看房主账号；常规房间也能共享；
 * - 先拿到采集，再等房间确认 screen:start，之后才给其他设备发画面；失败/房间已切换就释放采集；
 * - 本设备是共享者时只发不收，其余设备（包括同账号的其他设备）都是观众；
 * - 房间不再是共享、切房、退出跟随时，本机采集一并释放。
 */
export function useScreenShare(
  qualityPreset: ScreenShareQualityPreset = 'smooth'
) {
  const watchRoom = useWatchRoomContextSafe();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const stoppingRef = useRef(false);
  const localSharingRef = useRef(false);
  const roomSawSharing = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLocalSharing, setIsLocalSharing] = useState(false);
  const [captureSettings, setCaptureSettings] =
    useState<ScreenShareCaptureSettings | null>(null);

  const currentRoom = watchRoom?.currentRoom || null;
  const socket = watchRoom?.socket || null;
  const isConnected = watchRoom?.isConnected || false;
  const members = watchRoom?.members ?? NO_MEMBERS;
  const currentState = currentRoom?.currentState;
  const isSharing =
    currentState?.type === 'screen' && currentState.status === 'sharing';
  const canShare = Boolean(currentRoom && watchRoom?.canControl);

  // 异步回调里要看“现在”的房间和权限，不能用发起时的闭包
  const latest = useRef({
    watchRoom,
    roomId: currentRoom?.id,
    canShare,
    members,
    roomSharing: isSharing,
  });
  latest.current = {
    watchRoom,
    roomId: currentRoom?.id,
    canShare,
    members,
    roomSharing: isSharing,
  };

  const closePeerConnection = useCallback((userId: string) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (!pc) return;

    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.close();
    peerConnectionsRef.current.delete(userId);
  }, []);

  const clearRemoteVideo = useCallback(() => {
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((_pc, userId) =>
      closePeerConnection(userId)
    );
    peerConnectionsRef.current.clear();
  }, [closePeerConnection]);

  const cleanupSharingResources = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    closeAllPeerConnections();

    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      displayStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    localSharingRef.current = false;
    roomSawSharing.current = false;
    setIsLocalSharing(false);
    setCaptureSettings(null);
    clearRemoteVideo();
    stoppingRef.current = false;
  }, [clearRemoteVideo, closeAllPeerConnections]);

  const stopSharing = useCallback(
    (notifyServer = true) => {
      const wasSharing = localSharingRef.current;
      const roomId = latest.current.roomId;
      cleanupSharingResources();

      // 主持设备刷新后采集已经丢了，房间却还显示“共享中”：
      // 有控制权的设备也可以结束这场没人在采集的共享
      const endsLeftBehind =
        !wasSharing && latest.current.canShare && latest.current.roomSharing;
      if (notifyServer && (wasSharing || endsLeftBehind) && roomId) {
        latest.current.watchRoom
          ?.roomCommand('screen:stop', { roomId })
          .catch((err: unknown) => {
            if (latest.current.roomId === roomId)
              setError(err instanceof Error ? err.message : '停止共享未成功');
          });
      }
    },
    [cleanupSharingResources]
  );

  const createPeerConnection = useCallback(
    (userId: string, senderMode: boolean) => {
      const existing = peerConnectionsRef.current.get(userId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('screen:ice', {
            targetUserId: userId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      const displayStream = displayStreamRef.current;
      if (senderMode && displayStream) {
        displayStream.getTracks().forEach((track) => {
          pc.addTrack(track, displayStream);
        });
      } else {
        pc.ontrack = (event) => {
          const stream = event.streams[0];
          remoteStreamRef.current = stream;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        };
      }

      peerConnectionsRef.current.set(userId, pc);
      return pc;
    },
    [socket]
  );

  const sendOfferToMember = useCallback(
    async (memberId: string) => {
      if (!socket || !displayStreamRef.current) return;

      try {
        const pc = createPeerConnection(memberId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('screen:offer', {
          targetUserId: memberId,
          offer,
        });
      } catch (err) {
        logger.error('[ScreenShare] Failed to send offer:', err);
        setError('无法建立屏幕共享连接');
      }
    },
    [createPeerConnection, socket]
  );

  const startSharing = useCallback(async () => {
    const start = latest.current;
    const room = start.watchRoom?.currentRoom;
    if (!start.watchRoom || !room || localSharingRef.current) return;
    if (!start.watchRoom.canControl) {
      setError('房主没有开放成员控制播放');
      return;
    }

    const roomId = room.id;
    setIsStarting(true);
    setError(null);

    let stream: MediaStream | null = null;
    try {
      stream = await captureScreen(qualityPreset);

      // 选屏幕期间房间换了、或本设备不再有资格：不把画面共享进新房间
      if (latest.current.roomId !== roomId || !latest.current.canShare) {
        stream.getTracks().forEach((track) => track.stop());
        setError('房间已切换或失去控制权，未开始共享');
        return;
      }

      displayStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setCaptureSettings(captureSettingsOf(videoTrack));
        videoTrack.onended = () => {
          stopSharing(true);
        };
      }

      const state: ScreenState = {
        type: 'screen',
        status: 'sharing',
        ownerName: room.ownerName,
        hasAudio: stream.getAudioTracks().length > 0,
        startedAt: Date.now(),
      };

      // 房间确认之后才算共享，确认前不给任何人发画面
      await start.watchRoom.roomCommand('screen:start', { ...state, roomId });
      if (
        latest.current.roomId !== roomId ||
        displayStreamRef.current !== stream
      ) {
        cleanupSharingResources();
        return;
      }
      localSharingRef.current = true;
      setIsLocalSharing(true);

      await Promise.all(
        latest.current.members
          .filter((member) => member.id !== socket?.id)
          .map((member) => sendOfferToMember(member.id))
      );
    } catch (err) {
      logger.error('[ScreenShare] Failed to start sharing:', err);
      if (displayStreamRef.current === stream) cleanupSharingResources();
      else stream?.getTracks().forEach((track) => track.stop());
      setError((err as Error | null)?.message || '开启屏幕共享失败');
    } finally {
      setIsStarting(false);
    }
  }, [
    cleanupSharingResources,
    qualityPreset,
    sendOfferToMember,
    socket,
    stopSharing,
  ]);

  useEffect(() => {
    if (!socket || !currentRoom) return;

    return bindScreenSignaling(socket, {
      localSharingRef,
      peerConnectionsRef,
      displayStreamRef,
      createPeerConnection,
      closeAllPeerConnections,
      clearRemoteVideo,
      sendOfferToMember,
      setError,
    });
  }, [
    clearRemoteVideo,
    closeAllPeerConnections,
    createPeerConnection,
    currentRoom,
    sendOfferToMember,
    socket,
  ]);

  // 本地预览 <video> 可能比采集晚挂载（刷新后重新开始共享，或房间快照先于确认到达），
  // 采集开始那一刻没有元素可赋值，这里每次渲染后补上
  useEffect(() => {
    const preview = localVideoRef.current;
    const stream = displayStreamRef.current;
    if (isLocalSharing && preview && stream && preview.srcObject !== stream)
      preview.srcObject = stream;
  });

  // 有新成员进房间就补发画面，离开的成员关掉连接
  useEffect(() => {
    if (!isLocalSharing || !isSharing || !displayStreamRef.current) return;

    members
      .filter((member) => member.id !== socket?.id)
      .forEach((member) => {
        if (!peerConnectionsRef.current.has(member.id)) {
          sendOfferToMember(member.id);
        }
      });

    Array.from(peerConnectionsRef.current.keys()).forEach((userId) => {
      const stillInRoom = members.some(
        (member) => member.id === userId && member.id !== socket?.id
      );
      if (!stillInRoom) {
        closePeerConnection(userId);
      }
    });
  }, [
    closePeerConnection,
    isLocalSharing,
    isSharing,
    members,
    sendOfferToMember,
    socket,
  ]);

  // 房间不再是共享（被停止、被清空、主持换了）：本机采集一并释放
  useEffect(() => {
    if (isSharing) {
      if (localSharingRef.current) roomSawSharing.current = true;
      return;
    }
    if (localSharingRef.current && roomSawSharing.current)
      cleanupSharingResources();
  }, [cleanupSharingResources, isLocalSharing, isSharing]);

  // 切房、卸载：采集不跟到别的房间
  useEffect(() => {
    return () => {
      cleanupSharingResources();
    };
  }, [cleanupSharingResources, currentRoom?.id]);

  // 观众：房间在共享，就向共享设备要画面
  useEffect(() => {
    if (!socket || !currentRoom || isLocalSharing || !isConnected) return;
    if (currentState?.type !== 'screen' || currentState.status !== 'sharing')
      return;

    socket.emit('screen:viewer-ready');
  }, [currentRoom, currentState, isConnected, isLocalSharing, socket]);

  return {
    currentRoom,
    canShare,
    isLocalSharing,
    isSharing,
    isStarting,
    error,
    captureSettings,
    localVideoRef,
    remoteVideoRef,
    startSharing,
    stopSharing,
  };
}
