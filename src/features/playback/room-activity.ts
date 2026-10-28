import type { Room } from '@/types/watch-room';

/** Progress and pause updates do not create a new activity. */
export function roomActivityKey(room: Pick<Room, 'id' | 'currentState'>) {
  const state = room.currentState;
  if (!state) return JSON.stringify([room.id, 'idle']);
  if (state.type === 'play')
    return JSON.stringify([
      room.id,
      state.type,
      state.source,
      state.videoId,
      state.episode || 1,
    ]);
  if (state.type === 'live')
    return JSON.stringify([
      room.id,
      state.type,
      state.channelId,
      state.channelUrl,
    ]);
  if (state.type === 'music')
    return JSON.stringify([
      room.id,
      state.type,
      state.song.platform,
      state.song.id,
    ]);
  return JSON.stringify([room.id, state.type, state.startedAt]);
}
