'use client';

/*
 * 房间语音：站点开没开语音、我能不能发言、麦克风 / 扬声器开关，接到语音通话（useVoiceChat）。
 * 换房间、房主收回发言权限时立刻关麦。
 */

import { useEffect, useMemo, useState } from 'react';

import type { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { useVoiceChat } from '../hooks/useVoiceChat';

import type { Room, RoomPermission } from '@/types/watch-room';

export function useRoomVoice(
  room: ReturnType<typeof useWatchRoomContextSafe>,
  current: Room | null,
  can: (permission: RoomPermission) => boolean
) {
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [mic, setMic] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  useEffect(() => {
    setVoiceAvailable(
      Boolean(
        (window.RUNTIME_CONFIG as Record<string, unknown> | undefined)
          ?.ENABLE_ROOM_VOICE
      )
    );
  }, []);
  const canSpeak = voiceAvailable && can('voice');
  useEffect(() => setMic(false), [current?.id]);
  // 房主收回语音发言权限时立刻关麦
  useEffect(() => {
    if (!canSpeak) setMic(false);
  }, [canSpeak]);
  const voiceState = useVoiceChat({
    socket: room?.socket || null,
    roomId: current?.id || null,
    isMicEnabled: canSpeak && mic,
    isSpeakerEnabled: speaker,
    members: room?.members || [],
    enabled: voiceAvailable && !!current,
  });
  const voice = useMemo(
    () => ({
      available: voiceAvailable && !!current,
      canSpeak: canSpeak && !!current,
      mic: canSpeak && mic,
      speaker,
      connecting: voiceState.isConnecting,
      error: voiceState.error,
      toggleMic: () => setMic((value) => !value),
      toggleSpeaker: () => setSpeaker((value) => !value),
    }),
    [
      voiceAvailable,
      canSpeak,
      current,
      mic,
      speaker,
      voiceState.isConnecting,
      voiceState.error,
    ]
  );
  return voice;
}
