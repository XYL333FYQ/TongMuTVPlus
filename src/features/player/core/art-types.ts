// 播放器用到的第三方库类型：Artplayer、hls.js、弹幕和字幕插件。
// Artplayer 自带的类型缺了几样运行时确实有的东西（见 Art），在这里补齐；
// 内核和两个播放页（自己看、房间）都只从这里拿这些类型。
import type Artplayer from 'artplayer';
import type { Option, Setting, SettingOption } from 'artplayer';
import type {
  Option as DanmukuOption,
  Result as DanmukuResult,
} from 'artplayer-plugin-danmuku';
import type Hls from 'hls.js';

/**
 * 弹幕插件挂在 art.plugins 上的接口。config 运行时是和已有配置合并，
 * 插件自带的类型写成了必须给全，这里改成部分配置。
 */
export type DanmakuPluginApi = Omit<DanmukuResult, 'config'> & {
  config(option: Partial<DanmukuOption>): DanmukuResult;
};

/** jassub（ASS / SSA 字幕）插件挂在 art.plugins 上的渲染器 */
export interface JassubRenderer {
  setTrack?(content: string): Promise<void> | void;
  setTrackByUrl?(url: string): Promise<void> | void;
  freeTrack?(): void;
  destroy?(): void;
}

/**
 * Artplayer 实例。补上它自带类型里没写、运行时确实有的：
 * - paused：Artplayer 把 <video> 的属性（paused、muted……）原样代理到实例上；
 * - title：两个播放页都把片名挂在实例上，给插件读；
 * - plugins：用到的两个插件。
 */
export type Art = Artplayer & {
  readonly paused: boolean;
  title?: string;
  plugins: Artplayer['plugins'] & {
    artplayerPluginDanmuku?: DanmakuPluginApi;
    artplayerPluginJassub?: { instance?: JassubRenderer | null };
  };
};

export type ArtplayerConstructor = typeof Artplayer;
export type ArtSetting = Setting;
/** 设置菜单里被点中的那一项（onSelect / onSwitch 的参数） */
export type ArtSettingOption = SettingOption;
export type ArtControl = NonNullable<Option['controls']>[number];
export type ArtPlugin = NonNullable<Option['plugins']>[number];

export type HlsInstance = Hls;
export type HlsConstructor = typeof Hls;
/** <video> 上挂着的 hls.js 实例（内核接管 m3u8 时放上去，换地址前要先销毁） */
export type VideoWithHls = HTMLVideoElement & { hls?: Hls };
