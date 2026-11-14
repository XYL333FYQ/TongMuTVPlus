/*
 * 字幕：片源自带字幕、本地上传字幕。
 * 普通字幕（vtt/srt）用 Artplayer 自带渲染；ASS/SSA 用 jassub；PGS/SUP 位图字幕用 libbitsub。
 * 高级字幕渲染失败时，有备用地址就降级为普通字幕。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { convertSubtitleFileToVttObjectUrl } from '@/lib/subtitle-converter';

import type { Art } from '../WatchPlayer';

export interface SourceSubtitle {
  label: string;
  url: string;
  fallbackUrl?: string;
  fallbackFormat?: string;
  format?: string;
  sourceFormat?: string;
  codec?: string;
  renderMode?: 'native' | 'jassub' | 'bitsub';
}

type Engine = 'native' | 'jassub' | 'bitsub';

interface LocalSubtitle {
  name: string;
  engine: Engine;
  episodeKey: string;
  url?: string;
  content?: string;
  binary?: ArrayBuffer;
}

const JASSUB_BASE = '/assets/jassub';
const CJK_FONT = 'noto sans cjk sc';
const ADVANCED = new Set(['ass', 'ssa']);
const BITMAP = new Set(['pgs', 'sup']);
const SIZE_KEY = 'subtitleSize';
const SIZES = [
  { html: '小', size: '1em' },
  { html: '中', size: '2em' },
  { html: '大', size: '3em' },
  { html: '超大', size: '4em' },
];

export function subtitleSize() {
  try {
    return localStorage.getItem(SIZE_KEY) || '2em';
  } catch {
    return '2em';
  }
}

function formatOf(subtitle?: SourceSubtitle | null) {
  return (
    subtitle?.format ||
    subtitle?.sourceFormat ||
    subtitle?.codec ||
    ''
  ).toLowerCase();
}

export function engineOf(subtitle?: SourceSubtitle | null): Engine {
  if (subtitle?.renderMode === 'bitsub' || BITMAP.has(formatOf(subtitle)))
    return 'bitsub';
  if (subtitle?.renderMode === 'jassub' || ADVANCED.has(formatOf(subtitle)))
    return 'jassub';
  return 'native';
}

function extensionOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
}

export type Notify = (
  message: string,
  tone: 'success' | 'error' | 'info'
) => void;

/**
 * 每个播放器实例一份。attach(art) 在实例创建后调用；
 * setTracks 在换集时调用；openFilePicker 由“上传本地字幕”触发。
 */
export class SubtitleController {
  private art: Art = null;
  private tracks: SourceSubtitle[] = [];
  private episodeKey = '';
  private local: LocalSubtitle | null = null;
  private bitsub: { dispose?: () => void } | null = null;
  private label = '关闭';

  constructor(private notify: Notify, private openFilePicker: () => void) {}

  /** 首个字幕能否交给 Artplayer 原生加载（创建实例时传入） */
  initialNative(tracks: SourceSubtitle[]) {
    const first = tracks[0];
    return first && engineOf(first) === 'native'
      ? { url: first.url, fontSize: subtitleSize() }
      : null;
  }

  attach(art: Art, tracks: SourceSubtitle[], episodeKey: string) {
    this.art = art;
    this.tracks = tracks;
    this.episodeKey = episodeKey;
    this.label = tracks[0]?.label || '关闭';
    art.on('ready', () => {
      const first = tracks[0];
      if (first && engineOf(first) !== 'native')
        void this.selectSource(first)
          .catch(() => {
            art.subtitle.show = false;
            this.label = '关闭';
          })
          .finally(() => this.renderMenu());
      else this.renderMenu();
      art.setting.add({
        name: 'tm-subtitle-size',
        html: '字幕大小',
        selector: SIZES.map((item) => ({
          ...item,
          default: item.size === subtitleSize(),
        })),
        onSelect: (item: any) => {
          art.subtitle.style({ fontSize: item.size });
          try {
            localStorage.setItem(SIZE_KEY, item.size);
          } catch {
            // 忽略
          }
          return item.html;
        },
      });
    });
    return () => this.dispose();
  }

