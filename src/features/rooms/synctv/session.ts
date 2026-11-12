import type { PlaybackPort } from '@/features/playback/port';
import { RoomPlaybackAdapter } from '../RoomPlaybackAdapter';
import { TogetherApi } from './api';
import { SyncedClock } from './clock';
import { synctv } from './protocol/client';
import { RoomRealtimeClient } from './realtime';
import { operationId } from './identifiers';

export interface TogetherRoomSnapshot {
  roomId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'terminated';
  following: boolean;
  canControlPlayback: boolean;
  resources: Record<string, synctv.client.IResourceEvent>;
}
type Options = {
  api: TogetherApi;
  port: PlaybackPort;
  origin: string;
  selectMedia: (mediaId: string, signal: AbortSignal) => Promise<void>;
  duration: () => number;
  onChange: (snapshot: TogetherRoomSnapshot) => void;
  onError: (error: unknown) => void;
};
/** Root-owned room lifecycle; leaving the page does not leave membership or stop playback. */
export class TogetherRoomSession {
  private client: RoomRealtimeClient;
  private adapter: RoomPlaybackAdapter;
  private clock = new SyncedClock();
  private abort = new AbortController();
  private clockTimer?: ReturnType<typeof setInterval>;
  private correctionTimer?: ReturnType<typeof setInterval>;
  private clockPending = false;
  private started = false;
  private disposed = false;
  private snapshot: TogetherRoomSnapshot;
  constructor(readonly roomId: string, private options: Options) {
    this.snapshot = {
      roomId,
      status: 'connecting',
      following: true,
      canControlPlayback: false,
      resources: {},
    };
    this.client = new RoomRealtimeClient(roomId, {
      origin: options.origin,
      ticket: (id, signal) => options.api.ticket(id, signal),
      onMessage: (message) => this.receive(message),
      onStatus: (status) => {
        this.publish({ status });
        if (status === 'connected') void this.syncClock();
        if (status === 'terminated') this.dispose();
      },
    });
    this.adapter = new RoomPlaybackAdapter(roomId, options.port, {
      send: (message) => this.client.send(message),
      selectMedia: options.selectMedia,
      now: () => this.clock.now(),
      duration: options.duration,
      uuid: operationId,
      onError: options.onError,
    });
  }
  private publish(update: Partial<TogetherRoomSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...update };
    this.options.onChange(this.snapshot);
  }
  private async syncClock() {
    if (this.disposed || this.clockPending) return;
    this.clockPending = true;
    try {
      await this.options.api.syncClock(this.clock, this.abort.signal);
    } catch {
      /* A failed calibration must not terminate a healthy room transport. */
    } finally {
      this.clockPending = false;
    }
  }
  start() {
    if (this.disposed || this.started) return;
    this.started = true;
    for (const request of [
      { observeId: 'playback_state', playbackState: {} },
      { observeId: 'room_settings', roomSettings: {} },
      { observeId: 'self_member', selfRoomMember: {} },
      { observeId: 'online_count', onlineCount: {} },
    ])
      this.client.observe({ ...request, deliveryMode: 2 });
    this.clockTimer = setInterval(() => {
      void this.syncClock();
    }, 30000);
    this.correctionTimer = setInterval(() => {
      void this.adapter.correct();
    }, 2000);
    this.client.start();
  }
  private receive(message: synctv.client.IServerMessage) {
    if (this.disposed) return;
    if (message.error?.clientOperationId)
      void this.adapter.reject(message.error.clientOperationId);
    const resource = message.resourceEvent;
    if (!resource?.observeId) return;
    this.publish({
      resources: { ...this.snapshot.resources, [resource.observeId]: resource },
    });
    if (resource.selfRoomMember) {
      const value = resource.selfRoomMember.permissions;
      const valid =
        value != null &&
        (typeof value !== 'number' || Number.isSafeInteger(value));
      const permitted =
        valid &&
        (BigInt(value!.toString()) & (BigInt(1) << BigInt(10))) !== BigInt(0);
      this.adapter.permissions(permitted);
      this.publish({ canControlPlayback: permitted });
    }
    if (resource.playback)
      this.adapter.live(resource.playback.playbackKind === 2);
    if (resource.playbackState)
      void this.adapter.receive(resource.playbackState);
  }
  observe(request: synctv.client.IObserveResource) {
    return this.client.observe(request);
  }
  send(message: synctv.client.IClientMessage) {
    this.client.send(message);
  }
  async follow(value: boolean) {
    this.publish({ following: value });
    await this.adapter.follow(value);
  }
  async leave() {
    this.dispose();
    await this.options.api.request('/rooms/' + this.roomId + '/membership', {
      method: 'DELETE',
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    clearInterval(this.clockTimer);
    clearInterval(this.correctionTimer);
    this.client.stop();
    this.adapter.dispose();
    this.clock.reset();
  }
}
