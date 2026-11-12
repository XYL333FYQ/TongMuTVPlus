import type { PlaybackEvent, PlaybackPort } from '@/features/playback/port';
import { synctv } from './synctv/protocol/client';
import { PlaybackOperations } from './synctv/operations';

type State = synctv.client.IPlaybackState;
type Options = {
  send: (message: synctv.client.IClientMessage) => void;
  selectMedia: (mediaId: string, signal: AbortSignal) => Promise<void>;
  now: () => number;
  duration: () => number;
  uuid: () => string;
  onError: (error: unknown) => void;
};
/** Room-owned adapter; the personal player imports no room state or protocol. */
export class RoomPlaybackAdapter {
  private state?: State;
  private following = true;
  private canControl = false;
  private isLive = false;
  private freeMode = false;
  private disposed = false;
  private generation = 0;
  private selectedId = '';
  private applying = false;
  private selectionAbort = new AbortController();
  private operations = new PlaybackOperations<State>();
  private unsubscribe: () => void;
  constructor(
    readonly roomId: string,
    private port: PlaybackPort,
    private options: Options
  ) {
    this.unsubscribe = port.subscribe((event) => this.local(event));
  }
  permissions(canControl: boolean) {
    this.canControl = canControl;
  }
  live(value: boolean) {
    this.isLive = value;
  }
  setFreeMode(value: boolean) {
    this.freeMode = value;
  }
  async follow(value: boolean) {
    this.following = value;
    this.generation++;
    this.selectionAbort.abort();
    this.applying = false;
    this.operations.clear();
    if (!value) {
      this.selectedId = '';
      return;
    }
    if (this.state) await this.apply(true);
  }
  async receive(incoming: State, forceSeek = false) {
    if (this.disposed || incoming.roomId !== this.roomId) return;
    if (
      this.state?.version != null &&
      incoming.version != null &&
      BigInt(incoming.version.toString()) <
        BigInt(this.state.version.toString())
    )
      return;
    if (incoming.clientOperationId) {
      const resolution = this.operations.acknowledge(
        incoming.clientOperationId,
        incoming
      );
      if (resolution.handled && !resolution.state) return;
    }
    this.state = incoming;
    if (this.following) await this.apply(forceSeek);
  }
  async reject(operationId: string) {
    const resolution = this.operations.reject(operationId);
    if (resolution.state) {
      this.state = resolution.state;
      if (this.following) await this.apply(true);
    }
  }
  async correct() {
    if (!this.applying && !this.freeMode && this.following && this.state) await this.apply();
  }
  private async apply(forceSeek = false) {
    const state = this.state;
    if (this.disposed || !this.following || !state) return;
    this.selectionAbort.abort();
    this.selectionAbort = new AbortController();
    if (!state.playingMediaId) {
      this.generation++;
      this.selectedId = '';
      this.applying = false;
      if (this.port.read().ready) this.port.pause('remote');
      return;
    }
    const generation = ++this.generation;
    const current = () =>
      !this.disposed &&
      this.following &&
      generation === this.generation &&
      state === this.state;
    this.applying = true;
    try {
      if (this.selectedId !== state.playingMediaId) {
        await this.options.selectMedia(
          state.playingMediaId,
          this.selectionAbort.signal
        );
        if (!current()) return;
        this.selectedId = state.playingMediaId;
        forceSeek = true;
      }
      if (!current() || !this.port.read().ready) return;
      const speed =
        state.speed && Number.isFinite(state.speed) && state.speed > 0
          ? state.speed
          : 1;
      this.port.setRate(speed, 'remote');
      const base =
        state.position && Number.isFinite(state.position) && state.position > 0
          ? state.position
          : 0;
      const anchor =
        state.generatedAtMillis == null
          ? 0
          : Number(state.generatedAtMillis.toString());
      let position =
        base +
        (state.isPlaying && anchor > 0
          ? (Math.max(0, this.options.now() - anchor) / 1000) * speed
          : 0);
      const duration = this.options.duration();
      const atEnd = !this.isLive && duration > 0 && position >= duration;
      if (duration > 0) position = Math.min(position, duration);
      const playing = !atEnd && !!state.isPlaying;
      if (!playing) this.port.pause('remote');
      if (!this.isLive) {
        const drift = Math.abs(this.port.read().currentTime - position);
        // Pinned upstream defaults: automatic1.2s, explicit seek0.2s; free mode skips automatic seek.
        if (
          atEnd ||
          (forceSeek && drift >= 0.2) ||
          (!this.freeMode && drift > 1.2)
        )
          this.port.seek(position, 'remote');
      }
      if (playing && current()) await this.port.play('remote');
    } catch (error) {
      if (current()) this.options.onError(error);
    } finally {
      if (generation === this.generation) this.applying = false;
    }
  }
  private local(event: PlaybackEvent) {
    const previous = this.state;
    if (
      this.disposed ||
      !this.following ||
      !this.canControl ||
      this.applying ||
      event.origin !== 'local' ||
      !previous?.playingMediaId ||
      !event.state.ready
    )
      return;
    const types = { play: 1, pause: 2, seeked: 3, ratechange: 4, ended: 2 };
    if (this.isLive && event.type === 'seeked') return;
    const operationId = this.options.uuid();
    this.operations.remember(operationId, previous);
    try {
      this.options.send({
        playbackStateUpdate: {
          type: types[event.type],
          playing: event.state.playing,
          ...(this.isLive ? {} : { position: event.state.currentTime }),
          ...(event.type === 'ratechange'
            ? { speed: event.state.playbackRate }
            : {}),
          expectedMediaId: previous.playingMediaId,
          expectedPlaylistId: previous.playingPlaylistId || '',
          expectedTargetHash: previous.targetHash || '',
          clientOperationId: operationId,
          clientTimeMillis: Math.floor(this.options.now()),
        },
      });
    } catch (error) {
      void this.reject(operationId);
      this.options.onError(error);
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.selectionAbort.abort();
    this.operations.clear();
    this.unsubscribe();
  }
}
