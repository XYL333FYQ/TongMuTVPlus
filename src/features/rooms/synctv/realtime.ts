import { synctv } from './protocol/client';
import { ReconnectPolicy } from './clock';

type Options = {
  origin: string;
  ticket: (
    roomId: string,
    signal: AbortSignal
  ) => Promise<{ ticket: string; roomId: string }>;
  socket?: (url: string) => WebSocket;
  onMessage: (message: synctv.client.ServerMessage) => void;
  onStatus?: (
    status: 'connecting' | 'connected' | 'disconnected' | 'terminated'
  ) => void;
  random?: () => number;
};
const cursorFields = [
  'roomSettings',
  'playlistItems',
  'playbackHistory',
  'roomMemberEvents',
  'chatEvents',
  'chatPinEvents',
  'selfRoomMember',
] as const;
/** Native WebSocket transport following pinned upstream reconnect/observation semantics. */
export class RoomRealtimeClient {
  private stopped = true;
  private generation = 0;
  private controller = new AbortController();
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private detach = () => undefined as void;
  private policy: ReconnectPolicy;
  private observations = new Map<
    string,
    {
      request: synctv.client.ObserveResource;
      cursor?: NonNullable<synctv.client.IEventCursor['sequence']>;
    }
  >();
  constructor(readonly roomId: string, private options: Options) {
    if (!/^room_[A-Za-z0-9]{1,59}$/.test(roomId)) throw new Error('无效的房间');
    this.policy = new ReconnectPolicy(options.random);
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.controller = new AbortController();
    void this.connect();
  }
  stop() {
    this.stopped = true;
    this.generation++;
    this.controller.abort();
    clearTimeout(this.retry);
    this.cleanup();
  }
  private cleanup() {
    clearInterval(this.heartbeat);
    clearTimeout(this.timeout);
    this.detach();
    this.detach = () => undefined;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
  send(message: synctv.client.IClientMessage) {
    if (this.stopped || this.socket?.readyState !== 1)
      throw new Error('房间连接尚未就绪');
    this.socket.send(synctv.client.ClientMessage.encode(message).finish());
  }
  observe(request: synctv.client.IObserveResource) {
    if (!request.observeId) throw new Error('缺少订阅标识');
    const previous = this.observations.get(request.observeId);
    this.observations.set(request.observeId, {
      request: synctv.client.ObserveResource.decode(
        synctv.client.ObserveResource.encode(request).finish()
      ),
      cursor: previous?.cursor,
    });
    if (this.socket?.readyState === 1) this.replay(request.observeId);
    return () => {
      this.observations.delete(request.observeId!);
      if (this.socket?.readyState === 1)
        this.send({ unobserveResource: { observeId: request.observeId } });
    };
  }
  private replay(id: string, fresh = false) {
    const entry = this.observations.get(id);
    if (!entry) return;
    const request = synctv.client.ObserveResource.decode(
      synctv.client.ObserveResource.encode(entry.request).finish()
    );
    for (const field of cursorFields)
      if (request[field] && (fresh || entry.cursor !== undefined))
        request[field]!.afterEventSequence = fresh ? 0 : entry.cursor;
    this.send({ observeResource: request });
  }
  private receive(data: unknown) {
    if (!(data instanceof ArrayBuffer) || data.byteLength > 2 * 1024 * 1024)
      throw new Error('无效的房间消息');
    const message = synctv.client.ServerMessage.decode(new Uint8Array(data));
    const update = message.resourceEvent || message.resourceObserved;
    if (update?.observeId && update.eventCursor?.sequence != null) {
      const entry = this.observations.get(update.observeId),
        next = update.eventCursor.sequence.toString();
      if (
        entry &&
        (entry.cursor === undefined ||
          BigInt(next) > BigInt(entry.cursor.toString()))
      )
        entry.cursor = update.eventCursor.sequence;
    }
    const error = message.resourceObserveError;
    if (
      error?.observeId &&
      /cursor expired/i.test(
        (error.error?.message || '') + ' ' + (error.error?.detail || '')
      )
    ) {
      const entry = this.observations.get(error.observeId);
      if (entry) {
        entry.cursor = undefined;
        this.replay(error.observeId, true);
      }
    }
    if (message.termination) {
      this.stop();
      this.options.onStatus?.('terminated');
    }
    this.options.onMessage(message);
  }
  private async connect() {
    if (this.stopped) return;
    const generation = ++this.generation;
    const current = () => !this.stopped && this.generation === generation;
    this.options.onStatus?.('connecting');
    const failed = () => {
      if (!current()) return;
      this.generation++;
      this.cleanup();
      this.options.onStatus?.('disconnected');
      this.retry = setTimeout(() => {
        void this.connect();
      }, this.policy.next());
    };
    try {
      const ticket = await this.options.ticket(
        this.roomId,
        this.controller.signal
      );
      if (!current()) return;
      if (ticket.roomId !== this.roomId || !ticket.ticket)
        throw new Error('无效的房间凭证');
      const url = new URL('/sync/ws/' + this.roomId, this.options.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('ticket', ticket.ticket);
      const socket = (this.options.socket || ((value) => new WebSocket(value)))(
        url.href
      );
      this.socket = socket;
      socket.binaryType = 'arraybuffer';
      const open = () => {
        if (!current()) return;
        clearTimeout(this.timeout);
        this.policy.reset();
        try {
          for (const id of this.observations.keys()) this.replay(id);
          this.heartbeat = setInterval(() => {
            try {
              this.send({ heartbeat: { timestamp: Date.now() } });
            } catch {
              failed();
            }
          }, 25000);
          this.options.onStatus?.('connected');
        } catch {
          failed();
        }
      };
      const message = (event: MessageEvent) => {
        if (current()) {
          try {
            this.receive(event.data);
          } catch {
            failed();
          }
        }
      };
      socket.addEventListener('open', open);
      socket.addEventListener('message', message);
      socket.addEventListener('error', failed);
      socket.addEventListener('close', failed);
      this.detach = () => {
        socket.removeEventListener('open', open);
        socket.removeEventListener('message', message);
        socket.removeEventListener('error', failed);
        socket.removeEventListener('close', failed);
      };
      this.timeout = setTimeout(failed, 10000);
    } catch (error) {
      if (!current()) return;
      if (
        [401, 403, 404].includes((error as { status?: number }).status || 0)
      ) {
        this.stop();
        this.options.onStatus?.('terminated');
      } else failed();
    }
  }
}
