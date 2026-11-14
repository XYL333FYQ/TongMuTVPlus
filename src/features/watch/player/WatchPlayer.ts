/*
 * 新播放器内核：Artplayer + hls.js 的薄封装，不依赖 React。
 *
 * - load(source) 负责切换片源：普通浏览器直接 switch，WebKit 或 HLS 模式变化时整体重建。
 * - 功能（弹幕、超分、跳过片头……）都是插件：每次创建 Artplayer 实例时挂上，销毁时卸下。
 * - 独立看和一起看各自 new 一个，互不影响。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { enableArtKeyboardAccess } from '@/features/playback/art-keyboard';

import { isSafariLike, playerEnvironment } from './env';
import {
  attachHls,
  BufferStrategy,
  readBufferStrategy,
  rescueWebkitHls,
} from './hls-engine';
import {
  artplayerTypeFor,
  isHlsLikeUrl,
  isNetdiskMountSource,
  isProxyM3u8Url,
  MediaType,
  nativeHlsUrl,
  needsCrossOrigin,
} from './source-policy';

export type Art = any;

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export interface WatchSource {
  url: string;
  /** 片源标识（openlist / xiaoya / emby_x / 普通采集站 key） */
  source: string;
  mediaType?: MediaType;
  title: string;
  poster?: string;
  qualities?: Array<{ name: string; url: string }>;
}

export interface HlsModes {
  /** 鸿蒙：把 m3u8 交给系统播放器 */
  harmonyNative: boolean;
  /** 鸿蒙原生模式下仍由服务端去广告 */
  harmonyAdBlock: boolean;
  /** 网盘挂载源用浏览器原生 HLS 直连 */
  netdiskNative: boolean;
}

export interface PluginContext {
  art: Art;
  player: WatchPlayer;
  /** 播放器销毁时自动清理的计时器 */
  later(fn: () => void, ms: number): number;
}

/** 返回的函数在实例销毁时调用 */
export type PlayerPlugin = (ctx: PluginContext) => void | (() => void);

export interface WatchPlayerOptions {
  container: HTMLElement;
  adBlock?: boolean;
  bufferStrategy?: BufferStrategy;
  /** 至少提前缓冲秒数（一起看 120） */
  minBufferAhead?: number;
  hlsModes?: Partial<HlsModes>;
  autoplay?: boolean;
  /** false 时隐藏倍速和长按加速（一起看没有播放权限时） */
  rateControl?: boolean;
  /** 截图、下一集等底栏按钮 */
  controls?: any[];
  settings?: any[];
  /** Artplayer 自带插件（弹幕、缩略图），每次创建实例时生成 */
  artPlugins?: () => any[];
  /** 首次创建时的原生字幕 */
  subtitle?: { url: string; fontSize: string } | null;
  plugins?: PlayerPlugin[];
  /** 加载出错：message 是给人看的中文 */
  onError?: (message: string, info?: { corsFailedUrl?: string }) => void;
  /** 可以开始播放（错误清除） */
  onCanPlay?: () => void;
  /** 每次创建出新的 Artplayer 实例 */
  onInstance?: (art: Art) => void;
  /** hls.js 实例就绪（链接刷新用） */
  onManifest?: (hls: any, video: HTMLVideoElement) => void;
  onForbidden?: (hls: any, video: HTMLVideoElement) => boolean;
}

interface Libraries {
  Artplayer: any;
  Hls: any;
}

let libraries: Promise<Libraries> | null = null;
function loadLibraries() {
  if (!libraries)
    libraries = Promise.all([import('artplayer'), import('hls.js')]).then(
      ([artplayer, hls]) => ({
        Artplayer: artplayer.default,
        Hls: hls.default,
      })
    );
  return libraries;
}

/** 让 <video> 带上真实地址，浏览器投屏 / 外部播放器才能识别 */
export function exposeVideoSource(
  video: HTMLVideoElement & { hls?: any },
  url: string,
  mediaType: MediaType = ''
) {
  if (!video || !url) return;
  const sources = Array.from(video.getElementsByTagName('source'));
  const hlsLike = isHlsLikeUrl(url, mediaType);
  if (isSafariLike() && video.hls && hlsLike) {
    // hls.js 接管时不能再塞原始 m3u8，否则 Safari 会切回原生 HLS 抢播放器
    sources.forEach((source) => source.remove());
  } else {
    const existing = sources.find((source) => source.src === url);
    if (existing) {
      if (hlsLike) existing.type = 'application/vnd.apple.mpegurl';
    } else {
      sources.forEach((source) => source.remove());
      const element = document.createElement('source');
      element.src = url;
      if (hlsLike) element.type = 'application/vnd.apple.mpegurl';
      video.appendChild(element);
    }
  }
  video.disableRemotePlayback = false;
  video.removeAttribute('disableRemotePlayback');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
}

