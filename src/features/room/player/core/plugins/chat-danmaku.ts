/*
 * 房间聊天弹幕：消息飘过画面，全屏时控制条里有“弹”开关和发弹幕的输入框。
 * 画面和输入框都挂在播放器自己的节点里，所以全屏下照样看得见、输得进。
 * 弹幕自己用一层 DOM 动画画（不依赖弹幕插件的内部状态），暂停时停在原处、不堆积。
 */

import './chat-danmaku.css';
import type { PlayerPlugin } from '../WatchPlayer';

export interface ChatDanmakuOptions {
  enabled: boolean;
  canSend: boolean;
  send(text: string): Promise<unknown>;
  onToggle(on: boolean): void;
  /** 自己发的也飘出来 */
  showSelf: boolean;
}

const LANE_HEIGHT = 30;
const SELF_KEY = 'tm-together-dm-self';

function readShowSelf() {
  try {
    return localStorage.getItem(SELF_KEY) !== 'false';
  } catch {
    return true;
  }
}
const MAX_ON_SCREEN = 40;

export class ChatDanmaku {
  private options: ChatDanmakuOptions = {
    enabled: true,
    canSend: false,
    send: async () => undefined,
    onToggle: () => undefined,
    showSelf: readShowSelf(),
  };
  private layer: HTMLElement | null = null;
  private art: any = null;
  private lanes: number[] = [];
  private running = new Set<Animation>();
  private sync: (() => void) | null = null;

  configure(next: Partial<ChatDanmakuOptions>) {
    this.options = { ...this.options, ...next };
    this.sync?.();
    if (!this.options.enabled) this.clear();
  }

  clear() {
    this.running.forEach((animation) => animation.cancel());
    this.running.clear();
    this.lanes = [];
    this.layer?.replaceChildren();
  }

  get showSelf() {
    return this.options.showSelf;
  }

  /** 开关“显示我自己发的”，记在本机 */
  setShowSelf(on: boolean) {
    this.configure({ showSelf: on });
    try {
      localStorage.setItem(SELF_KEY, String(on));
    } catch {
      // 存不下也不影响本次
    }
  }

  shoot(text: string, self = false, name = '') {
    const layer = this.layer;
    const art = this.art;
    if (!layer || !art || !text || !this.options.enabled) return;
    if (self && !this.options.showSelf) return;
    // 暂停时不出弹幕：否则会停在画面外排队，一播放就堆在一起
    if (art.paused) return;
    if (this.running.size >= MAX_ON_SCREEN) return;
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (!width || !height) return;
    const laneCount = Math.max(
      1,
      Math.floor((height * 0.62) / LANE_HEIGHT) // 只用画面上面大半，下面留给字幕和控制条
    );
    const now = performance.now();
    let lane = -1;
    for (let index = 0; index < laneCount; index += 1) {
      if ((this.lanes[index] || 0) <= now) {
        lane = index;
        break;
      }
    }
    if (lane < 0) return; // 没有空行：宁可少一条，也不叠在一起
    const element = document.createElement('span');
    element.className = 'tm-room-dm-item';
    if (self) element.dataset.self = 'true';
    // 房间弹幕带发送人的名字，和弹幕库里的弹幕分得开
    const who = document.createElement('i');
    who.className = 'tm-room-dm-who';
    who.textContent = self ? '我' : name.slice(0, 12) || '房间';
    element.append(who, text.length > 60 ? `${text.slice(0, 60)}…` : text);
    element.style.top = `${8 + lane * LANE_HEIGHT}px`;
    layer.appendChild(element);
    const own = element.offsetWidth;
    const distance = width + own;
    const duration = Math.max(6000, Math.min(11000, distance * 9));
    // 这一行的“尾巴”离开右边缘之后，下一条才可以接着进
    this.lanes[lane] = now + (own + 24) * (duration / distance);
    const animation = element.animate(
      [
        { transform: `translateX(${width}px)` },
        { transform: `translateX(${-own}px)` },
      ],
      { duration, easing: 'linear', fill: 'forwards' }
    );
    this.running.add(animation);
    animation.onfinish = animation.oncancel = () => {
      this.running.delete(animation);
      element.remove();
    };
  }

