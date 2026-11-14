/*
 * Anime4K 超分（需要 WebGPU）：把视频逐帧放大后画到覆盖在视频上的 canvas。
 * 默认关闭；模式和倍数记在本机。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAnime4KRenderer } from '@/lib/anime4k';

import type { Art } from '../WatchPlayer';

export const ANIME4K_MODES = [
  { value: 'ModeA', label: 'A（快速）' },
  { value: 'ModeB', label: 'B（平衡）' },
  { value: 'ModeC', label: 'C（画质）' },
  { value: 'ModeAA', label: 'AA（增强快速）' },
  { value: 'ModeBB', label: 'BB（增强平衡）' },
  { value: 'ModeCA', label: 'CA（最高画质）' },
] as const;
export const ANIME4K_SCALES = [1.5, 2, 3, 4];

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** 检测 WebGPU，并放宽设备缓冲上限（大分辨率超分需要） */
let webgpuCheck: Promise<boolean> | null = null;
export function checkWebGPU() {
  if (webgpuCheck) return webgpuCheck;
  webgpuCheck = (async () => {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
    try {
      const gpu = (navigator as any).gpu;
      const requestAdapter = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (options?: any) => {
        const adapter = await requestAdapter(options);
        if (!adapter) return adapter;
        const requestDevice = adapter.requestDevice.bind(adapter);
        adapter.requestDevice = (descriptor?: any) =>
          requestDevice({
            ...descriptor,
            requiredLimits: {
              ...descriptor?.requiredLimits,
              maxBufferSize: Math.min(
                adapter.limits.maxBufferSize || 2 ** 31,
                2 ** 31
              ),
              maxStorageBufferBindingSize: Math.min(
                adapter.limits.maxStorageBufferBindingSize || 2 ** 30,
                2 ** 30
              ),
            },
          });
        return adapter;
      };
      return !!(await gpu.requestAdapter());
    } catch {
      return false;
    }
  })();
  return webgpuCheck;
}

export interface Anime4KState {
  enabled: boolean;
  mode: string;
  scale: number;
}

export class Anime4KController {
  state: Anime4KState = {
    enabled: false,
    mode: read('anime4k_mode', 'ModeA'),
    scale: parseFloat(read('anime4k_scale', '2')) || 2,
  };
  private art: Art = null;
  private running: { stop(): void; canvas: HTMLCanvasElement } | null = null;
  private listeners = new Set<(state: Anime4KState) => void>();

  subscribe(listener: (state: Anime4KState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 新实例创建后调用：开着就重新启动 */
  attach(art: Art) {
    this.art = art;
    art.on('flip', (flip: string) => this.syncFlip(flip));
    if (this.state.enabled) art.on('ready', () => void this.start());
    return () => {
      this.stop();
      this.art = null;
    };
  }

  async setEnabled(enabled: boolean) {
    if (enabled) await this.start();
    else this.stop();
    this.update({ enabled: enabled && !!this.running });
    try {
      localStorage.setItem('enable_anime4k', String(enabled));
    } catch {
      // 忽略
    }
  }

  async setMode(mode: string) {
    this.update({ mode });
    try {
      localStorage.setItem('anime4k_mode', mode);
    } catch {
      // 忽略
    }
    if (this.state.enabled) await this.restart();
  }

  async setScale(scale: number) {
    this.update({ scale });
    try {
      localStorage.setItem('anime4k_scale', String(scale));
    } catch {
      // 忽略
    }
    if (this.state.enabled) await this.restart();
  }

  private update(patch: Partial<Anime4KState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private async restart() {
    this.stop();
    await this.start();
  }

  private syncFlip(flip?: string) {
    const canvas = this.running?.canvas;
    if (!canvas) return;
    const value = flip || this.art?.flip || 'normal';
    canvas.style.transformOrigin = 'center center';
    canvas.style.transform =
      value === 'horizontal'
        ? 'scaleX(-1)'
        : value === 'vertical'
        ? 'scaleY(-1)'
        : 'none';
  }

  private restoreVideo() {
    const video = this.art?.video as HTMLVideoElement | undefined;
    if (!video) return;
    video.style.opacity = '';
    video.style.pointerEvents = '';
    video.style.position = '';
    video.style.zIndex = '';
  }

  stop() {
    const running = this.running;
    this.running = null;
    if (!running) return;
    try {
      running.stop();
    } catch {
      // 忽略
    }
    running.canvas.remove();
    this.restoreVideo();
  }

  private async start() {
    const art = this.art;
    const video = art?.video as HTMLVideoElement | undefined;
    if (!art || !video) return;
    this.stop();
    let canvas: HTMLCanvasElement | null = null;
    try {
      if (!video.videoWidth || !video.videoHeight)
        await new Promise<void>((resolve) => {
          if (video.videoWidth) return resolve();
          video.addEventListener('loadedmetadata', () => resolve(), {
            once: true,
          });
        });
      if (!video.videoWidth || !video.videoHeight)
        throw new Error('无法获取视频尺寸');
      const scale = this.state.scale;
      canvas = document.createElement('canvas');
      canvas.width = Math.floor(video.videoWidth * scale);
      canvas.height = Math.floor(video.videoHeight * scale);
      if (!canvas.width || !canvas.height) throw new Error('画面尺寸无效');
      canvas.className = 'tm-anime4k-canvas';
      canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;cursor:pointer;z-index:1;background:transparent';
      canvas.addEventListener('click', () => art.toggle());
      canvas.addEventListener('dblclick', () => {
        art.fullscreen = !art.fullscreen;
      });
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.position = 'absolute';
      video.style.zIndex = '-1';
      art.template.$video.parentElement.insertBefore(canvas, video);
      const modes = (await import('anime4k-webgpu')) as any;
      const pipelineClass = modes[this.state.mode] || modes.ModeA;
      const controller = await createAnime4KRenderer({
        video,
        canvas,
        scale,
        pipelineClass,
      });
      if (this.art !== art) {
        controller.stop();
        canvas.remove();
        return;
      }
      this.running = { stop: controller.stop, canvas };
      this.syncFlip();
      this.update({ enabled: true });
      art.notice.show = `超分已开启（${this.state.mode}，${scale}x）`;
    } catch (error) {
      canvas?.remove();
      this.restoreVideo();
      this.update({ enabled: false });
      art.notice.show = `超分开启失败：${
        error instanceof Error ? error.message : '未知错误'
      }`;
    }
  }
}