  /** 换集但没重建播放器 */
  setTracks(tracks: SourceSubtitle[], episodeKey: string) {
    this.tracks = tracks;
    this.episodeKey = episodeKey;
    const first = tracks[0];
    this.clearRenderers();
    if (!this.art) return;
    if (first)
      void this.selectSource(first)
        .catch(() => this.close())
        .finally(() => this.renderMenu());
    else {
      this.art.subtitle.show = false;
      this.label = '关闭';
      this.renderMenu();
    }
  }

  async loadFile(file: File) {
    const extension = extensionOf(file.name);
    const label = `本地：${file.name}`;
    try {
      if (ADVANCED.has(extension)) {
        const content = await file.text();
        this.replaceLocal({
          name: file.name,
          engine: 'jassub',
          content,
          episodeKey: this.episodeKey,
        });
        await this.showJassub({ content }, label);
        this.renderMenu();
        return this.notify(`已加载高级字幕：${file.name}`, 'success');
      }
      if (BITMAP.has(extension)) {
        const binary = await file.arrayBuffer();
        this.replaceLocal({
          name: file.name,
          engine: 'bitsub',
          binary,
          episodeKey: this.episodeKey,
        });
        await this.showBitsub({ content: binary }, label);
        this.renderMenu();
        return this.notify(`已加载位图字幕：${file.name}`, 'success');
      }
      await this.loadNativeFile(file);
      this.notify(`已加载本地字幕：${file.name}`, 'success');
    } catch (caught) {
      let problem: unknown = caught;
      if (ADVANCED.has(extension)) {
        try {
          await this.loadNativeFile(file);
          return this.notify(
            `高级字幕显示失败，已改用普通字幕：${file.name}`,
            'info'
          );
        } catch (fallback) {
          problem = fallback;
        }
      }
      this.notify(
        problem instanceof Error ? problem.message : '字幕加载失败',
        'error'
      );
    }
  }

  dispose() {
    this.clearRenderers();
    if (this.local?.engine === 'native' && this.local.url)
      URL.revokeObjectURL(this.local.url);
    this.local = null;
    this.art = null;
  }

  // ------------------------------------------------------------ 内部

  private async loadNativeFile(file: File) {
    const converted = await convertSubtitleFileToVttObjectUrl(file);
    this.replaceLocal({
      name: converted.name,
      engine: 'native',
      url: converted.url,
      episodeKey: this.episodeKey,
    });
    this.showNative(converted.url, `本地：${converted.name}`);
    this.renderMenu();
  }

  private replaceLocal(next: LocalSubtitle) {
    if (this.local?.engine === 'native' && this.local.url)
      URL.revokeObjectURL(this.local.url);
    this.clearRenderers();
    this.local = next;
  }

  private jassub() {
    return this.art?.plugins?.artplayerPluginJassub?.instance || null;
  }

  private clearRenderers() {
    try {
      this.jassub()?.freeTrack?.();
    } catch {
      // 忽略
    }
    const bitsub = this.bitsub;
    this.bitsub = null;
    try {
      bitsub?.dispose?.();
    } catch {
      // 忽略
    }
  }

  private close() {
    if (!this.art) return;
    this.art.subtitle.show = false;
    this.clearRenderers();
    this.label = '关闭';
  }

  private showNative(url: string, label: string) {
    if (!this.art) return;
    this.clearRenderers();
    this.art.subtitle.switch(url, {
      name: label,
      type: 'vtt',
      style: { color: '#fff', fontSize: subtitleSize() },
      encoding: 'utf-8',
    });
    this.art.subtitle.show = true;
    this.label = label;
  }