  /** 播放器插件：建弹幕层，并把开关和输入框放进控制条 */
  readonly plugin: PlayerPlugin = ({ art }) => {
    this.art = art;
    const player = art.template?.$player as HTMLElement | undefined;
    if (!player) return;

    const layer = document.createElement('div');
    layer.className = 'tm-room-dm';
    layer.setAttribute('aria-hidden', 'true');
    player.appendChild(layer);
    this.layer = layer;

    const box = document.createElement('form');
    box.className = 'tm-room-dm-ctl';
    box.innerHTML = `
      <button type="button" class="tm-room-dm-switch" aria-pressed="true" aria-label="房间弹幕" title="房间弹幕：聊天消息飘成弹幕">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path class="tm-room-dm-dots" d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/><path class="tm-room-dm-off" d="M3 3l18 18"/></svg>
      </button>
      <input class="tm-room-dm-input" type="text" maxlength="100" placeholder="发条弹幕" aria-label="发弹幕" enterkeyhint="send" autocomplete="off" />
      <button type="submit" class="tm-room-dm-send" aria-label="发送弹幕">发送</button>`;
    const toggle = box.querySelector<HTMLButtonElement>('.tm-room-dm-switch')!;
    const input = box.querySelector<HTMLInputElement>('.tm-room-dm-input')!;
    const send = box.querySelector<HTMLButtonElement>('.tm-room-dm-send')!;

    // 点在输入框里不应触发播放器的“点画面暂停”和快捷键
    ['click', 'dblclick', 'mousedown', 'touchstart', 'pointerdown'].forEach(
      (name) => box.addEventListener(name, (event) => event.stopPropagation())
    );
    // 打字期间让控制条一直在
    const keepControls = () => {
      try {
        art.controls.show = true;
        player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      } catch {
        // 控制条不可用时忽略
      }
    };
    input.addEventListener('input', keepControls);
    input.addEventListener('focus', keepControls);

    const sync = () => {
      const { enabled, canSend } = this.options;
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.dataset.on = String(enabled);
      toggle.title = enabled
        ? '房间弹幕已开：聊天消息飘成弹幕'
        : '房间弹幕已关';
      input.disabled = !canSend;
      input.placeholder = canSend ? '发条弹幕' : '房间关闭了聊天';
      send.disabled = !canSend;
      const fullscreen =
        art.fullscreen || art.fullscreenWeb || !!document.fullscreenElement;
      player.toggleAttribute('data-tm-dm-full', !!fullscreen);
    };
    this.sync = sync;
    toggle.addEventListener('click', () =>
      this.options.onToggle(!this.options.enabled)
    );
    // 控制条上两个开关各管各的（2026-11-18 用户确认要分开）：
    // “弹”（弹幕库插件）管弹幕源里其他观众的弹幕，这个对话气泡管房间聊天飘成的弹幕。
    box.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || !this.options.canSend) return;
      input.value = '';
      void this.options.send(text).catch(() => {
        input.value = text;
      });
    });

    art.controls.add({
      name: 'tm-dm',
      position: 'right',
      index: 5,
      html: box,
    });

    const onVideoState = () => {
      const paused = art.paused;
      this.running.forEach((animation) =>
        paused ? animation.pause() : animation.play()
      );
    };
    art.on('pause', onVideoState);
    art.on('play', onVideoState);
    art.on('video:seeked', () => this.clear());
    // 弹幕库插件自己的开关：标明它管的是“弹幕源”，免得和房间弹幕混
    const labelSource = () => {
      const source = player.querySelector<HTMLElement>('.apd-toggle');
      if (!source) return;
      source.title = '弹幕源：弹幕库里其他观众的弹幕';
      source.setAttribute('aria-label', '弹幕源开关');
    };
    art.on('ready', labelSource);
    labelSource();
    art.on('fullscreen', sync);
    art.on('fullscreenWeb', sync);
    document.addEventListener('fullscreenchange', sync);
    window.addEventListener('resize', sync);
    sync();

    return () => {
      document.removeEventListener('fullscreenchange', sync);
      window.removeEventListener('resize', sync);
      this.clear();
      layer.remove();
      this.layer = null;
      this.art = null;
      this.sync = null;
    };
  };
}