export class WatchPlayer {
  art: Art = null;
  private libs: Libraries | null = null;
  private source: WatchSource | null = null;
  private modes: HlsModes;
  private activeModes: HlsModes | null = null;
  private timers = new Set<number>();
  private disposers: Array<() => void> = [];
  private destroyed = false;
  /** 无 ACAO 的 CDN：CORS 模式失败后退回普通模式，只退一次 */
  private corsFallback = false;
  /** 重建实例时恢复的位置与状态 */
  private resume: {
    time: number;
    playing: boolean;
    webFullscreen: boolean;
  } | null = null;
  private generation = 0;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor(private options: WatchPlayerOptions) {
    this.modes = {
      harmonyNative: false,
      harmonyAdBlock: false,
      netdiskNative: false,
      ...options.hlsModes,
    };
  }

  // ------------------------------------------------------------ 对外接口

  get video(): (HTMLVideoElement & { hls?: any }) | null {
    return this.art?.video || null;
  }
  get currentSource() {
    return this.source;
  }
  get currentTime(): number {
    return Number(this.art?.currentTime) || 0;
  }
  get duration(): number {
    return Number(this.art?.duration) || 0;
  }
  get paused(): boolean {
    return this.art ? !!this.art.paused : true;
  }

  play() {
    return Promise.resolve(this.art?.play?.()).catch(() => undefined);
  }
  pause() {
    this.art?.pause?.();
  }
  seek(time: number) {
    if (this.art) this.art.currentTime = Math.max(0, time);
  }
  notice(text: string) {
    if (this.art) this.art.notice.show = text;
  }

