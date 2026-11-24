// React Hook for Voice Chat in Watch Room
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import type { WatchRoomSocket } from '@/lib/watch-room-socket';

import {
  decodeRelayChunk,
  encodeMicChunk,
  RELAY_SAMPLE_RATE,
  scheduleRelayChunk,
} from './voice-relay-audio';

import type { Member } from '@/types/watch-room';

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

interface UseVoiceChatOptions {
  socket: WatchRoomSocket | null;
  roomId: string | null;
  isMicEnabled: boolean;
  isSpeakerEnabled: boolean;
  members: Member[];
  /** 站点是否开放语音；关闭时不监听语音事件、不申请麦克风、不播放，已有连接会挂断 */
  enabled: boolean;
}

// 语音聊天策略类型
type VoiceStrategy = 'webrtc-fallback' | 'server-only';

// 获取语音聊天策略配置
function getVoiceStrategy(): VoiceStrategy {
  if (typeof window === 'undefined') return 'webrtc-fallback';
  const strategy =
    window.RUNTIME_CONFIG?.VOICE_CHAT_STRATEGY || 'webrtc-fallback';
  return strategy as VoiceStrategy;
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

  // WebRTC 相关
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(
    new Map()
  );
  const nextPlayTimeRef = useRef<Map<string, number>>(new Map()); // 跟踪每个用户的下一个播放时间
  const disconnectionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map()); // 跟踪连接断开的定时器

  // 服务器中转相关
  // 浏览器直连时是 MediaRecorder；服务器中转时存的是 ScriptProcessorNode（停止时断开）
  const mediaRecorderRef = useRef<MediaRecorder | ScriptProcessorNode | null>(
    null
  );

  // 使用ref存储回退函数，避免循环依赖
  const switchToServerRelayRef = useRef<(() => void) | null>(null);
  const playRemoteStreamRef = useRef<
    ((peerId: string, stream: MediaStream) => void) | null
  >(null);

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
  }, []);

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

  // ==================== WebRTC P2P 逻辑 ====================

  // 创建 RTCPeerConnection
  const createPeerConnection = useCallback(
    (peerId: string) => {
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
            logger.info(
              '[VoiceChat] ICE connection recovery timeout for',
              peerId
            );
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
    },
    [socket, isSpeakerEnabled, strategy]
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
  const stopRemoteStream = useCallback((peerId: string) => {
    const audio = remoteAudioElementsRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioElementsRef.current.delete(peerId);
    }
    remoteStreamsRef.current.delete(peerId);

    // 清除该用户的播放时间记录
    nextPlayTimeRef.current.delete(peerId);
  }, []);

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
    [socket, createPeerConnection]
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
    [socket, createPeerConnection]
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

  // ==================== 服务器中转逻辑 ====================

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
  }, [socket, roomId]);

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
  }, [isMicEnabled, cleanupWebRTC, startServerRelay]);

  // 将回退函数存储到ref中，供createPeerConnection使用
  useEffect(() => {
    switchToServerRelayRef.current = switchToServerRelay;
  }, [switchToServerRelay]);

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
    [isSpeakerEnabled]
  );

  // ==================== 清理函数 ====================

  // 清理所有连接
  const cleanup = useCallback(() => {
    stopLocalStream();
    cleanupWebRTC();
    stopServerRelay();

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 清除播放时间记录
    nextPlayTimeRef.current.clear();

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);

    logger.info('[VoiceChat] All cleaned up');
  }, [stopLocalStream, cleanupWebRTC, stopServerRelay]);

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
  }, [isSpeakerEnabled, playRemoteStream]);

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
  }, [members, strategy, isMicEnabled, socket, initiateConnection]);

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