  private async showJassub(
    track: { content?: string; url?: string },
    label: string
  ) {
    const art = this.art;
    if (!art) return;
    art.subtitle.show = false;
    const existing = this.jassub();
    if (existing) {
      if (track.content) await existing.setTrack?.(track.content);
      else if (track.url) {
        if (existing.setTrackByUrl) await existing.setTrackByUrl(track.url);
        else {
          const response = await fetch(track.url, {
            credentials: 'include',
            cache: 'no-store',
          });
          if (!response.ok)
            throw new Error(`高级字幕加载失败 (${response.status})`);
          await existing.setTrack?.(await response.text());
        }
      }
    } else {
      const jassubModule = (await import('artplayer-plugin-jassub')) as any;
      const plugin = jassubModule.default || jassubModule;
      art.plugins.add(
        plugin({
          ...(track.content
            ? { subContent: track.content }
            : { subUrl: track.url }),
          workerUrl: `${JASSUB_BASE}/jassub-worker.js`,
          wasmUrl: `${JASSUB_BASE}/jassub-worker.wasm`,
          modernWasmUrl: `${JASSUB_BASE}/jassub-worker-modern.wasm`,
          availableFonts: {
            [CJK_FONT]: `${JASSUB_BASE}/NotoSansCJK-Regular.ttc`,
            'liberation sans': `${JASSUB_BASE}/default.woff2`,
          },
          fallbackFont: CJK_FONT,
        })
      );
      if (!this.jassub()) throw new Error('高级字幕渲染器初始化失败');
    }
    this.label = label;
  }

  private async showBitsub(
    source: { url?: string; content?: ArrayBuffer },
    label: string
  ) {
    const video = this.art?.video;
    if (!video) throw new Error('播放器尚未就绪');
    this.art.subtitle.show = false;
    this.clearRenderers();
    // libbitsub 自托管在 public/libbitsub，绕过打包器加载
    const url = new URL('/libbitsub/dist/index.js', window.location.href).href;
    const { PgsRenderer } = (await import(
      /* webpackIgnore: true */ url
    )) as any;
    let reject: ((error: Error) => void) | null = null;
    const failure = new Promise<never>((_, fail) => {
      reject = fail;
    });
    const renderer = new PgsRenderer({
      video,
      ...(source.content
        ? { subContent: source.content }
        : { subUrl: source.url }),
      onError: (error: Error) => {
        reject?.(error);
        reject = null;
      },
    });
    this.bitsub = renderer;
    try {
      await Promise.race([renderer.waitUntilInitialized(), failure]);
    } catch (caught) {
      this.clearRenderers();
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    reject = null;
    this.label = label;
  }

  private async selectSource(subtitle: SourceSubtitle) {
    if (!subtitle.url) return;
    const engine = engineOf(subtitle);
    if (engine === 'bitsub')
      return this.showBitsub({ url: subtitle.url }, subtitle.label);
    if (engine === 'jassub') {
      try {
        return await this.showJassub({ url: subtitle.url }, subtitle.label);
      } catch (caught) {
        if (!subtitle.fallbackUrl) throw caught;
        this.showNative(subtitle.fallbackUrl, subtitle.label);
        const message = `高级字幕显示失败，已改用普通字幕：${subtitle.label}`;
        this.art.notice.show = message;
        this.notify(message, 'info');
        return;
      }
    }
    this.showNative(subtitle.url, subtitle.label);
  }

  private renderMenu() {
    const art = this.art;
    if (!art) return;
    try {
      art.setting.remove('tm-subtitle');
    } catch {
      // 第一次没有
    }
    const local =
      this.local?.episodeKey === this.episodeKey ? this.local : null;
    const options: any[] = [
      { html: '关闭', act: 'close' },
      { html: '上传本地字幕', act: 'upload' },
      ...this.tracks.map((track) => ({
        html: track.label,
        act: 'source',
        track,
      })),
      ...(local ? [{ html: `本地：${local.name}`, act: 'local' }] : []),
    ].map((item) => ({ ...item, default: item.html === this.label }));
    art.setting.add({
      name: 'tm-subtitle',
      html: '字幕',
      selector: options,
      onSelect: (item: any) => {
        if (item.act === 'close') {
          this.close();
          return item.html;
        }
        if (item.act === 'upload') {
          this.openFilePicker();
          return this.label;
        }
        const run =
          item.act === 'source'
            ? this.selectSource(item.track)
            : local?.engine === 'native' && local.url
            ? Promise.resolve(this.showNative(local.url, item.html))
            : local?.engine === 'jassub'
            ? this.showJassub({ content: local.content }, item.html)
            : local?.engine === 'bitsub'
            ? this.showBitsub({ content: local.binary }, item.html)
            : Promise.resolve();
        void run.catch((error: unknown) =>
          this.notify(
            error instanceof Error ? error.message : '字幕切换失败',
            'error'
          )
        );
        return item.html;
      },
    });
  }
}