  /** 订阅播放器事件；重建实例后自动重新挂上 */
  on(event: string, handler: (...args: any[]) => void) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(handler);
    this.art?.on(event, handler);
    return () => {
      set?.delete(handler);
      this.art?.off?.(event, handler);
    };
  }

  setOptions(patch: Partial<WatchPlayerOptions>) {
    this.options = { ...this.options, ...patch };
  }

  /** 改变 HLS 模式或去广告后需要重建 */
  setHlsModes(modes: Partial<HlsModes>) {
    this.modes = { ...this.modes, ...modes };
  }

  /** 去广告开关：重建实例并回到原位置 */
  async setAdBlock(enabled: boolean) {
    this.options.adBlock = enabled;
    if (this.source) await this.rebuild();
  }

  async load(source: WatchSource) {
    if (this.destroyed) return;
    const previous = this.source;
    this.source = source;
    if (previous?.source !== source.source) this.corsFallback = false;
    const env = playerEnvironment();
    if (
      this.art &&
      !env.webkit &&
      !this.modesChanged() &&
      previous?.mediaType === source.mediaType
    ) {
      this.switchSource(source);
      return;
    }
    await this.create();
  }

  /** 保留当前位置重建（换 HLS 模式、去广告时） */
  async rebuild() {
    if (!this.source) return;
    if (this.art)
      this.resume = {
        time: this.currentTime,
        playing: !this.paused,
        webFullscreen: !!this.art.fullscreenWeb,
      };
    await this.create();
  }

  destroy() {
    this.destroyed = true;
    this.teardown();
    this.listeners.clear();
  }

  // ------------------------------------------------------------ 内部

  private later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  };

  private modesChanged() {
    const active = this.activeModes;
    if (!active) return false;
    const source = this.source?.source;
    const harmonyChanged =
      playerEnvironment().harmony &&
      (active.harmonyNative !== this.modes.harmonyNative ||
        (this.modes.harmonyNative &&
          active.harmonyAdBlock !== this.modes.harmonyAdBlock));
    const netdiskChanged =
      isNetdiskMountSource(source) &&
      playerEnvironment().nativeHls &&
      active.netdiskNative !== this.modes.netdiskNative;
    return harmonyChanged || netdiskChanged;
  }

  private netdiskNativeActive() {
    return (
      isNetdiskMountSource(this.source?.source) &&
      playerEnvironment().nativeHls &&
      this.modes.netdiskNative
    );
  }

  private harmonyNativeActive() {
    return playerEnvironment().harmony && this.modes.harmonyNative;
  }

  /** 给 <video> 暴露的地址（投屏读取） */
  private exposedUrl(url: string) {
    if (this.netdiskNativeActive()) return url;
    if (this.harmonyNativeActive())
      return nativeHlsUrl(url, {
        adBlock: this.modes.harmonyAdBlock,
        source: this.source?.source || '',
        origin: window.location.origin,
      });
    return url;
  }

  private applyCrossOrigin(video: HTMLVideoElement) {
    if (needsCrossOrigin(this.source?.source) && !this.corsFallback) {
      if (video.crossOrigin !== 'anonymous') video.crossOrigin = 'anonymous';
    } else if (video.crossOrigin) video.removeAttribute('crossorigin');
  }

  private expose(video: HTMLVideoElement, url: string) {
    exposeVideoSource(video, url, this.source?.mediaType);
    this.applyCrossOrigin(video);
  }

  private switchSource(source: WatchSource) {
    const art = this.art;
    art.option.type = artplayerTypeFor(source.url, source.mediaType) || '';
    if (art.video) this.applyCrossOrigin(art.video);
    // switch 不会回收旧的 hls 实例；切到直链时旧实例会继续拉分片
    const previous = art.video as HTMLVideoElement & { hls?: any };
    if (previous?.hls) {
      try {
        previous.hls.destroy?.();
      } catch {
        // 忽略
      }
      delete previous.hls;
    }
    art.switch = source.url;
    art.title = source.title;
    art.poster = source.poster || '';
    if (art.video) this.expose(art.video, this.exposedUrl(source.url));
  }

  private teardown() {
    this.generation++;
    this.disposers.splice(0).forEach((dispose) => {
      try {
        dispose();
      } catch {
        // 插件清理失败不影响销毁
      }
    });
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    const art = this.art;
    this.art = null;
    if (art) {
      try {
        if (art.fullscreenWeb) art.fullscreenWeb = false;
      } catch {
        // 忽略
      }
      try {
        art.video?.hls?.destroy();
        art.destroy();
      } catch {
        // 忽略
      }
    }
    this.options.container.innerHTML = '';
    // 网页全屏时 Artplayer 把节点移到 body，残留会盖住新播放器
    document
      .querySelectorAll<HTMLDivElement>('body > .art-fullscreen-web')
      .forEach((element) => element.remove());
  }

  private async create() {
    const source = this.source;
    if (!source) return;
    if (this.art) {
      if (!this.resume)
        this.resume = {
          time: 0,
          playing: true,
          webFullscreen: !!this.art.fullscreenWeb,
        };
      this.teardown();
    }
    const generation = ++this.generation;
    this.libs = this.libs || (await loadLibraries());
    // iOS 需要等旧节点彻底清掉
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (this.destroyed || generation !== this.generation) return;

    const { Artplayer, Hls } = this.libs;
    const env = playerEnvironment();
    const options = this.options;
    Artplayer.PLAYBACK_RATE = PLAYBACK_RATES;
    Artplayer.USE_RAF = true;

    const type = artplayerTypeFor(source.url, source.mediaType);
    const art = new Artplayer({
      container: options.container,
      url: source.url,
      ...(type ? { type } : {}),
      poster: source.poster || '',
      title: source.title,
      volume: readVolume(),
      isLive: false,
      muted: false,
      autoplay: options.autoplay !== false,
      pip: true,
      autoSize: false,
      autoMini: false,
      screenshot: false,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: options.rateControl !== false,
      aspectRatio: false,
      fullscreen: !env.ios,
      fullscreenWeb: true,
      ...(options.subtitle
        ? {
            subtitle: {
              url: options.subtitle.url,
              type: 'vtt',
              style: { color: '#fff', fontSize: options.subtitle.fontSize },
              encoding: 'utf-8',
            },
          }
        : {}),
      subtitleOffset: false,
      miniProgressBar: false,
      mutex: true,
      playsInline: true,
      autoPlayback: false,
      airplay: true,
      theme: 'var(--tm-player-accent, #fff)',
      lang: 'zh-cn',
      hotkey: false,
      fastForward: options.rateControl !== false,
      autoOrientation: true,
      lock: true,
      ...(source.qualities?.length
        ? {
            quality: source.qualities.map((quality, index) => ({
              default: index === 0,
              html: quality.name,
              url: quality.url,
            })),
          }
        : {}),
      moreVideoAttr: {
        playsInline: true,
        'webkit-playsinline': 'true',
        referrerpolicy: 'no-referrer',
        ...(needsCrossOrigin(source.source) && !this.corsFallback
          ? { crossOrigin: 'anonymous' }
          : {}),
      },
      customType: {
        m3u8: (video: HTMLVideoElement & { hls?: any }, url: string) => {
          if (this.netdiskNativeActive() || this.harmonyNativeActive()) {
            video.hls?.destroy();
            delete video.hls;
            const nativeUrl = this.exposedUrl(url);
            video.src = nativeUrl;
            this.expose(video, nativeUrl);
            video.load();
            return;
          }
          this.expose(video, url);
          attachHls(Hls, video, url, {
            adBlock: options.adBlock !== false,
            strategy: options.bufferStrategy || readBufferStrategy(),
            minAhead: options.minBufferAhead || 0,
            source: () => this.source?.source || '',
            later: this.later,
            onManifest: options.onManifest,
            onForbidden: options.onForbidden,
            onFatal: (message, info) => options.onError?.(message, info),
            shouldAutoPlay: () =>
              !!(this.art?.option.autoplay || this.art?.loading),
            play: () => void this.play(),
          });
        },
      },
      plugins: options.artPlugins?.() || [],
      settings: options.settings || [],
      controls: options.controls || [],
    });
    this.art = art;
    this.activeModes = { ...this.modes };

    // 键盘可操作控制栏
    const stopKeyboard = enableArtKeyboardAccess([
      art.template?.$bottom,
      art.template?.$setting,
    ]);
    this.disposers.push(stopKeyboard);

    this.listeners.forEach((handlers, event) =>
      handlers.forEach((handler) => art.on(event, handler))
    );

    art.on('ready', () => {
      if (this.resume?.webFullscreen) {
        try {
          art.fullscreenWeb = true;
        } catch {
          // 忽略
        }
      }
      if (art.video)
        rescueWebkitHls(art.video, this.later, () => this.art === art);
    });

    art.on('video:volumechange', () => writeVolume(art.volume));

    art.on('video:canplay', () => {
      const resume = this.resume;
      this.resume = null;
      if (resume && resume.time > 0) {
        const duration = art.duration || 0;
        art.currentTime =
          duration && resume.time >= duration - 2
            ? Math.max(0, duration - 5)
            : resume.time;
        if (!resume.playing) art.pause();
      }
      options.onCanPlay?.();
    });

    art.on('error', () => this.handleError(art));

    for (const plugin of options.plugins || []) {
      const dispose = plugin({ art, player: this, later: this.later });
      if (dispose) this.disposers.push(dispose);
    }

    if (art.video) this.expose(art.video, this.exposedUrl(source.url));
    options.onInstance?.(art);
  }

  private handleError(art: Art) {
    const video = art.video as HTMLVideoElement | undefined;
    const source = this.source;
    if (!source) return;
    // 乐观 CORS 失败：无 ACAO 的 CDN 退回普通模式（只退一次）
    if (
      video &&
      (art.currentTime || 0) === 0 &&
      video.crossOrigin === 'anonymous' &&
      !this.corsFallback &&
      (source.mediaType === 'file' || this.netdiskNativeActive())
    ) {
      this.corsFallback = true;
      try {
        video.removeAttribute('crossorigin');
      } catch {
        // 忽略
      }
      const url = art.option?.url || source.url;
      exposeVideoSource(video, url, source.mediaType);
      video.load();
      video.play().catch(() => undefined);
      return;
    }
    if ((art.currentTime || 0) > 0) return;
    const url: string = art.option?.url || source.url;
    if (isHlsLikeUrl(url) || url.toLowerCase().includes('.m3u')) return;
    if (source.source === 'directplay' && !isProxyM3u8Url(url))
      this.options.onError?.('视频播放失败', { corsFailedUrl: url });
    else this.options.onError?.('视频播放失败');
  }
}

function readVolume() {
  try {
    const value = Number(localStorage.getItem('tm_player_volume'));
    return Number.isFinite(value) && value >= 0 && value <= 1 && value !== 0
      ? value
      : 0.7;
  } catch {
    return 0.7;
  }
}

function writeVolume(volume: number) {
  try {
    if (Number.isFinite(volume) && volume > 0)
      localStorage.setItem('tm_player_volume', String(volume));
  } catch {
    // 忽略
  }
}
