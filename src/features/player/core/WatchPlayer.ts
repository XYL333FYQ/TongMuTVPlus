/*
 * 新播放器内核：Artplayer + hls.js 的薄封装，不依赖 React。
 *
 * - load(source) 负责切换片源：普通浏览器直接 switch，WebKit 或 HLS 模式变化时整体重建。
 * - 功能（弹幕、超分、跳过片头……）都是插件：每次创建 Artplayer 实例时挂上，销毁时卸下。
 * - 独立看和一起看各自 new 一个，互不影响。
 */

import { enableArtKeyboardAccess } from '@/lib/art-keyboard';
import { lockLandscapeInFullscreen } from '@/lib/player-orientation';
import { readSetting, writeSetting } from '@/lib/settings';

import type {
  Art,
  ArtControl,
  ArtplayerConstructor,
  ArtPlugin,
  ArtSetting,
  HlsConstructor,
  HlsInstance,
  VideoWithHls,
} from './art-types';
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

export type { Art } from './art-types';

/** 画面上的文字色（tokens.css，两种主题都是白色）：字幕和控制条主题色都用它 */
const PLAYER_TEXT = 'var(--tm-room-player-text)';

/** 老 iOS 内联播放和不带来源页请求片源要的两个属性，Artplayer 的类型里没有，原样写到 <video> 上 */
const LEGACY_VIDEO_ATTRS: Record<string, string> = {
  'webkit-playsinline': 'true',
  referrerpolicy: 'no-referrer',
};

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
  container: HTMLDivElement;
  adBlock?: boolean;
  bufferStrategy?: BufferStrategy;
  /** 至少提前缓冲秒数（一起看 120） */
  minBufferAhead?: number;
  hlsModes?: Partial<HlsModes>;
  autoplay?: boolean;
  /** false 时隐藏倍速和长按加速 */
  rateControl?: boolean;
  /**
   * 手机长按临时 3 倍速。默认跟 rateControl 一样；一起看传 false：
   * 房间只有一个倍速，长按会把全房间都变成 3 倍，松手又改回去，所有人跟着卡一下。
   */
  fastForward?: boolean;
  /** 截图、下一集等底栏按钮 */
  controls?: ArtControl[];
  settings?: ArtSetting[];
  /** Artplayer 自带插件（弹幕、缩略图），每次创建实例时生成 */
  artPlugins?: () => ArtPlugin[];
  /** 控制条主题色（默认是画面上的文字色 --tm-room-player-text） */
  theme?: string;
  /** 替换 Artplayer 自带的图标（如加载动画） */
  icons?: Record<string, string>;
  /**
   * 每次创建实例时的音量。不给就用上次记住的音量，并且记住新的音量（一起看）；
   * 给了就不记（自己看每次从 0.7 开始，换集时由页面恢复本次的音量）。
   */
  initialVolume?: number;
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
  onManifest?: (hls: HlsInstance, video: HTMLVideoElement) => void;
  onForbidden?: (hls: HlsInstance, video: HTMLVideoElement) => boolean;
}

interface Libraries {
  Artplayer: ArtplayerConstructor;
  Hls: HlsConstructor;
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
  video: VideoWithHls,
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
  art: Art | null = null;
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
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(private options: WatchPlayerOptions) {
    this.modes = {
      harmonyNative: false,
      harmonyAdBlock: false,
      netdiskNative: false,
      ...options.hlsModes,
    };
  }

  // ------------------------------------------------------------ 对外接口

  get video(): VideoWithHls | null {
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
    return this.playOrThrow().catch(() => undefined);
  }
  /**
   * 和 play() 一样，但浏览器拦下自动播放（NotAllowedError）时把错误抛出来。
   * 一起看的同步引擎靠它提示“点击播放，加入房间同步”；play() 会吞掉错误。
   */
  playOrThrow(): Promise<unknown> {
    try {
      return Promise.resolve(this.art?.play?.());
    } catch (error) {
      return Promise.reject(error);
    }
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
  on(event: string, handler: (...args: unknown[]) => void) {
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

  /** recreate：即使能直接换地址也整体重建（如去广告开关改了） */
  async load(source: WatchSource, { recreate = false } = {}) {
    if (this.destroyed) return;
    const previous = this.source;
    this.source = source;
    if (previous?.source !== source.source) this.corsFallback = false;
    const env = playerEnvironment();
    if (
      this.art &&
      !recreate &&
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
    if (!art) return;
    art.option.type = artplayerTypeFor(source.url, source.mediaType) || '';
    if (art.video) this.applyCrossOrigin(art.video);
    // switch 不会回收旧的 hls 实例；切到直链时旧实例会继续拉分片
    const previous = art.video as VideoWithHls;
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
        (art.video as VideoWithHls | undefined)?.hls?.destroy();
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
    // Artplayer 的类型不含它代理到实例上的 <video> 属性（paused 等），见 art-types.ts
    const art = new Artplayer({
      container: options.container,
      url: source.url,
      ...(type ? { type } : {}),
      poster: source.poster || '',
      volume: options.initialVolume ?? readVolume(),
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
              // 字幕压在画面上：用画面上的文字色，两种主题都是白字
              style: {
                color: PLAYER_TEXT,
                fontSize: options.subtitle.fontSize,
              },
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
      theme: options.theme || PLAYER_TEXT,
      lang: 'zh-cn',
      hotkey: false,
      fastForward: (options.fastForward ?? options.rateControl) !== false,
      // 不自动旋转：手机竖着拿时 Artplayer 会把整个播放器转 90°，控制栏和退出按钮跟着歪掉、退不出来。
      // 横屏看用系统旋转或“全屏”按钮（会请求横屏）
      autoOrientation: false,
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
        ...LEGACY_VIDEO_ATTRS,
        ...(needsCrossOrigin(source.source) && !this.corsFallback
          ? { crossOrigin: 'anonymous' }
          : {}),
      },
      customType: {
        m3u8: (video: VideoWithHls, url: string) => {
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
      ...(options.icons ? { icons: options.icons } : {}),
      plugins: options.artPlugins?.() || [],
      settings: options.settings || [],
      controls: options.controls || [],
    }) as Art;
    art.title = source.title;
    this.art = art;
    this.activeModes = { ...this.modes };

    // 键盘可操作控制栏
    const stopKeyboard = enableArtKeyboardAccess([
      art.template?.$bottom,
      art.template?.$setting,
    ]);
    this.disposers.push(stopKeyboard);
    // 系统全屏时转横屏（替代关掉的 autoOrientation，不做网页全屏的 CSS 旋转）
    this.disposers.push(lockLandscapeInFullscreen(art));

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

    if (options.initialVolume === undefined)
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
  const value = Number(readSetting('tm_player_volume'));
  return Number.isFinite(value) && value >= 0 && value <= 1 && value !== 0
    ? value
    : 0.7;
}

function writeVolume(volume: number) {
  if (Number.isFinite(volume) && volume > 0)
    writeSetting('tm_player_volume', String(volume));
}

/*
 * 拆分说明（STANDARD S6）：WatchPlayer 是两个播放器（自己看、房间）共用的内核，一个实例从建立到销毁
 * 管着同一个 <video>、Artplayer 实例、hls.js 实例和插件清理表。加载、换源、错误重试、音量记忆都要读写
 * 这些同一份状态，拆成多个文件就得把内部字段公开出去，反而破坏“外面只能经方法操作播放器”的边界，
 * 所以留在一个文件里；插件（弹幕、字幕、链接刷新等）已经各自在 plugins/ 下。
 */
